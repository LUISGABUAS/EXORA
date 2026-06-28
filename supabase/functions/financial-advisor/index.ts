import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      question,          // pregunta del usuario (opcional)
      catSummary,        // gastos por categoría este mes
      catPrevSummary,    // gastos por categoría mes anterior
      topMerchants,      // top 5 comercios
      monthTotal,        // total gastos mes actual
      prevMonthTotal,    // total gastos mes anterior
      monthIncome,       // ingresos este mes
      deductibleTotal,   // total deducible
      nonDeductibleTotal,
      totalExpenses,     // número de gastos
      savingsGoals,      // metas de ahorro activas
      budgets,           // presupuestos configurados
      recurringTotal,    // total gastos fijos recurrentes
      regime,            // régimen fiscal
      razonSocial,       // nombre/razón social
      financialGoals,    // metas financieras del usuario
      ageRange,          // rango de edad
    } = body;

    const monthDiff = prevMonthTotal > 0
      ? ((monthTotal - prevMonthTotal) / prevMonthTotal * 100).toFixed(1)
      : null;

    const systemPrompt = `Eres un asesor financiero y fiscal experto para México, integrado en la app EXORA.
Tu rol es dar consejos prácticos, concisos y accionables basados en los datos reales del usuario.
Hablas en español mexicano, de forma directa y amigable.
Cuando hay información fiscal, consideras siempre el régimen fiscal del usuario.
Nunca inventas datos — solo usas los que te dan.
${financialGoals ? `Las metas financieras del usuario son: ${financialGoals}. Prioriza recomendaciones alineadas a estas metas.` : ''}
${ageRange ? `El usuario tiene entre ${ageRange} años. Adapta el tono y urgencia de las recomendaciones a su etapa de vida.` : ''}
Respondes SIEMPRE en JSON con la estructura indicada.`;

    const dataContext = `
DATOS FINANCIEROS DEL USUARIO (últimos 30 días):
- Régimen fiscal: ${regime}${razonSocial ? ` | Nombre: ${razonSocial}` : ''}
- Gastos del mes: $${monthTotal} MXN${monthDiff ? ` (${Number(monthDiff) > 0 ? '+' : ''}${monthDiff}% vs mes anterior)` : ''}
- Mes anterior: $${prevMonthTotal} MXN
- Ingresos del mes: $${monthIncome} MXN
- Balance: $${(monthIncome - monthTotal).toFixed(0)} MXN
- Gastos deducibles: $${deductibleTotal} MXN
- No deducibles: $${nonDeductibleTotal} MXN
- Número de transacciones: ${totalExpenses}
- Gastos fijos recurrentes: $${recurringTotal} MXN/mes

Por categoría este mes: ${catSummary}
Por categoría mes anterior: ${catPrevSummary || 'sin datos'}
Top comercios: ${topMerchants}
${budgets ? `Presupuestos configurados: ${budgets}` : ''}
${savingsGoals ? `Metas de ahorro: ${savingsGoals}` : ''}`;

    const userPrompt = question
      ? `${dataContext}

PREGUNTA DEL USUARIO: "${question}"

Responde con un análisis enfocado en su pregunta. Usa los datos reales.
Responde SOLO en JSON:
{
  "answer": "respuesta directa a su pregunta (2-3 oraciones)",
  "sections": [
    {
      "icon": "nombre-icono-material-community",
      "color": "#hexcolor",
      "title": "título",
      "body": "análisis detallado",
      "action": "qué hacer concreto (opcional)"
    }
  ],
  "quickTips": ["tip corto 1", "tip corto 2"]
}`
      : `${dataContext}

Genera un análisis financiero completo y estratégico.
Responde SOLO en JSON:
{
  "headline": "diagnóstico en una oración (ej: 'Tu mes va bien, pero Comida se disparó 40%')",
  "score": número del 1 al 10 de salud financiera,
  "sections": [
    {
      "icon": "nombre-icono-material-community",
      "color": "#hexcolor",
      "title": "título de sección",
      "body": "análisis con datos específicos",
      "action": "acción concreta recomendada"
    }
  ],
  "topOpportunity": "la mejora más impactante que puede hacer esta semana",
  "fiscalAlert": "alerta o tip fiscal relevante según su régimen (null si no aplica)"
}

Incluye secciones sobre: mayor gasto, tendencia vs mes anterior, oportunidad de ahorro, situación fiscal.`;

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'API key no configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Error al generar análisis' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Respuesta inválida' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const analysis = JSON.parse(match[0]);
    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
