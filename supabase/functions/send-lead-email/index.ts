import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { nome, email, whatsapp, contexto, objetivos, investimento, prazo, aiAnalysis } = body

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    // Leads do Roteador vão pra caixa própria; demais contextos seguem pra nó
    const isRoteador = (contexto || '').toLowerCase().includes('roteador')
    const TO_EMAIL = isRoteador ? 'roteadortelemed@gmail.com' : 'notechstack@gmail.com'

    const htmlBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#4285F4;padding:24px;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;margin:0;font-size:22px">🚀 Novo Lead — nó tech stack IA</h1>
  </div>
  <div style="background:#f8f9fa;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e3e6ea">
    <h2 style="color:#1a1a1a;margin-top:0">Dados do Lead</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;font-weight:700;color:#5f6368;width:140px">Nome</td><td style="padding:8px 0;color:#1a1a1a">${nome}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;color:#5f6368">E-mail</td><td style="padding:8px 0"><a href="mailto:${email}" style="color:#4285F4">${email}</a></td></tr>
      <tr><td style="padding:8px 0;font-weight:700;color:#5f6368">WhatsApp</td><td style="padding:8px 0;color:#1a1a1a">${whatsapp || '—'}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;color:#5f6368">Contexto</td><td style="padding:8px 0;color:#1a1a1a">${contexto || '—'}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;color:#5f6368">Objetivos</td><td style="padding:8px 0;color:#1a1a1a">${objetivos || '—'}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;color:#5f6368">Investimento</td><td style="padding:8px 0;color:#1a1a1a">${investimento || '—'}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;color:#5f6368">Prazo</td><td style="padding:8px 0;color:#1a1a1a">${prazo || '—'}</td></tr>
    </table>
    ${aiAnalysis ? `<div style="margin-top:20px;padding:16px;background:#e8f0fe;border-radius:8px;border-left:4px solid #4285F4"><h3 style="margin-top:0;color:#4285F4">✦ Análise da IA</h3><p style="color:#1a1a1a;white-space:pre-wrap;margin:0">${aiAnalysis}</p></div>` : ''}
    <div style="margin-top:24px;padding:12px;background:#fff;border-radius:8px;text-align:center">
      <a href="https://wa.me/55${(whatsapp||'').replace(/\D/g,'')}" style="background:#25D366;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">💬 Responder no WhatsApp</a>
    </div>
  </div>
</div>`

    // Try Resend if key available, else log only
    if (RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'nó hub <onboarding@resend.dev>',
          to: [TO_EMAIL],
          subject: `🚀 Novo lead: ${nome} — ${contexto || 'sem contexto'}`,
          html: htmlBody,
        })
      })
      const data = await res.json()
      console.log('Resend response:', JSON.stringify(data))
    } else {
      console.log('Lead recebido (sem RESEND_API_KEY):', JSON.stringify({ nome, email, whatsapp }))
    }

    // Always save to Supabase leads table
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://sdeowbqmwkwseyktyemn.supabase.co'
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (SUPABASE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ nome, email, whatsapp, contexto, objetivos, investimento, prazo, ai_analysis: aiAnalysis })
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
