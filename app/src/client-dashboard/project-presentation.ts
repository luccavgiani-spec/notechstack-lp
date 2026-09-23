import type { JsonValue, Roadmap } from './client-dashboard-service'

export function record(value: JsonValue | undefined): Record<string, JsonValue> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}
export function text(value: JsonValue | undefined, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export type ArchitectureNode = { id: string; brand: string; title: string; tool: string; detail: string; href: string }
export type Architecture = { title: string; description: string; caption: string; inputs: ArchitectureNode[]; services: ArchitectureNode[]; core: ArchitectureNode }
function isNode(value: JsonValue): value is ArchitectureNode {
  const node = record(value)
  return ['id', 'brand', 'title', 'tool', 'detail', 'href'].every((key) => typeof node[key] === 'string')
    && /^[a-z0-9-]+$/.test(String(node.id)) && /^[a-z0-9-]*$/.test(String(node.brand)) && /^https:\/\//.test(String(node.href))
}
export function projectArchitecture(roadmap: Roadmap | null): Architecture | null {
  const value = record(record(roadmap?.stack).architecture)
  if (!Array.isArray(value.inputs) || !Array.isArray(value.services) || !value.core
    || !value.inputs.every(isNode) || !value.services.every(isNode) || !isNode(value.core)) return null
  return { title: text(value.title), description: text(value.description), caption: text(value.caption), inputs: value.inputs, services: value.services, core: value.core }
}
export function projectPresentation(roadmap: Roadmap | null) {
  return record(record(roadmap?.next_steps).presentation)
}
