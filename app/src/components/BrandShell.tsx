import type { PropsWithChildren } from 'react'

type BrandShellProps = PropsWithChildren<{
  eyebrow: string
}>

export function BrandShell({ children, eyebrow }: BrandShellProps) {
  return (
    <main className="min-h-screen bg-osso text-tinta">
      <img className="h-1.5 w-full object-cover" src="/barra-topo-4-cores.svg" alt="" />
      <div className="mx-auto flex min-h-[calc(100vh-0.375rem)] w-full max-w-6xl flex-col px-6 py-8 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between">
          <img
            className="h-auto w-40 sm:w-52"
            src="/no-tech-stack-tinta-ponto-ambar.svg"
            alt="nó tech stack"
          />
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-cinza">
            Área segura
          </span>
        </header>
        <section className="flex flex-1 items-center justify-center py-14">
          <div className="w-full max-w-md">
            <p className="mb-5 flex items-center gap-3 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-cinza">
              <span aria-hidden="true" className="h-px w-8 bg-ambar" />
              {eyebrow}
            </p>
            {children}
          </div>
        </section>
        <footer className="flex items-center justify-between border-t border-borda pt-5 text-xs text-cinza">
          <span className="flex gap-1.5" aria-hidden="true">
            <i className="h-2 w-2 rounded-full bg-azul" />
            <i className="h-2 w-2 rounded-full bg-vermelho" />
            <i className="h-2 w-2 rounded-full bg-ambar" />
            <i className="h-2 w-2 rounded-full bg-verde" />
          </span>
          <span>nó · tech stack</span>
        </footer>
      </div>
    </main>
  )
}
