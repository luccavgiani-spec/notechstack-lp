import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BrandShell } from '../components/BrandShell'
import {
  listAccessibleProjects,
  type ProjectSummary,
} from '../projects/project-service'

function projectsFromNavigationState(state: unknown): ProjectSummary[] | null {
  if (typeof state !== 'object' || state === null || !('projects' in state)) {
    return null
  }

  const projects = state.projects

  if (
    !Array.isArray(projects) ||
    !projects.every(
      (project) =>
        typeof project === 'object' &&
        project !== null &&
        'id' in project &&
        typeof project.id === 'string' &&
        'name' in project &&
        typeof project.name === 'string',
    )
  ) {
    return null
  }

  return projects
}

export function ClientProjectsPage() {
  const location = useLocation()
  const [projects, setProjects] = useState<ProjectSummary[] | null>(() =>
    projectsFromNavigationState(location.state),
  )
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (projects !== null) {
      return
    }

    let active = true

    void listAccessibleProjects().then(({ projects: accessibleProjects, error }) => {
      if (!active) {
        return
      }

      setLoadError(Boolean(error))
      setProjects(error ? [] : accessibleProjects)
    })

    return () => {
      active = false
    }
  }, [projects])

  return (
    <BrandShell eyebrow="Seus projetos">
      <div className="rounded-2xl border border-borda bg-white p-8 shadow-card">
        <span className="mb-5 inline-flex rounded-full bg-azul-tint px-3 py-1 font-mono text-[0.625rem] font-medium uppercase tracking-[0.12em]">
          Texto provisório · revisar copy
        </span>
        <h1 className="text-3xl font-extrabold uppercase tracking-[-0.03em]">
          Escolha um projeto.
        </h1>
        <p className="mt-3 font-light leading-7 text-cinza">
          Abra o espaço que você quer acompanhar agora.
        </p>

        {projects === null ? (
          <p role="status" className="mt-7 rounded-xl bg-osso px-4 py-3 text-sm text-cinza">
            Carregando projetos…
          </p>
        ) : loadError ? (
          <p role="alert" className="mt-7 rounded-xl border-l-4 border-vermelho bg-vermelho-tint px-4 py-3 text-sm">
            Não foi possível carregar seus projetos. Tente novamente em instantes.
          </p>
        ) : projects.length === 0 ? (
          <p className="mt-7 rounded-xl bg-osso px-4 py-3 text-sm text-cinza">
            Nenhum projeto disponível para este acesso.
          </p>
        ) : (
          <ul className="mt-7 space-y-3" aria-label="Projetos disponíveis">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  to={`/p/${encodeURIComponent(project.id)}/como-funciona`}
                  aria-label={`Abrir ${project.name}`}
                  className="group flex items-center justify-between rounded-xl border border-borda bg-osso px-4 py-4 transition hover:border-azul focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
                >
                  <span className="font-semibold">{project.name}</span>
                  <span aria-hidden="true" className="font-mono text-xs text-azul">
                    ABRIR →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BrandShell>
  )
}
