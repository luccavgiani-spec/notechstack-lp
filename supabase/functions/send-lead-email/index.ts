/* Recebe os leads das LPs e faz duas coisas: grava em `leads` e notifica por
   e-mail via Resend.

   ORDEM IMPORTA: grava PRIMEIRO, notifica depois. A versão anterior fazia o
   contrário, então um erro de rede no fetch da Resend caía no catch e o lead
   nunca chegava ao banco — perdia-se o contato por causa do e-mail.

   E O ERRO PRECISA APARECER: a versão anterior fazia `await res.json()` e só
   logava, sem olhar `res.ok`. Qualquer recusa da Resend (chave inválida,
   domínio não verificado, remetente errado) virava sucesso silencioso: a
   função devolvia 200 com {success:true} e o formulário dizia "enviado".
   Agora o resultado do envio volta no corpo da resposta (`emailSent` /
   `emailError`) e vai para console.error, para o erro ser visível no log. */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { nome, email, whatsapp, contexto, objetivos, investimento, prazo, aiAnalysis } = body

    /* Leads do Roteador vão pra caixa própria; demais contextos seguem pra nó. */
    const isRoteador = (contexto || '').toLowerCase().includes('roteador')
    const TO_EMAIL = isRoteador ? 'roteadortelemed@gmail.com' : 'notechstack@gmail.com'
    const FROM_NAME = isRoteador ? 'Roteador' : 'nó tech stack'

    /* ── 1. Persistir o lead ───────────────────────────────────────────── */
    let saved = false
    let saveError: string | null = null
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://sdeowbqmwkwseyktyemn.supabase.co'
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!SUPABASE_KEY) {
      saveError = 'SUPABASE_SERVICE_ROLE_KEY ausente nos secrets da function'
    } else {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ nome, email, whatsapp, contexto, objetivos, investimento, prazo, ai_analysis: aiAnalysis }),
        })
        saved = r.ok
        if (!r.ok) saveError = `Postgrest ${r.status}: ${await r.text()}`
      } catch (e) {
        saveError = String(e)
      }
    }
    if (saveError) console.error('Falha ao gravar lead:', saveError)

    /* ── 2. Notificar por e-mail ───────────────────────────────────────── */
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

    let emailSent = false
    let emailError: string | null = null
    let emailId: string | null = null
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    if (!RESEND_API_KEY) {
      emailError = 'RESEND_API_KEY ausente nos secrets da function'
    } else {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            /* Domínio notechstack.com.br verificado na Resend. */
            from: `${FROM_NAME} <leads@notechstack.com.br>`,
            to: [TO_EMAIL],
            /* Responder no e-mail cai direto no lead, não na nó. */
            reply_to: email || undefined,
            subject: `🚀 Novo lead: ${nome} — ${contexto || 'sem contexto'}`,
            html: htmlBody,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          emailSent = true
          emailId = data?.id ?? null
        } else {
          emailError = `Resend ${res.status}: ${JSON.stringify(data)}`
        }
      } catch (e) {
        emailError = String(e)
      }
    }
    if (emailError) console.error('Falha ao enviar e-mail do lead:', emailError)

    /* 200 mesmo com e-mail falho: o lead já está gravado e o visitante não tem
       o que fazer com esse erro. Quem precisa vê-lo é o log e o front. */
    return json({ success: saved || emailSent, saved, saveError, emailSent, emailId, emailError })
  } catch (err) {
    console.error(err)
    return json({ success: false, error: String(err) }, 500)
  }
})
