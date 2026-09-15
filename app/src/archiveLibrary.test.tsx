import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ listArchiveAssets: vi.fn() }))
vi.mock('./admin-dashboard/admin-dashboard-service', () => mocks)
import { ArchiveLibraryPage } from './pages/ArchiveLibraryPage'

describe('F4-13 biblioteca', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.listArchiveAssets.mockResolvedValue([]) })
  it('C9 mostra ativo pesquisável com origem, direitos e versão', async () => {
    mocks.listArchiveAssets.mockResolvedValue([{ id: 'asset-1', project_id: 'project-1', project_name: 'Projeto Alfa', source_version: 'V2', tags: { nicho: ['saude'], componente: ['hero'] }, internal_reuse: true, public_case: false, rights_label: 'REUTILIZÁVEL INTERNAMENTE', created_at: '2026-09-15T12:00:00Z' }])
    render(<BrowserRouter><ArchiveLibraryPage /></BrowserRouter>)
    expect(await screen.findByText('Projeto Alfa')).toBeVisible()
    expect(screen.getByText('REUTILIZÁVEL INTERNAMENTE')).toBeVisible()
    expect(screen.getByText('Versão de origem: V2')).toBeVisible()
  })
  it('C9 mostra vazio sem confundir com erro', async () => {
    render(<BrowserRouter><ArchiveLibraryPage /></BrowserRouter>)
    expect(await screen.findByText('Nenhum ativo encontrado. Arquive um projeto para iniciar a biblioteca.')).toBeVisible()
  })
  it('C9 envia os filtros da biblioteca para a busca', async () => {
    render(<BrowserRouter><ArchiveLibraryPage /></BrowserRouter>)
    await screen.findByText('Nenhum ativo encontrado. Arquive um projeto para iniciar a biblioteca.')
    fireEvent.change(screen.getByLabelText('Nicho'), { target: { value: 'saude' } })
    fireEvent.click(screen.getByLabelText('Pode reutilizar'))
    fireEvent.click(screen.getByLabelText('Autorizado para case'))
    await waitFor(() => expect(mocks.listArchiveAssets).toHaveBeenLastCalledWith({ tags: { nicho: ['saude'] }, reusableOnly: true, caseOnly: true }))
  })
})
