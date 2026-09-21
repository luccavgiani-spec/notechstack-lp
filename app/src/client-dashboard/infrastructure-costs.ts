// Public price references checked on 2026-09-21; assumptions are editable in the UI.
// This models a dedicated production account, not the customer's actual invoice.
export type CostScenario = { exchange: number; visits: number; storage: boolean; email: boolean; support: boolean }
export const DEFAULT_SCENARIO: CostScenario = { exchange: 5, visits: 2, storage: false, email: false, support: false }
export const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
export const quantity = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)

export function estimateInfrastructure(users: number, scenario: CostScenario) {
  const requests = users * scenario.visits * 10
  const traffic = users * scenario.visits * 0.005
  // Flat Rate CDN: included 1M requests / 1TB; next tier +$20, 10M / 50TB.
  const cdn = requests > 1_000_000 || traffic > 1000 ? (requests > 10_000_000 ? 100 : 20) : 0
  const databaseGB = 2 + users * 0.0001
  const storageGB = 5 + users * 0.001 + (scenario.storage ? 100 : 0)
  const egressGB = users * 0.005
  const emails = scenario.email ? users * 2 : 0
  const rows = [
    { key: 'hosting', brand: 'vercel', title: 'Hospedagem · Vercel Pro', detail: `US$ 20 de base + US$ ${cdn} de CDN. ${quantity(requests)} requisições e ${quantity(traffic)} GB/mês.`, usd: 20 + cdn, href: 'https://vercel.com/docs/pricing/flat-rate-cdn' },
    { key: 'database', brand: 'supabase', title: 'Banco de dados · Supabase Pro', detail: `US$ 25 inclui uma instância Micro e 8 GB. Simulação: ${quantity(databaseGB)} GB; excedente a US$ 0,125/GB.`, usd: 25 + Math.max(0, databaseGB - 8) * 0.125, href: 'https://supabase.com/pricing' },
    { key: 'auth', brand: 'supabase', title: 'Autenticação · Supabase Auth', detail: 'Incluída até 100 mil usuários ativos/mês; depois US$ 0,00325 por usuário adicional.', usd: Math.max(0, users - 100_000) * 0.00325, href: 'https://supabase.com/pricing' },
    { key: 'storage', brand: 'supabase', title: 'Arquivos · Supabase Storage', detail: `${quantity(storageGB)} GB simulados. 100 GB incluídos; excedente a US$ 0,0213/GB.`, usd: Math.max(0, storageGB - 100) * 0.0213, href: 'https://supabase.com/pricing' },
    { key: 'egress', brand: 'supabase', title: 'Tráfego do banco e arquivos', detail: `${quantity(egressGB)} GB/mês simulados. 250 GB incluídos; excedente não cacheado a US$ 0,09/GB.`, usd: Math.max(0, egressGB - 250) * 0.09, href: 'https://supabase.com/pricing' },
    { key: 'email', brand: 'resend', title: 'E-mails · Resend Pro (opcional)', detail: scenario.email ? `${quantity(emails)} envios/mês. US$ 20 inclui 50 mil; + US$ 0,90 por bloco extra de mil.` : 'Expansão simulada, não identificada na stack atual. Desativada: sem custo.', usd: scenario.email ? 20 + Math.ceil(Math.max(0, emails - 50_000) / 1000) * 0.9 : 0, href: 'https://resend.com/pricing' },
  ].map((row) => ({ ...row, brl: Math.round(row.usd * scenario.exchange * 100) / 100 }))
  const infrastructure = Math.round(rows.reduce((total, row) => total + row.brl, 0) * 100) / 100
  const support = scenario.support ? 500 : 0
  return { rows, infrastructure, support, total: Math.round((infrastructure + support) * 100) / 100 }
}
