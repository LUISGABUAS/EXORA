import { supabase } from '../lib/supabase';

// ── Tipos públicos ────────────────────────────────────────────────────────────

export type RiskLevel = 'bajo' | 'medio' | 'alto' | 'sin_evaluar';
export type AlertNivel = 'info' | 'warning' | 'error' | 'critical';
export type SatStatus = 'vigente' | 'cancelado' | 'no_encontrado' | 'no_verificado' | 'error_sat';

export interface CFDIRecord {
  id: string;
  uuid: string;
  nombre_emisor: string;
  rfc_emisor: string;
  total: number;
  fecha: string;
  tipo_comprobante: string;
  estado: SatStatus;
  validation_status: 'pendiente' | 'ok' | 'error' | 'warning';
  risk_level: RiskLevel;
  risk_score: number;
  is_deducible_estimado: boolean | null;
  matched_bank_movement_id: string | null;
  created_at: string;
}

export interface FiscalAlert {
  id: string;
  tipo: string;
  nivel: AlertNivel;
  titulo: string;
  descripcion: string;
  que_hacer: string;
  cfdi_id: string | null;
  bank_movement_id: string | null;
  evidencia: Record<string, unknown>;
  is_resolved: boolean;
  created_at: string;
}

export interface FiscalScore {
  score: number;             // 0-100
  label: string;             // "Todo en orden ✅" etc.
  color: 'green' | 'yellow' | 'red';
  excepciones_abiertas: number;
}

export interface UploadCFDIResult {
  success: boolean;
  cfdi_id?: string;
  validation_status?: string;
  sat_status?: string;
  score?: { level: string; etiqueta_usuario: string; color: string };
  errors?: Array<{ tipo: string; mensaje_usuario: string; que_hacer: string; severidad: string }>;
  alertas_count?: number;
  cfdi?: { uuid: string; nombre_emisor: string; total: number; fecha: string };
  upgrade_hint?: string | null;
  error?: string;
  mensaje?: string;
  limite_alcanzado?: boolean;
}

// ── Subir y validar un CFDI XML ───────────────────────────────────────────────

export async function uploadCFDI(
  xmlString: string,
  userRfc: string,
  isPremium: boolean,
  authToken: string,
): Promise<UploadCFDIResult> {
  try {
    const { data, error } = await supabase.functions.invoke('validate-cfdi', {
      body: { xmlString, userRfc, isPremium },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (error) {
      // Distinguir límite free vs error real
      if (error.message?.includes('limite_free') || data?.error === 'limite_free') {
        return {
          success: false,
          limite_alcanzado: true,
          mensaje: data?.mensaje ?? 'Llegaste al límite de facturas gratuitas este mes.',
        };
      }
      throw error;
    }

    return { success: true, ...data };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { success: false, error: e?.message ?? 'No se pudo procesar la factura. Intenta de nuevo.' };
  }
}

// ── Leer CFDIs del usuario ────────────────────────────────────────────────────

export async function getCFDIs(
  userId: string,
  filter?: { riskLevel?: RiskLevel; estado?: string },
): Promise<CFDIRecord[]> {
  let query = supabase
    .from('cfdis')
    .select(`
      id, uuid, nombre_emisor, rfc_emisor, total, fecha,
      tipo_comprobante, estado, validation_status,
      risk_level, risk_score, is_deducible_estimado,
      matched_bank_movement_id, created_at
    `)
    .eq('user_id', userId)
    .order('fecha', { ascending: false });

  if (filter?.riskLevel) {
    query = query.eq('risk_level', filter.riskLevel);
  }
  if (filter?.estado) {
    query = query.eq('estado', filter.estado);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CFDIRecord[];
}

// Solo CFDIs que requieren atención (para la caja de excepciones)
export async function getCFDIsConProblemas(userId: string): Promise<CFDIRecord[]> {
  const { data, error } = await supabase
    .from('cfdis')
    .select(`
      id, uuid, nombre_emisor, rfc_emisor, total, fecha,
      tipo_comprobante, estado, validation_status,
      risk_level, risk_score, is_deducible_estimado,
      matched_bank_movement_id, created_at
    `)
    .eq('user_id', userId)
    .in('risk_level', ['medio', 'alto'])
    .order('risk_score', { ascending: false });

  if (error) throw error;
  return (data ?? []) as CFDIRecord[];
}

// ── Alertas fiscales ──────────────────────────────────────────────────────────

export async function getAlertasAbiertas(userId: string): Promise<FiscalAlert[]> {
  const { data, error } = await supabase
    .from('fiscal_alerts')
    .select('id, tipo, nivel, titulo, descripcion, que_hacer, cfdi_id, bank_movement_id, evidencia, is_resolved, created_at')
    .eq('user_id', userId)
    .eq('is_resolved', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as FiscalAlert[];
}

export async function resolverAlerta(alertaId: string): Promise<void> {
  const { error } = await supabase
    .from('fiscal_alerts')
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', alertaId);

  if (error) throw error;
}

// ── Score de salud fiscal ─────────────────────────────────────────────────────

export async function getFiscalScore(userId: string): Promise<FiscalScore> {
  const { data, error } = await supabase
    .from('fiscal_profiles')
    .select('score_salud, excepciones_abiertas, nivel_riesgo_global')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return { score: 100, label: 'Todo en orden ✅', color: 'green', excepciones_abiertas: 0 };
  }

  const score = data.score_salud ?? 100;
  const exc = data.excepciones_abiertas ?? 0;

  let label: string;
  let color: 'green' | 'yellow' | 'red';

  if (exc === 0) {
    label = 'Todo en orden ✅';
    color = 'green';
  } else if (exc <= 2) {
    label = `Revisa ${exc} ${exc === 1 ? 'cosa' : 'cosas'} 🟡`;
    color = 'yellow';
  } else {
    label = `Hay ${exc} problemas 🔴`;
    color = 'red';
  }

  return { score, label, color, excepciones_abiertas: exc };
}

// ── Contador: cuántos CFDIs free subidos este mes ─────────────────────────────

export async function getCFDIsEstesMes(userId: string): Promise<number> {
  const firstDay = new Date();
  firstDay.setDate(1);
  firstDay.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('cfdis')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', firstDay.toISOString());

  if (error) return 0;
  return count ?? 0;
}

// ── Texto amigable para el tipo de CFDI ──────────────────────────────────────

export function labelTipoComprobante(tipo: string): string {
  const map: Record<string, string> = {
    I: 'Factura de compra',
    E: 'Nota de crédito',
    T: 'Traslado',
    P: 'Pago',
    N: 'Nómina',
  };
  return map[tipo] ?? 'Factura';
}

export function labelEstado(estado: string): { texto: string; color: string } {
  if (estado === 'cancelado')    return { texto: 'Cancelada',        color: '#EF4444' };
  if (estado === 'no_encontrado') return { texto: 'No reconocida',   color: '#F97316' };
  return                                 { texto: 'Vigente',          color: '#22C55E' };
}

export function labelRisk(level: RiskLevel): { texto: string; color: string; emoji: string } {
  if (level === 'alto')  return { texto: 'Problema', color: '#EF4444', emoji: '🔴' };
  if (level === 'medio') return { texto: 'Revisar',  color: '#F59E0B', emoji: '🟡' };
  if (level === 'bajo')  return { texto: 'OK',       color: '#22C55E', emoji: '✅' };
  return                        { texto: 'Pendiente', color: '#8E8E93', emoji: '⏳' };
}
