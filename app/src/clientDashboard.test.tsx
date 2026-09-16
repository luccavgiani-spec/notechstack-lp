import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientDashboardPage } from './client-dashboard/ClientDashboardPage'
import type {
  DashboardData,
  KanbanItem,
  ModuleKey,
  TierKey,
} from './client-dashboard/client-dashboard-service'

const mocks = vi.hoisted(() => ({
  loadClientDashboard: vi.fn(),
  savePreferredTier: vi.fn(),
}))

vi.mock('./client-dashboard/client-dashboard-service', () => ({
  loadClientDashboard: mocks.loadClientDashboard,
  savePreferredTier: mocks.savePreferredTier,
  calculateProgress: (items: KanbanItem[]) => {
    if (items.length === 0) return 0
    return Math.round((items.filter((item) => item.status === 'concluido').length / items.length) * 100)
  },
}))

const routeByModule: Record<ModuleKey, string> = {
  como_funciona: 'como-funciona',
  prototipo: 'prototipo',
  etapas: 'etapas',
  editor: 'editor',
  versoes: 'versoes',
  marca: 'marca',
}

function kanbanItem(index: number, status: KanbanItem['status']): KanbanItem {
  return {
    id: `item-${index}`,
    title: `Etapa ${index}`,
    phase: `Fase ${index}`,
    macro_version: index % 2 === 0 ? 'V2' : 'V1',
    status,
    scheduled_date: '2026-09-20',
    position: index,
  }
}

function dashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    shell: {
      project_id: 'projeto-a',
      project_name: 'Projeto Alfa',
      effective_access_status: 'INICIAL_15_DIAS',
      access_released_at: '2026-09-15T00:00:00Z',
      modules: {
        como_funciona: 'ativo', prototipo: 'ativo', etapas: 'ativo',
        editor: 'bloqueado', versoes: 'bloqueado', marca: 'bloqueado',
      },
    },
    roadmap: {
      stack: ['React', 'Supabase'],
      costs: ['Hospedagem'],
      next_steps: ['Validar protótipo'],
      references: ['Referência editorial'],
      preferred_tier: null,
      prototype_url: 'https://example.test/prototipo',
      published_at: '2026-09-15T00:00:00Z',
      tiers: {
        essencial: {
          escopo: ['Núcleo'], profundidade: 'enxuta', exclusoes: ['Automações'],
          complexidade: 'baixa', prazo_dias: 15, valor_centavos: null, faixa: null,
        },
        basico: {
          escopo: ['Operação'], profundidade: 'intermediária', exclusoes: ['IA'],
          complexidade: 'média', prazo_dias: 30, valor_centavos: 450000, faixa: null,
        },
        completo: {
          escopo: ['Produto'], profundidade: 'completa', exclusoes: [],
          complexidade: 'alta', prazo_dias: 45, valor_centavos: null, faixa: 'Sob proposta',
        },
      },
    },
    kanban: [kanbanItem(1, 'a_fazer'), kanbanItem(2, 'em_andamento'), kanbanItem(3, 'concluido')],
    ...overrides,
  }
}

function renderDashboardRoute(module: ModuleKey) {
  return render(
    <MemoryRouter initialEntries={[`/p/projeto-a/${routeByModule[module]}`]}>
      <Routes>
        <Route
          path="/p/:projectId/:module"
          element={<ClientDashboardPage module={module} />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

function renderDashboard(module: ModuleKey, data = dashboardData()) {
  mocks.loadClientDashboard.mockResolvedValue(data)
  return renderDashboardRoute(module)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.savePreferredTier.mockImplementation(async (_projectId: string, tier: TierKey) => ({
    preferred_tier: tier,
    changed: true,
  }))
})

describe('dashboard do cliente', () => {
  it('C17 mostra loading e recupera erro com retry', async () => {
    mocks.loadClientDashboard
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(dashboardData())
    renderDashboardRoute('como_funciona')

    expect(screen.getByRole('status')).toHaveTextContent('Carregando dados…')
    expect(await screen.findByRole('heading', { name: 'Não foi possível carregar o projeto.' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('heading', { name: 'Seu primeiro plano está pronto.' })).toBeVisible()
    expect(mocks.loadClientDashboard).toHaveBeenCalledTimes(2)
  })

  it('C1 shell inicial e ordem dos seis módulos', async () => {
    renderDashboard('como_funciona')
    expect(await screen.findByRole('heading', { name: 'Seu primeiro plano está pronto.' })).toBeVisible()
    expect(screen.getByText('Aqui você encontra a direção do produto, o protótipo inicial e as etapas que transformarão a ideia em sistema.')).toBeVisible()
    const nav = screen.getByRole('navigation', { name: 'Módulos do projeto' })
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      '01Como funciona', '02Protótipo', '03Etapas do plano', '04Editor', '05Versões', '06Marca & arquivos',
    ])
  })

  it('C2 aviso de quinze dias', async () => {
    renderDashboard('como_funciona')
    expect(await screen.findByText('Seu acesso de análise fica disponível por 15 dias.')).toBeVisible()
    expect(screen.getByText('Se você decidir seguir com a Nó, o acesso deixa de expirar e acompanha o projeto até a entrega.')).toBeVisible()
  })

  it('C3 acesso ativo omite aviso', async () => {
    const data = dashboardData()
    data.shell!.effective_access_status = 'ATIVO_ATE_FIM_DO_PROJETO'
    renderDashboard('como_funciona', data)
    await screen.findByRole('heading', { name: 'Seu primeiro plano está pronto.' })
    expect(screen.queryByText('Seu acesso de análise fica disponível por 15 dias.')).not.toBeInTheDocument()
  })

  it.each(Object.keys(routeByModule) as ModuleKey[])('C4 expirado cobre as seis rotas — %s', async (module) => {
    const data = dashboardData()
    data.shell!.effective_access_status = 'EXPIRADO'
    renderDashboard(module, data)
    expect(await screen.findByRole('heading', { name: 'Sua janela de análise terminou.' })).toBeVisible()
    expect(screen.queryByText('Projeto Alfa')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Módulos do projeto' })).not.toBeInTheDocument()
  })

  it('C6 conteúdo publicado e três caminhos', async () => {
    renderDashboard('como_funciona')
    expect(await screen.findByText('React')).toBeVisible()
    expect(screen.getByText('Hospedagem')).toBeVisible()
    expect(screen.getByText('Validar protótipo')).toBeVisible()
    expect(screen.getByText('Referência editorial')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Agora existem três formas de tirar esse plano do papel.' })).toBeVisible()
    expect(screen.getByText('A base é a mesma. O que muda é a profundidade da execução, o número de etapas e o nível de produto que faz sentido construir agora.')).toBeVisible()
  })

  it('C7 três tiers campos e nulidade de preço', async () => {
    renderDashboard('como_funciona')
    await screen.findByRole('heading', { name: 'Essencial' })
    const options = screen.getByLabelText('Opções de execução')
    expect(within(options).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Essencial', 'Básico', 'Completo'])
    expect(screen.getByText('R$ 4.500,00')).toBeVisible()
    expect(screen.getByText('Sob proposta')).toBeVisible()
    expect(within(options).getAllByText('Prazo')).toHaveLength(3)
    expect(within(options).getAllByText('Escopo')).toHaveLength(3)
  })

  it('C8 primeira preferência fica marcada', async () => {
    renderDashboard('como_funciona')
    await userEvent.click(await screen.findByRole('button', { name: 'Escolher Essencial' }))
    expect(mocks.savePreferredTier).toHaveBeenCalledWith('projeto-a', 'essencial')
    expect(await screen.findByRole('button', { name: 'Tier preferido' })).toBeDisabled()
  })

  it('C9 seleção exclusiva troca de tier', async () => {
    const data = dashboardData()
    data.roadmap!.preferred_tier = 'essencial'
    renderDashboard('como_funciona', data)
    await userEvent.click(await screen.findByRole('button', { name: 'Escolher Básico' }))
    expect(screen.getByRole('button', { name: 'Escolher Essencial' })).toBeEnabled()
    expect(screen.getAllByText('Preferido')).toHaveLength(1)
    expect(mocks.savePreferredTier).toHaveBeenCalledTimes(1)
  })

  it('C10 protótipo usa iframe em mockup e link externo', async () => {
    renderDashboard('prototipo')
    expect(await screen.findByTitle('Protótipo navegável do projeto')).toHaveAttribute('src', 'https://example.test/prototipo')
    expect(screen.getByRole('link', { name: /Abrir protótipo em nova aba/ })).toHaveAttribute('target', '_blank')
  })

  it('C11 Kanban leitura ordem campos e progresso', async () => {
    const items = Array.from({ length: 27 }, (_, index) => kanbanItem(index + 1, index < 17 ? 'concluido' : index < 22 ? 'em_andamento' : 'a_fazer'))
    renderDashboard('etapas', dashboardData({ kanban: items }))
    expect(await screen.findByRole('heading', { name: '63% concluído' })).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 3, name: /^(A fazer|Em andamento|Concluído)$/ }).map((heading) => heading.textContent)).toEqual(['A fazer', 'Em andamento', 'Concluído'])
    expect(screen.getAllByText('Fase 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('V1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('20/09/2026').length).toBeGreaterThan(0)
  })

  it('C12 Kanban do cliente é somente leitura', async () => {
    renderDashboard('etapas')
    await screen.findByText('Acompanhamento somente leitura')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText(/mover|concluir/i)).not.toBeInTheDocument()
  })

  it('C13 Editor bloqueado usa copy exata', async () => {
    renderDashboard('editor')
    expect(await screen.findByText('O Editor é liberado quando a primeira versão do seu projeto fica pronta.')).toBeVisible()
    expect(screen.getByText('Você poderá testar textos, cores, logos e ajustes visuais antes de nos enviar suas preferências para a próxima versão.')).toBeVisible()
  })

  it('C14 Versões bloqueadas usa copy exata', async () => {
    renderDashboard('versoes')
    expect(await screen.findByText('Suas versões aparecem aqui quando a construção começar.')).toBeVisible()
    expect(screen.getByText('Cada entrega fica registrada para você acompanhar a evolução do produto até o go-live.')).toBeVisible()
  })

  it('F2-09 C4 e C12 exibem histórico ativo da versão mais recente', async () => {
    const data = dashboardData({
      shell: { ...dashboardData().shell!, modules: { ...dashboardData().shell!.modules, editor: 'ativo', versoes: 'ativo' } },
      versions: [
        { id: 'v2', label: 'V2', macro: 'V2', status: 'publicada', published_at: '2026-09-16T12:00:00Z', changelog: 'Segunda entrega', build_reference: 'build-v2', is_current: true, created_at: '2026-09-16T12:00:00Z' },
        { id: 'v1', label: 'V1', macro: 'V1', status: 'publicada', published_at: '2026-09-15T12:00:00Z', changelog: 'Primeira entrega', build_reference: 'build-v1', is_current: false, created_at: '2026-09-15T12:00:00Z' },
      ],
    })
    renderDashboard('versoes', data)
    expect(await screen.findByText('V2')).toBeVisible()
    expect(screen.getByText('Atual')).toBeVisible()
    expect(screen.getByText('Segunda entrega')).toBeVisible()
    expect(screen.getByText('Primeira entrega')).toBeVisible()
    expect(screen.getByText('Build: build-v2')).toBeVisible()
    expect(screen.getByText('Build: build-v1')).toBeVisible()
  })

  it('C15 Marca e arquivos permanece bloqueado', async () => {
    renderDashboard('marca')
    expect(await screen.findByRole('heading', { name: 'Marca & arquivos' })).toBeVisible()
    expect(screen.getByText('Texto provisório · revisar copy')).toBeVisible()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it.each([
    ['como_funciona', 'Seu plano ainda está sendo preparado. Assim que for publicado, ele aparece aqui.'],
    ['prototipo', 'O protótipo ainda não foi publicado para este projeto.'],
  ] as const)('C16 vazios de roadmap e protótipo — %s', async (module, copy) => {
    const data = dashboardData()
    data.roadmap!.published_at = null
    renderDashboard(module, data)
    expect(await screen.findByText(copy)).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('C16 vazio de Kanban', async () => {
    renderDashboard('etapas', dashboardData({ kanban: [] }))
    expect(await screen.findByText('As etapas entram aqui assim que o plano de execução for organizado.')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
