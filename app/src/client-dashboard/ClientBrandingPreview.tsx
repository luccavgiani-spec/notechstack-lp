import { useParams } from 'react-router-dom'
import { ClientDashboardPage } from './ClientDashboardPage'
import type { DashboardData, ModuleKey } from './client-dashboard-service'

// Developer-only presentation of the real dashboard. No database records or memberships.
const preview: DashboardData = {
  agency: { name: 'Maisis Publicidade', logoUrl: '/agencies/maisis/logo.png' },
  shell: {
    project_id: 'visual-preview', project_name: 'Prévia do painel do cliente',
    effective_access_status: 'ATIVO_ATE_FIM_DO_PROJETO', access_released_at: null,
    modules: { como_funciona: 'ativo', etapas: 'ativo', prototipo: 'bloqueado', editor: 'bloqueado', versoes: 'bloqueado', marca: 'bloqueado' },
  },
  roadmap: null, kanban: [], versions: [],
}
const modules: Record<string, ModuleKey> = {
  'como-funciona': 'como_funciona', etapas: 'etapas', prototipo: 'prototipo',
  editor: 'editor', versoes: 'versoes', marca: 'marca',
}
export default function ClientBrandingPreview() {
  const { module = 'etapas' } = useParams()
  return <ClientDashboardPage module={modules[module] ?? 'etapas'} previewData={preview} />
}
