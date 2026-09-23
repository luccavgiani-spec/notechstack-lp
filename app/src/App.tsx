import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { RoleRoute } from './auth/RoleRoute'
import { ClientDashboardPage } from './client-dashboard/ClientDashboardPage'
import { ClientProjectsPage } from './pages/ClientProjectsPage'
import { AccessPage } from './pages/AccessPage'
import { LoginPage } from './pages/LoginPage'
import { UnauthorizedPage } from './pages/UnauthorizedPage'
const AdminActivityPage = lazy(() => import('./admin-dashboard/AdminDashboardPages').then(m => ({ default: m.AdminActivityPage })))
const AdminProjectDetailPage = lazy(() => import('./admin-dashboard/AdminDashboardPages').then(m => ({ default: m.AdminProjectDetailPage })))
const AdminProjectsPage = lazy(() => import('./admin-dashboard/AdminDashboardPages').then(m => ({ default: m.AdminProjectsPage })))
const SaldosPage = lazy(() => import('./pages/SaldosPage').then(m => ({ default: m.SaldosPage })))
const ArchiveLibraryPage = lazy(() => import('./pages/ArchiveLibraryPage').then(m => ({ default: m.ArchiveLibraryPage })))
const SchedulePage = lazy(() => import('./pages/SchedulePage').then(m => ({ default: m.SchedulePage })))

const AgencyConsolePage = lazy(() => import('./agency/AgencyConsolePage').then(m => ({ default: m.AgencyConsolePage })))
const AgencyManagementPage = lazy(() => import('./agency/AgencyManagementPage').then(m => ({ default: m.AgencyManagementPage })))
const BrandingPreview = import.meta.env.DEV && import.meta.env.VITE_AGENCY_LOCAL_PREVIEW === 'true'
  ? lazy(() => import('./client-dashboard/ClientBrandingPreview')) : null
const AgencyProjectPreview = import.meta.env.DEV && import.meta.env.VITE_AGENCY_LOCAL_PREVIEW === 'true'
  ? lazy(() => import('./agency/AgencyProjectPreview')) : null

export function AppRoutes() {
  return (
    <Suspense fallback={<p role="status">Carregando página…</p>}>
    <Routes>
      {AgencyProjectPreview ? <Route path="/__preview/agencia/projeto" element={<AgencyProjectPreview />} /> : null}
      {BrandingPreview ? <Route path="/__preview/cliente-agencia/:module" element={<Suspense fallback={<p>Carregando prévia…</p>}><BrandingPreview /></Suspense>} /> : null}
      <Route path="/acesso" element={<AccessPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/agencia" element={<AgencyConsolePage />} />
        <Route path="/agencia/:agencyId" element={<AgencyConsolePage />} />
        <Route path="/agencia/:agencyId/projetos/:projectId" element={<AgencyConsolePage />} />
        <Route path="/p/projetos" element={<ClientProjectsPage />} />
        <Route path="/p/:projectId/como-funciona" element={<ClientDashboardPage module="como_funciona" />} />
        <Route path="/p/:projectId/prototipo" element={<ClientDashboardPage module="prototipo" />} />
        <Route path="/p/:projectId/etapas" element={<ClientDashboardPage module="etapas" />} />
        <Route path="/p/:projectId/editor" element={<ClientDashboardPage module="editor" />} />
        <Route path="/p/:projectId/versoes" element={<ClientDashboardPage module="versoes" />} />
        <Route path="/p/:projectId/marca" element={<Navigate to="../como-funciona" replace />} />
        <Route path="/no/*" element={<RoleRoute role="NO_ADMIN" />}>
          <Route path="projetos" element={<AdminProjectsPage />} />
          <Route path="agencias" element={<AgencyManagementPage />} />
          <Route path="projetos/:projectId" element={<AdminProjectDetailPage />} />
          <Route path="atividade" element={<AdminActivityPage />} />
          <Route path="saldos" element={<SaldosPage />} />
          <Route path="biblioteca" element={<ArchiveLibraryPage />} />
          <Route path="cronograma" element={<SchedulePage />} />
        </Route>
      </Route>
      <Route path="/nao-autorizado" element={<UnauthorizedPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </Suspense>
  )
}
