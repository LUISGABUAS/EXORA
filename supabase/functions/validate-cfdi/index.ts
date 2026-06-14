import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Tipos ────────────────────────────────────────────────────────────────────

interface ValidationError {
  tipo: string;
  descripcion: string;       // texto técnico (para el contador)
  mensaje_usuario: string;   // texto simple (para el contribuyente)
  que_hacer: string;         // qué debe hacer el usuario
  severidad: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO';
}

interface CFDIParsed {
  uuid: string;
  tipo_comprobante: string;
  fecha: string;
  subtotal: number;
  total: number;
  moneda: string;
  tipo_cambio: number;
  rfc_emisor: string;
  nombre_emisor: string;
  rfc_receptor: string;
  uso_cfdi: string;
  lugar_expedicion: string;
  conceptos: string;
  tiene_timbre: boolean;
}

// ── Helpers XML (regex, sin librerías) ───────────────────────────────────────

function attr(xml: string, tag: string, attrName: string): string {
  const tagRx = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}[^>]*>|<(?:[a-zA-Z0-9]+:)?${tag}[^>]*/>`, 'i');
  const tagMatch = xml.match(tagRx);
  if (!tagMatch) return '';
  const attrRx = new RegExp(`\\b${attrName}="([^"]*)"`, 'i');
  const m = tagMatch[0].match(attrRx);
  return m ? m[1] : '';
}

function parseCFDI(xml: string): CFDIParsed {
  const totalStr = attr(xml, 'Comprobante', 'Total') || attr(xml, 'Comprobante', 'SubTotal');
  const subtotalStr = attr(xml, 'Comprobante', 'SubTotal') || totalStr;

  const conceptosMatch = [...xml.matchAll(/<(?:[a-zA-Z0-9]+:)?Concepto[^>]*Descripcion="([^"]+)"/gi)];
  const conceptos = conceptosMatch.map(m => m[1]).join(', ');

  return {
    uuid: attr(xml, 'TimbreFiscalDigital', 'UUID'),
    tipo_comprobante: attr(xml, 'Comprobante', 'TipoDeComprobante') || 'E',
    fecha: attr(xml, 'Comprobante', 'Fecha'),
    subtotal: parseFloat(subtotalStr) || 0,
    total: parseFloat(totalStr) || 0,
    moneda: attr(xml, 'Comprobante', 'Moneda') || 'MXN',
    tipo_cambio: parseFloat(attr(xml, 'Comprobante', 'TipoCambio')) || 1,
    rfc_emisor: attr(xml, 'Emisor', 'Rfc'),
    nombre_emisor: attr(xml, 'Emisor', 'Nombre'),
    rfc_receptor: attr(xml, 'Receptor', 'Rfc'),
    uso_cfdi: attr(xml, 'Receptor', 'UsoCFDI'),
    lugar_expedicion: attr(xml, 'Comprobante', 'LugarExpedicion'),
    conceptos,
    tiene_timbre: xml.includes('TimbreFiscalDigital'),
  };
}

// ── Validación SAT en tiempo real ────────────────────────────────────────────

async function verificarSAT(
  cfdi: CFDIParsed,
): Promise<'vigente' | 'cancelado' | 'no_encontrado' | 'error_sat'> {
  try {
    const expresion = encodeURIComponent(
      `?re=${cfdi.rfc_emisor}&rr=${cfdi.rfc_receptor}&tt=${cfdi.total.toFixed(6)}&id=${cfdi.uuid}`,
    );
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:Consulta>
      <tem:expresionImpresa><![CDATA[?re=${cfdi.rfc_emisor}&rr=${cfdi.rfc_receptor}&tt=${cfdi.total.toFixed(6)}&id=${cfdi.uuid}]]></tem:expresionImpresa>
    </tem:Consulta>
  </soapenv:Body>
</soapenv:Envelope>`;

    const res = await fetch(
      'https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: 'http://tempuri.org/IConsultaCFDIService/Consulta',
        },
        body: soapBody,
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!res.ok) return 'error_sat';
    const text = await res.text();

    if (text.includes('<Estado>Vigente</Estado>')) return 'vigente';
    if (text.includes('<Estado>Cancelado</Estado>')) return 'cancelado';
    if (text.includes('CodigoEstatus>N')) return 'no_encontrado';
    return 'error_sat';
  } catch {
    return 'error_sat';
  }
}

// ── Motor de scoring de riesgo ────────────────────────────────────────────────

interface ScoreResult {
  score: number;               // 0-100
  level: 'bajo' | 'medio' | 'alto';
  etiqueta_usuario: string;    // texto simple para el usuario
  color: string;               // green | yellow | red
}

function calcularScore(
  errors: ValidationError[],
  satStatus: string,
  cfdi: CFDIParsed,
  isPremium: boolean,
): ScoreResult {
  let score = 0;

  for (const e of errors) {
    switch (e.severidad) {
      case 'CRITICO': score += 70; break;
      case 'ALTO':    score += 50; break;
      case 'MEDIO':   score += 25; break;
      case 'BAJO':    score += 10; break;
    }
  }

  if (satStatus === 'cancelado')    score += 60;
  if (satStatus === 'no_encontrado') score += 40;
  if (cfdi.total > 150000)          score += isPremium ? 15 : 0;

  score = Math.min(score, 100);

  if (score <= 30) return { score, level: 'bajo',  etiqueta_usuario: 'Todo bien ✅',              color: 'green'  };
  if (score <= 60) return { score, level: 'medio', etiqueta_usuario: 'Revisa esta factura 🟡',   color: 'yellow' };
  return            { score, level: 'alto',  etiqueta_usuario: 'Esta factura tiene un problema 🔴', color: 'red'    };
}

// ── Mensajes de alerta amigables ──────────────────────────────────────────────

function alertasCFDI(
  cfdi: CFDIParsed,
  satStatus: string,
  errors: ValidationError[],
  isPremium: boolean,
): Array<{
  tipo: string; nivel: string;
  titulo: string; descripcion: string; que_hacer: string; descripcion_tecnica: string;
  evidencia: object;
}> {
  const alertas = [];

  if (satStatus === 'cancelado') {
    alertas.push({
      tipo: 'cfdi_cancelado',
      nivel: 'critical',
      titulo: 'Factura cancelada',
      descripcion: 'Esta factura ya no es válida.',
      que_hacer: 'Pídele una factura nueva a quien te la dio, o elimínala si ya no la necesitas.',
      descripcion_tecnica: `CFDI UUID ${cfdi.uuid} con estado Cancelado en el SAT.`,
      evidencia: { uuid: cfdi.uuid, rfc_emisor: cfdi.rfc_emisor, sat_status: 'cancelado' },
    });
  }

  if (satStatus === 'no_encontrado') {
    alertas.push({
      tipo: 'cfdi_no_encontrado',
      nivel: 'error',
      titulo: 'Factura no reconocida',
      descripcion: 'El SAT no encontró esta factura en su sistema.',
      que_hacer: 'Verifica que el archivo XML sea correcto, o contacta a quien te emitió la factura.',
      descripcion_tecnica: `CFDI UUID ${cfdi.uuid} no encontrado en el servicio de consulta SAT.`,
      evidencia: { uuid: cfdi.uuid, rfc_emisor: cfdi.rfc_emisor, sat_status: 'no_encontrado' },
    });
  }

  for (const e of errors) {
    alertas.push({
      tipo: e.tipo,
      nivel: e.severidad === 'CRITICO' ? 'critical' : e.severidad === 'ALTO' ? 'error' : 'warning',
      titulo: e.mensaje_usuario,
      descripcion: e.mensaje_usuario,
      que_hacer: e.que_hacer,
      descripcion_tecnica: e.descripcion,
      evidencia: { cfdi_uuid: cfdi.uuid, campo: e.tipo },
    });
  }

  if (isPremium && cfdi.total > 150000) {
    alertas.push({
      tipo: 'monto_alto',
      nivel: 'warning',
      titulo: 'Gasto grande — puede necesitar documentación extra',
      descripcion: 'Este gasto supera $150,000 pesos.',
      que_hacer: 'Para gastos grandes conviene guardar documentación adicional que justifique el gasto.',
      descripcion_tecnica: `Monto $${cfdi.total.toFixed(2)} supera umbral Art. 28 CFF ($150,000 MXN). Requiere medio de pago distinto a efectivo.`,
      evidencia: { monto: cfdi.total, uuid: cfdi.uuid },
    });
  }

  return alertas;
}

// ── Handler principal ─────────────────────────────────────────────────────────

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { xmlString, userRfc, isPremium = false } = await req.json();

    if (!xmlString || typeof xmlString !== 'string') {
      return new Response(JSON.stringify({ error: 'Se requiere el contenido XML de la factura' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Límite free: máximo 3 CFDIs por mes ──────────────────────────────────
    if (!isPremium) {
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      firstDayOfMonth.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('cfdis')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', firstDayOfMonth.toISOString());

      if ((count ?? 0) >= 3) {
        return new Response(
          JSON.stringify({
            error: 'limite_free',
            mensaje: 'Con el plan gratuito puedes subir hasta 3 facturas por mes. Actualiza a Premium para subir facturas ilimitadas.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ── Parsear XML ───────────────────────────────────────────────────────────
    const cfdi = parseCFDI(xmlString);
    const errors: ValidationError[] = [];

    // ── Regla 1: UUID válido ──────────────────────────────────────────────────
    const uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!cfdi.uuid || !uuidRx.test(cfdi.uuid)) {
      errors.push({
        tipo: 'uuid_invalido',
        descripcion: `UUID "${cfdi.uuid}" no tiene el formato correcto del SAT.`,
        mensaje_usuario: 'Esta factura parece estar dañada o incompleta',
        que_hacer: 'Pídele una nueva factura a quien te la emitió.',
        severidad: 'CRITICO',
      });
    }

    // ── Regla 2: Duplicado ────────────────────────────────────────────────────
    if (cfdi.uuid) {
      const { data: existing } = await supabase
        .from('cfdis')
        .select('id')
        .eq('user_id', user.id)
        .eq('uuid', cfdi.uuid)
        .maybeSingle();

      if (existing) {
        errors.push({
          tipo: 'duplicado',
          descripcion: `CFDI con UUID ${cfdi.uuid} ya existe para este usuario.`,
          mensaje_usuario: 'Ya tienes esta factura guardada',
          que_hacer: 'No necesitas agregarla de nuevo, ya la tienes registrada.',
          severidad: 'MEDIO',
        });
      }
    }

    // ── Regla 3: Campos obligatorios ──────────────────────────────────────────
    if (!cfdi.fecha) {
      errors.push({
        tipo: 'campo_faltante_fecha',
        descripcion: 'Campo Fecha ausente en el Comprobante.',
        mensaje_usuario: 'A esta factura le falta la fecha',
        que_hacer: 'Verifica que el archivo XML no esté corrupto.',
        severidad: 'ALTO',
      });
    }
    if (!cfdi.rfc_emisor) {
      errors.push({
        tipo: 'campo_faltante_rfc_emisor',
        descripcion: 'Campo RFC del Emisor ausente.',
        mensaje_usuario: 'A esta factura le falta información del vendedor',
        que_hacer: 'Pídele una nueva factura al negocio que te la emitió.',
        severidad: 'ALTO',
      });
    }
    if (!cfdi.tiene_timbre) {
      errors.push({
        tipo: 'sin_timbre_fiscal',
        descripcion: 'El XML no contiene TimbreFiscalDigital — posiblemente no está sellado por el SAT.',
        mensaje_usuario: 'Esta factura no tiene el sello del SAT',
        que_hacer: 'Esta factura puede no ser válida. Pídele una nueva al emisor.',
        severidad: 'CRITICO',
      });
    }
    if (cfdi.total <= 0) {
      errors.push({
        tipo: 'monto_invalido',
        descripcion: `Total "${cfdi.total}" es inválido (debe ser mayor a 0).`,
        mensaje_usuario: 'El monto de esta factura está en cero',
        que_hacer: 'Verifica el archivo XML o pide una nueva factura.',
        severidad: 'ALTO',
      });
    }

    // ── Regla 4: RFC receptor coincide con el usuario ─────────────────────────
    if (userRfc && cfdi.rfc_receptor && cfdi.rfc_receptor !== userRfc) {
      const rfcsGenericos = ['XAXX010101000', 'XEXX010101000'];
      if (!rfcsGenericos.includes(cfdi.rfc_receptor)) {
        errors.push({
          tipo: 'rfc_no_coincide',
          descripcion: `RFC receptor "${cfdi.rfc_receptor}" no coincide con el RFC del usuario "${userRfc}".`,
          mensaje_usuario: 'Esta factura no está a tu nombre',
          que_hacer: 'Esta factura fue emitida para otra persona. Solo puedes deducir facturas que estén a tu nombre.',
          severidad: 'ALTO',
        });
      }
    }

    // ── Verificación SAT (solo si no hay errores críticos que lo impidan) ─────
    const tieneCritico = errors.some(e => e.severidad === 'CRITICO');
    let satStatus: string = tieneCritico ? 'no_verificado' : 'vigente';

    if (!tieneCritico && cfdi.uuid) {
      satStatus = await verificarSAT(cfdi);
    }

    // ── Calcular score (solo completo en premium) ─────────────────────────────
    const scoreResult = calcularScore(errors, satStatus, cfdi, isPremium);

    // Si free, solo guardamos con score básico y sin coherencia
    const validationStatus =
      errors.some(e => e.severidad === 'CRITICO' || e.severidad === 'ALTO') ? 'error'
      : errors.length > 0 ? 'warning'
      : 'ok';

    // ── Guardar CFDI en Supabase ──────────────────────────────────────────────
    const { data: cfdiRow, error: insertError } = await supabase
      .from('cfdis')
      .upsert({
        user_id: user.id,
        uuid: cfdi.uuid || `sin-uuid-${Date.now()}`,
        tipo_comprobante: cfdi.tipo_comprobante,
        fecha: cfdi.fecha || new Date().toISOString(),
        subtotal: cfdi.subtotal,
        total: cfdi.total,
        moneda: cfdi.moneda,
        tipo_cambio: cfdi.tipo_cambio,
        rfc_emisor: cfdi.rfc_emisor,
        nombre_emisor: cfdi.nombre_emisor,
        rfc_receptor: cfdi.rfc_receptor,
        uso_cfdi: cfdi.uso_cfdi,
        lugar_expedicion: cfdi.lugar_expedicion,
        conceptos: cfdi.conceptos,
        xml_raw: xmlString.length < 100000 ? xmlString : null, // no guardar XMLs enormes
        estado: satStatus === 'cancelado' ? 'cancelado' : satStatus === 'no_encontrado' ? 'no_encontrado' : 'vigente',
        sat_verified_at: tieneCritico ? null : new Date().toISOString(),
        validation_status: validationStatus,
        validation_errors: errors.map(e => ({ tipo: e.tipo, severidad: e.severidad, descripcion: e.descripcion })),
        risk_score: isPremium ? scoreResult.score : (scoreResult.score > 30 ? scoreResult.score : 0),
        risk_level: isPremium ? scoreResult.level : (errors.length > 0 ? 'medio' : 'bajo'),
        is_deducible_estimado: isPremium
          ? (validationStatus === 'ok' && satStatus === 'vigente' && !!cfdi.uso_cfdi)
          : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,uuid', ignoreDuplicates: false })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error guardando CFDI:', insertError);
    }

    // ── Guardar alertas ───────────────────────────────────────────────────────
    const alertas = alertasCFDI(cfdi, satStatus, errors, isPremium);
    if (alertas.length > 0 && cfdiRow?.id) {
      await supabase.from('fiscal_alerts').insert(
        alertas.map(a => ({
          user_id: user.id,
          tipo: a.tipo,
          nivel: a.nivel,
          titulo: a.titulo,
          descripcion: a.descripcion,
          que_hacer: a.que_hacer,
          descripcion_tecnica: a.descripcion_tecnica,
          evidencia: a.evidencia,
          cfdi_id: cfdiRow.id,
        })),
      );
    }

    // ── Actualizar excepciones abiertas en el perfil ──────────────────────────
    if (alertas.length > 0) {
      await supabase.rpc('increment_excepciones', { uid: user.id, n: alertas.length }).catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        cfdi_id: cfdiRow?.id ?? null,
        validation_status: validationStatus,
        sat_status: satStatus,
        score: isPremium ? scoreResult : { level: scoreResult.level, etiqueta_usuario: scoreResult.etiqueta_usuario, color: scoreResult.color },
        errors: errors.map(e => ({
          tipo: e.tipo,
          mensaje_usuario: e.mensaje_usuario,
          que_hacer: e.que_hacer,
          severidad: e.severidad,
        })),
        alertas_count: alertas.length,
        cfdi: {
          uuid: cfdi.uuid,
          nombre_emisor: cfdi.nombre_emisor || cfdi.rfc_emisor,
          total: cfdi.total,
          fecha: cfdi.fecha,
          tipo_comprobante: cfdi.tipo_comprobante,
        },
        // Para usuarios free: mensaje de upgrade si hay features bloqueados
        upgrade_hint: !isPremium && scoreResult.score > 30
          ? 'Actualiza a Premium para ver el análisis completo de riesgo y el historial de facturas.'
          : null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('validate-cfdi error:', err);
    return new Response(
      JSON.stringify({ error: 'Error procesando la factura. Intenta de nuevo.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
