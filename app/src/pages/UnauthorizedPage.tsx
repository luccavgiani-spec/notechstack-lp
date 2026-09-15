import { Link } from 'react-router-dom'
import { BrandShell } from '../components/BrandShell'

export function UnauthorizedPage() {
  return (
    <BrandShell eyebrow="Acesso restrito">
      <div className="rounded-2xl border border-borda border-l-vermelho border-l-4 bg-white p-8 shadow-card">
        <span className="mb-5 inline-flex rounded-full bg-vermelho-tint px-3 py-1 font-mono text-[0.625rem] font-medium uppercase tracking-[0.12em]">
          Texto provisório · revisar copy
        </span>
        <h1 className="text-3xl font-extrabold uppercase tracking-[-0.03em]">
          Acesso não autorizado.
        </h1>
        <p className="mt-3 font-light leading-7 text-cinza">
          Seu perfil não tem permissão para abrir esta área da operação.
        </p>
        <Link
          to="/p/projetos"
          className="mt-7 inline-flex rounded-xl bg-tinta px-5 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambar"
        >
          Ir para meus projetos
        </Link>
      </div>
    </BrandShell>
  )
}
