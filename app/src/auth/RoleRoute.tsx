import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { sessionAal } from './aal'
import { useAuth } from './auth-context'

export type Role = 'NO_ADMIN' | 'MARKETING_AGENT'

type RoleRouteProps = {
  roles: Role[]
  // Exige o segundo fator (aal2) das contas NO_ADMIN, as únicas com MFA.
  requireAal2?: boolean
}

export function RoleRoute({ roles, requireAal2 = false }: RoleRouteProps) {
  const { session } = useAuth()
  const location = useLocation()
  const currentRole = session?.user.app_metadata.role

  if (!roles.includes(currentRole)) {
    return <Navigate to="/nao-autorizado" replace />
  }

  if (requireAal2 && currentRole === 'NO_ADMIN' && sessionAal(session) !== 'aal2') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}`, mfa: true }} />
  }

  return <Outlet />
}
