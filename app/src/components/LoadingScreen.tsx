import { BrandShell } from './BrandShell'

export function LoadingScreen() {
  return (
    <BrandShell eyebrow="Conectando as pontas">
      <div role="status" className="rounded-2xl border border-borda bg-white p-8 shadow-card">
        <span className="mb-5 block h-1 w-12 animate-pulse rounded-full bg-ambar" />
        <p className="text-lg font-light">Carregando dados…</p>
      </div>
    </BrandShell>
  )
}
