import { ProjectDetail } from './AgencyConsolePage'
import type { AgencyDetail, AgencyProject } from './agency-service'
import tasks from './agency-preview-tasks.json'
import deliveries from '../../onboarding/gazeta-delivery-history.json'

// Development-only snapshot of the documented onboarding, never a database seed.
const detail: AgencyDetail = {
  tasks,
  versions: [...deliveries].reverse().map(delivery => ({
    id: `preview-${delivery.label}`, label: delivery.label,
    changelog: `${delivery.title} — ${delivery.changelog}`,
    publishedAt: `${delivery.date}T12:00:00-03:00`, current: delivery.current,
  })),
}
const project: AgencyProject = {
  id: 'preview', name: 'Portal Gazeta Bragantina', clientId: 'preview',
  clientName: 'Gazeta Bragantina', status: 'EM_REVISAO_CLIENTE',
  startedOn: '2026-07-22', deliveryFrom: '2026-09-09', deliveryTo: '2026-09-23',
  deliveryNote: 'Prazo combinado: 7–9 semanas desde o início', reviewLabel: 'Versão final em análise',
  updatedAt: '2026-09-23', nextDate: null, totalTasks: tasks.length,
  doneTasks: tasks.filter(task => task.status === 'concluido').length, overdueTasks: 0,
}

export default function AgencyProjectPreview() {
  return <main className="ac-app">
    <img className="ac-colorbar" src="/barra-topo-4-cores.svg" alt="" />
    <ProjectDetail agencyId="preview" project={project} previewDetail={detail}
      toolbar={<span className="ac-agency-name">Maisis · prévia local</span>} />
  </main>
}
