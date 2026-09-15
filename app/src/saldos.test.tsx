import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ listAdminSaldos: vi.fn(), markInstallmentReceived: vi.fn() }))
vi.mock('./saldos-service', () => mocks)
import { SaldosPage } from './pages/SaldosPage'

const snapshot = (overrides = {}) => ({
  today: '2026-09-15', realizedCents: 14990, pendingCents: 3000, projectedCents: 100000,
  projections: { '15': 100000, '30': 0, '45': 0 },
  realized: [{ id: 'approved', projectId: 'project-1', projectName: 'Projeto Alfa', date: '2026-09-15T12:00:00Z', amountCents: 14990, type: 'aprovacao', status: 'approved', source: 'payment', installmentId: null }],
  pending: [{ id: 'failed', projectId: 'project-1', projectName: 'Projeto Alfa', date: '2026-09-14T12:00:00Z', amountCents: 3000, type: 'falha', status: 'failed', source: 'payment', installmentId: null }],
  projected: [{ id: 'installment', projectId: 'project-1', projectName: 'Projeto Alfa', date: '2026-09-20T00:00:00Z', amountCents: 100000, type: 'parcela', status: 'prevista', source: 'installment', installmentId: 'installment-1' }],
  ...overrides,
})

function renderPage() { return render(<BrowserRouter><SaldosPage /></BrowserRouter>) }

describe('F3-11 saldos', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.listAdminSaldos.mockResolvedValue(snapshot()); mocks.markInstallmentReceived.mockResolvedValue({}) })

  it('C1 saldos mostra realizado pendente previsto e projecoes', async () => {
    renderPage()
    for (const heading of ['Realizado', 'Pendente', 'Previsto', 'Projeção por janela']) expect(await screen.findByRole('heading', { name: heading })).toBeVisible()
    expect(screen.getAllByText(/149,90/)[0]).toBeVisible()
    expect(screen.getAllByText(/1.000,00/)[0]).toBeVisible()
  })

  it('C4 zero movimentos mostra estado vazio', async () => {
    mocks.listAdminSaldos.mockResolvedValue(snapshot({ realizedCents: 0, pendingCents: 0, projectedCents: 0, realized: [], pending: [], projected: [] }))
    renderPage()
    expect(await screen.findByText('Nenhum movimento financeiro ainda.')).toBeVisible()
  })

  it('C11 recebimento pede confirmacao e recarrega', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Marcar recebida' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Confirmar recebimento?')
    await user.click(screen.getByRole('button', { name: 'Confirmar recebimento' }))
    await waitFor(() => expect(mocks.markInstallmentReceived).toHaveBeenCalledWith('installment-1'))
    expect(await screen.findByText('Parcela marcada como recebida.')).toBeVisible()
  })
})
