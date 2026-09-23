import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { AgencyConsolePage } from './agency/AgencyConsolePage'
import { portfolioStats, type AgencyProject } from './agency/agency-service'

const mocks = vi.hoisted(() => ({ listAgencies: vi.fn(), loadAgency: vi.fn(), loadAgencyProject: vi.fn() }))
vi.mock('./lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }))
vi.mock('./auth/auth-context', () => ({ useAuth: () => ({ session: { user: { app_metadata: { role: 'AGENCY_ADMIN' } } } }) }))
vi.mock('./agency/agency-service', async (original) => ({ ...await original<typeof import('./agency/agency-service')>(), ...mocks }))
const agency = { id: 'maisis', name: 'Maisis Publicidade', slug: 'maisis', active: true }
const project: AgencyProject = { id: 'gazeta', name: 'Portal Gazeta', clientName: 'Gazeta Bragantina', clientId: 'gazeta-client', status: 'EM_REVISAO_CLIENTE', totalTasks: 4, doneTasks: 2, overdueTasks: 1, nextDate: '2026-09-30', updatedAt: '2026-09-23' }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.listAgencies.mockResolvedValue([agency])
  mocks.loadAgency.mockResolvedValue({ agency, projects: [project] })
  mocks.loadAgencyProject.mockResolvedValue({ tasks: [], versions: [] })
})
function show(path = '/agencia/maisis') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/agencia/:agencyId" element={<AgencyConsolePage />} /><Route path="/agencia/:agencyId/projetos/:projectId" element={<AgencyConsolePage />} /></Routes></MemoryRouter>)
}
it('counts unique clients and excludes finished projects from active/overdue metrics', () => {
  expect(portfolioStats([project, { ...project, id: 'other', status: 'ARQUIVADO', overdueTasks: 9 }])).toEqual({ clients: 1, active: 1, review: 1, overdue: 1 })
})
it('opens the scoped project and shows its deliveries and versions', async () => {
  show()
  expect(await screen.findByText('Maisis Publicidade')).toBeVisible()
  expect(screen.queryByRole('link', { name: 'Administrar agências' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: /Gazeta Bragantina/ }))
  expect(await screen.findByText('Nenhuma tarefa cadastrada.')).toBeVisible()
  expect(mocks.loadAgencyProject).toHaveBeenCalledWith('maisis', 'gazeta')
})
it('filters by client/project and reports an empty search', async () => {
  show(); await screen.findByRole('link', { name: /Gazeta Bragantina/ })
  await userEvent.type(screen.getByRole('textbox', { name: 'Buscar cliente ou projeto' }), 'inexistente')
  expect(screen.getByText('Nenhum projeto corresponde à busca.')).toBeVisible()
})
it('rejects a URL for an unavailable agency before requesting its portfolio', async () => {
  show('/agencia/other')
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar')
  expect(mocks.loadAgency).not.toHaveBeenCalled()
})
it('does not request the details of an unlinked project', async () => {
  show('/agencia/maisis/projetos/foreign-project')
  expect(await screen.findByRole('alert')).toHaveTextContent('Projeto não disponível')
  expect(mocks.loadAgencyProject).not.toHaveBeenCalled()
})
it('handles an account with no agency membership', async () => {
  mocks.listAgencies.mockResolvedValue([])
  show('/agencia/maisis')
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(mocks.loadAgency).not.toHaveBeenCalled()
})
it('shows the first-client empty state without sample projects', async () => {
  mocks.loadAgency.mockResolvedValue({ agency, projects: [] })
  show()
  expect(await screen.findByText('Seu próximo projeto começa aqui.')).toBeVisible()
  expect(screen.queryByRole('link', { name: /Gazeta/ })).not.toBeInTheDocument()
  expect(screen.getAllByRole('definition').map(node => node.textContent)).toEqual(['0', '0', '0', '0'])
})
it('opens the version history and project information tabs', async () => {
  show('/agencia/maisis/projetos/gazeta')
  await screen.findByText('Nenhuma tarefa cadastrada.')
  await userEvent.click(screen.getByRole('button', { name: 'Ver histórico completo' }))
  expect(screen.getByRole('heading', { name: 'Versões publicadas' })).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Informações' }))
  expect(screen.getByRole('heading', { name: 'Informações do projeto' })).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Etapas do projeto' }))
  expect(screen.getByRole('region', { name: 'Etapas e entregas' })).toBeVisible()
})
