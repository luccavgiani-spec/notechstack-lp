import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { RoleRoute } from './auth/RoleRoute'
import { LoginPage } from './pages/LoginPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { UnauthorizedPage } from './pages/UnauthorizedPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/p/projetos" element={<PlaceholderPage area="client-projects" />} />
        <Route
          path="/p/:projectId/como-funciona"
          element={<PlaceholderPage area="project-overview" />}
        />
        <Route path="/no/*" element={<RoleRoute role="NO_ADMIN" />}>
          <Route path="projetos" element={<PlaceholderPage area="admin-projects" />} />
        </Route>
      </Route>
      <Route path="/nao-autorizado" element={<UnauthorizedPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
