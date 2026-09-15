import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./lib/supabase', () => ({ supabase: {} }))
const serviceMocks = vi.hoisted(() => ({
  listAdminProjects: vi.fn(),
  loadAdminProject: vi.fn(),
  listAdminActivity: vi.fn(),
  listAdminKanbanItems: vi.fn(),
  saveCommercialTerms: vi.fn(),
  saveKanbanItem: vi.fn(),
  transitionLead: vi.fn(),
  convertProject: vi.fn(),
  activateBrandModule: vi.fn(),
  activateDashboard: vi.fn(),
  transitionProjectStatus: vi.fn(),
}))
vi.mock('./admin-dashboard/admin-dashboard-service', async (importOriginal) => ({
  ...await importOriginal<typeof import('./admin-dashboard/admin-dashboard-service')>(),
  ...serviceMocks,
}))
import { AdminActivityPage, AdminProjectDetailPage, AdminProjectsPage } from './admin-dashboard/AdminDashboardPages'
import { filterActivityEvents, filterProjects, filterProjects as filterProjectCards, sortKanbanItems, type ActivityEvent, type ActivityKanbanItem, type ProjectCard, type ProjectDetail } from './admin-dashboard/admin-dashboard-service'

const project = (overrides: Partial<ProjectCard>): ProjectCard => ({
  id: crypto.randomUUID(), name: 'Roadmap', clientName: 'Cliente', companyName: null, niche: 'saúde',
  leadStatus: 'ROADMAP_PAGO', projectStatus: null, accessStatus: null, effectiveAccessStatus: null,
  tier: 'essencial', createdAt: '2026-09-10T10:00:00Z', nextScheduledDate: null, paymentStatus: null, modules: {}, ...overrides,
})

const detail = (overrides: Partial<ProjectDetail> = {}): ProjectDetail => ({
  ...project({ id: 'project-1', name: 'Site principal', clientName: 'Cliente Nó', companyName: 'Empresa Nó' }),
  contact: 'cliente@example.test', origin: 'indicação', enteredAt: '2026-09-10T10:00:00Z',
  diagnosis: { answers: { negocio: 'Saúde', objetivo: 'Vender', publico: 'Adultos', oferta: 'Consulta', prazo: '30 dias' }, references: ['ref'], materials: ['logo'], observations: ['prioridade'] },
  commercialTerms: { project_id: 'project-1', tier: 'essencial', amount_cents: 120000, payment_method: 'pix', installments: 1, deadline_days: 30, starts_on: '2026-09-16', financial_status: 'pendente', notes: 'Acompanhar', updated_at: '2026-09-15T10:00:00Z' },
  execution: { startedAt: null, deadline: null, phase: 'Descoberta', version: 'V1', nextDelivery: '2026-09-20', clientDashboardUrl: '/p/project-1/como-funciona', technicalLinks: [], internalNotes: null },
  deliverables: { roadmap: { ok: true }, prototypeUrl: 'https://prototype.example.test' },
  kanban: [{ id: 'item-1', project_id: 'project-1', title: 'Wireframe', phase: 'UX', macro_version: 'V1', status: 'a_fazer', scheduled_date: '2026-09-20', completed_at: null, position: 0 }],
  ...overrides,
})

function renderAt(path: string, node: ReactNode) {
  window.history.pushState({}, '', path)
  return render(<BrowserRouter>{node}</BrowserRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  serviceMocks.listAdminProjects.mockResolvedValue([])
  serviceMocks.loadAdminProject.mockResolvedValue(detail())
  serviceMocks.listAdminActivity.mockResolvedValue([])
  serviceMocks.listAdminKanbanItems.mockResolvedValue([])
  serviceMocks.saveCommercialTerms.mockImplementation(async (_projectId: string, values: object) => ({ ...detail().commercialTerms, ...values }))
  serviceMocks.saveKanbanItem.mockImplementation(async (_projectId: string, value: object) => ({ ...detail().kanban[0], ...value }))
  serviceMocks.transitionLead.mockResolvedValue({})
  serviceMocks.convertProject.mockResolvedValue({})
  serviceMocks.activateBrandModule.mockResolvedValue({})
  serviceMocks.activateDashboard.mockResolvedValue({ inviteLink: 'https://invite.example.test/opaque', projectId: 'project-1', accessReleasedAt: '2026-09-15T12:00:00Z' })
  serviceMocks.transitionProjectStatus.mockResolvedValue({})
})

describe('R1-06 dashboard projections', () => {
  it('C1 project cards refresh fields and order', () => {
    const cards = filterProjects([
      project({ id: 'late', name: 'A', nextScheduledDate: null }),
      project({ id: 'soon', name: 'B', nextScheduledDate: '2026-09-16', createdAt: '2026-09-09T10:00:00Z' }),
      project({ id: 'first', name: 'C', nextScheduledDate: '2026-09-16', createdAt: '2026-09-11T10:00:00Z' }),
    ], {}, '2026-09-15')
    expect(cards.map(({ id }) => id)).toEqual(['first', 'soon', 'late'])
  })

  it('C2 project filters search and distinct empty state', async () => {
    const cards = [project({ niche: 'saúde', clientName: 'Ana', nextScheduledDate: '2026-09-14' }), project({ id: 'other', niche: 'hotelaria', clientName: 'Bruno', companyName: 'Hotel Lua', leadStatus: 'CONVERTIDO', projectStatus: 'CONVERTIDO', tier: 'completo', paymentStatus: 'approved', nextScheduledDate: '2026-09-15' }), project({ id: 'done', projectStatus: 'CONCLUIDO' }), project({ id: 'archived', projectStatus: 'ARQUIVADO' })]
    expect(filterProjectCards(cards, { search: 'bruno' })).toHaveLength(1)
    expect(filterProjectCards(cards, { search: 'hotel lua' })).toHaveLength(1)
    expect(filterProjectCards(cards, { niche: 'educação' })).toHaveLength(0)
    expect(filterProjectCards(cards, { conversion: 'convertido' })[0].clientName).toBe('Bruno')
    expect(filterProjectCards(cards, { state: 'CONVERTIDO' })).toHaveLength(1)
    expect(filterProjectCards(cards, { tier: 'completo' })).toHaveLength(1)
    expect(filterProjectCards(cards, { paymentStatus: 'approved' })).toHaveLength(1)
    expect(filterProjectCards(cards, { deadline: 'atrasado' }, '2026-09-15')).toHaveLength(1)
    expect(filterProjectCards(cards, { deadline: 'hoje' }, '2026-09-15')).toHaveLength(1)
    expect(filterProjectCards(cards, { lifecycle: 'concluido' })).toHaveLength(1)
    expect(filterProjectCards(cards, { lifecycle: 'arquivado' })).toHaveLength(1)
    renderAt('/no/projetos', <AdminProjectsPage />)
    const stateFilter = await screen.findByLabelText('Estado')
    for (const label of ['Formulário preenchido', 'Pagamento pendente', 'Dashboard liberado', 'Não convertido', 'V1 em desenvolvimento', 'V1 publicada', 'V2 em desenvolvimento', 'V2 publicada', 'V3 / Go-live']) {
      expect(within(stateFilter).getByRole('option', { name: label })).toBeVisible()
    }
  })

  it('C6 kanban order is position then scheduled date', () => {
    expect(sortKanbanItems([
      { id: 'b', project_id: 'p', title: 'B', phase: null, macro_version: null, status: 'a_fazer', scheduled_date: '2026-09-20', completed_at: null, position: 0 },
      { id: 'a', project_id: 'p', title: 'A', phase: null, macro_version: null, status: 'a_fazer', scheduled_date: '2026-09-19', completed_at: null, position: 0 },
    ]).map(({ id }) => id)).toEqual(['a', 'b'])
  })

  it('C16 Sao Paulo day windows and descending order', () => {
    const events: ActivityEvent[] = [
      { id: 1, projectId: 'p', projectName: 'P', actorId: 'a', actorLabel: null, type: 'late', occurredAt: '2026-09-15T03:05:00Z', payload: {} },
      { id: 2, projectId: 'p', projectName: 'P', actorId: 'a', actorLabel: null, type: 'today', occurredAt: '2026-09-15T03:10:00Z', payload: {} },
      { id: 3, projectId: 'p', projectName: 'P', actorId: 'a', actorLabel: null, type: 'yesterday', occurredAt: '2026-09-14T03:00:00Z', payload: {} },
    ]
    expect(filterActivityEvents(events, 'hoje', '2026-09-15').map(({ id }) => id)).toEqual([2, 1])
    expect(filterActivityEvents(events, 'ontem', '2026-09-15').map(({ id }) => id)).toEqual([3])
  })

  it('C17 pending and overdue partitions', () => {
    const items: ActivityKanbanItem[] = [
      { id: 'today', project_id: 'p', project_name: 'P', title: 'Hoje', phase: null, macro_version: null, status: 'a_fazer', scheduled_date: '2026-09-15', completed_at: null, position: 0 },
      { id: 'none', project_id: 'p', project_name: 'P', title: 'Sem data', phase: null, macro_version: null, status: 'a_fazer', scheduled_date: null, completed_at: null, position: 1 },
      { id: 'late', project_id: 'p', project_name: 'P', title: 'Atrasado', phase: null, macro_version: null, status: 'a_fazer', scheduled_date: '2026-09-14', completed_at: null, position: 2 },
      { id: 'done', project_id: 'p', project_name: 'P', title: 'Concluído', phase: null, macro_version: null, status: 'concluido', scheduled_date: '2026-09-14', completed_at: '2026-09-14T12:00:00Z', position: 3 },
    ]
    expect(filterActivityEvents([], 'pendencias', '2026-09-15', items).map((event) => event.payload.item_id)).toEqual(['today', 'none'])
    expect(filterActivityEvents([], 'atrasados', '2026-09-15', items).map((event) => event.payload.item_id)).toEqual(['late'])
  })

  it('C3 project detail renders every normative group', async () => {
    renderAt('/no/projetos/project-1', <AdminProjectDetailPage />)

    for (const heading of ['Identificação', 'Diagnóstico', 'Comercial', 'Execução', 'Entregáveis', 'Kanban do projeto']) {
      expect(await screen.findByRole('heading', { name: heading })).toBeVisible()
    }
    expect(screen.getByText('Empresa Nó')).toBeVisible()
    expect(screen.getByText('cliente@example.test')).toBeVisible()
    expect(screen.getByText('https://prototype.example.test')).toBeVisible()
    expect(screen.getByLabelText('Valor formatado')).toHaveTextContent('R$ 1.200,00')
  })

  it('C4 commercial edit reloads', async () => {
    renderAt('/no/projetos/project-1', <AdminProjectDetailPage />)
    const user = userEvent.setup()
    const status = await screen.findByLabelText('Status financeiro')
    await user.clear(status)
    await user.type(status, 'pago')
    await user.click(screen.getByRole('button', { name: 'Salvar comercial' }))

    await waitFor(() => expect(serviceMocks.saveCommercialTerms).toHaveBeenCalledWith('project-1', expect.objectContaining({ financial_status: 'pago' })))
    expect(await screen.findByText('Salvo e registrado na atividade.')).toBeVisible()
  })

  it('C6 kanban actions repaint', async () => {
    renderAt('/no/projetos/project-1', <AdminProjectDetailPage />)
    const user = userEvent.setup()
    const column = await screen.findByLabelText('Coluna de Wireframe')
    await user.selectOptions(column, 'concluido')

    await waitFor(() => expect(serviceMocks.saveKanbanItem).toHaveBeenCalledWith('project-1', expect.objectContaining({ id: 'item-1', status: 'concluido' })))
  })

  it('R1-07 C1 ficha confirma e libera dashboard com convite copiável', async () => {
    renderAt('/no/projetos/project-1', <AdminProjectDetailPage />)
    const user = userEvent.setup()
    const content = {
      answers: {}, references: [], stack: [], costs: [], next_steps: [],
      tiers: Object.fromEntries(['essencial', 'basico', 'completo'].map((tier) => [tier, { escopo: [], profundidade: 'x', exclusoes: [], complexidade: 'x', prazo_dias: 0, valor_centavos: null, faixa: null }])),
    }
    const file = new File([JSON.stringify(content)], 'roadmap.json', { type: 'application/json' })
    await user.upload(await screen.findByLabelText('Arquivo de conteúdo do roadmap'), file)
    await user.click(screen.getByRole('button', { name: 'Liberar dashboard' }))
    expect(screen.getByText('Confirmar liberação?')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Confirmar liberação' }))
    await waitFor(() => expect(serviceMocks.activateDashboard).toHaveBeenCalledWith('project-1', content))
    expect(await screen.findByRole('button', { name: 'Copiar link de convite' })).toBeVisible()
  })

  it('R1-07 C2 mostra campos inválidos retornados pela função', async () => {
    serviceMocks.activateDashboard.mockRejectedValue({ context: { json: async () => ({ invalidFields: ['tiers.completo'] }) } })
    renderAt('/no/projetos/project-1', <AdminProjectDetailPage />)
    const user = userEvent.setup()
    const file = new File(['{}'], 'invalido.json', { type: 'application/json' })
    await user.upload(await screen.findByLabelText('Arquivo de conteúdo do roadmap'), file)
    await user.click(screen.getByRole('button', { name: 'Liberar dashboard' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar liberação' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('tiers.completo')
  })

  it('C15 activity has seven ordered views', async () => {
    renderAt('/no/atividade', <AdminActivityPage />)
    const tablist = await screen.findByRole('tablist', { name: 'Visões de atividade' })
    expect(within(tablist).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Hoje', 'Ontem', 'Pendências', 'Atrasados', 'Últimos 7 dias', 'Por projeto', 'Por evento'])
  })

  it('C18 activity row fields link and pagination', async () => {
    serviceMocks.listAdminActivity.mockResolvedValue(Array.from({ length: 21 }, (_, index) => ({ id: index + 1, projectId: 'project-1', projectName: 'Site principal', actorId: 'actor-1', actorLabel: 'operador@example.test', type: `evento.${String(index).padStart(2, '0')}`, occurredAt: `2026-09-15T${String(20 - (index % 20)).padStart(2, '0')}:00:00Z`, payload: {} })))
    renderAt('/no/atividade', <AdminActivityPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('tab', { name: 'Por evento' }))
    expect(await screen.findAllByRole('listitem')).toHaveLength(20)
    expect(screen.getAllByText(/operador@example\.test/)[0]).toBeVisible()
    expect(screen.getAllByRole('link', { name: 'Site principal' })[0]).toHaveAttribute('href', '/no/projetos/project-1')
    await user.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(await screen.findAllByRole('listitem')).toHaveLength(1)
  })

  it('C21 base empty states are distinct', async () => {
    const first = renderAt('/no/projetos', <AdminProjectsPage />)
    expect(await screen.findByText('Nenhum projeto cadastrado ainda.')).toBeVisible()
    first.unmount()
    renderAt('/no/atividade', <AdminActivityPage />)
    expect(await screen.findByText('Nenhuma atividade hoje.')).toBeVisible()
  })
})
