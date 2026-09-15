import { BrandShell } from '../components/BrandShell'

const pageContent = {
  'project-overview': {
    eyebrow: 'Como funciona',
    title: 'Seu projeto começa aqui.',
    description: 'O conteúdo deste módulo será construído na R1-05.',
  },
  'admin-projects': {
    eyebrow: 'Operação nó',
    title: 'Projetos.',
    description: 'A área operacional completa será construída na R1-06.',
  },
} as const

type PlaceholderPageProps = {
  area: keyof typeof pageContent
}

export function PlaceholderPage({ area }: PlaceholderPageProps) {
  const content = pageContent[area]

  return (
    <BrandShell eyebrow={content.eyebrow}>
      <div className="rounded-2xl border border-borda bg-white p-8 shadow-card">
        <span className="mb-5 inline-flex rounded-full bg-azul-tint px-3 py-1 font-mono text-[0.625rem] font-medium uppercase tracking-[0.12em]">
          Texto provisório · revisar copy
        </span>
        <h1 className="text-3xl font-extrabold uppercase tracking-[-0.03em]">
          {content.title}
        </h1>
        <p className="mt-3 font-light leading-7 text-cinza">{content.description}</p>
      </div>
    </BrandShell>
  )
}
