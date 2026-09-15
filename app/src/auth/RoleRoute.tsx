import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './auth-context'

type RoleRouteProps = {
  role: 'NO_ADMIN'
}

export function RoleRoute({ role }: RoleRouteProps) {
  const { session } = useAuth()
  const currentRole = session?.user.app_metadata.role

  if (currentRole !== role) {
    return <Navigate to="/nao-autorizado" replace />
  }

  return <Outlet />
}
