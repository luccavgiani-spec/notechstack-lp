import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(process.cwd(), '..')
const gazetaPath = path.resolve(projectRoot, '..', 'gazeta_bragantina', 'painel-controle', 'index.html')
const helloDeliverablePath = path.resolve(projectRoot, 'home-no-prototipo', 'hello-deliverable.js')
const helloRoadmapPath = path.resolve(projectRoot, 'home-no-prototipo', 'work', 'hello-best', 'roadmap.md')

function readFases() {
  const source = fs.readFileSync(gazetaPath, 'utf8')
  const start = source.indexOf('var FASES = [')
  const endMarker = '\n  ];'
  const end = source.indexOf(endMarker, start)
  if (start < 0 || end < 0) throw new Error('FASES não encontrada')
  return vm.runInNewContext(
    `(${source.slice(start + 'var FASES = '.length, end + endMarker.length - 1)})`,
    Object.create(null),
  ) as Array<{ id: string; nome: string; tarefas: Array<{ id: string; titulo: string; semana: number; checked: boolean }> }>
}

describe('pipeline examples seed sources', () => {
  it('C4 Gazeta matches FASES source', () => {
    const fases = readFases()
    const expectedPhases = [
      'Fase 0 · Preparação',
      'Fase 1 · Frontend',
      'Fase 2 · Migração e Backup',
      'Fase 3 · Editorial e Backend',
      'Fase 4 · Go-live',
    ]
    const items = fases.flatMap((phase) => phase.tarefas.map((task, position) => ({
      id: task.id,
      title: task.titulo,
      phase: phase.nome,
      week: task.semana,
      checked: task.checked,
      position,
    })))

    expect(fases.map((phase) => phase.nome)).toEqual(expectedPhases)
    expect(items).toHaveLength(27)
    expect(items.filter((item) => item.checked)).toHaveLength(17)
    expect(new Set(items.map((item) => item.id)).size).toBe(27)
    expect(items.at(0)).toMatchObject({
      id: 'f0-1',
      title: 'Acessos ao ambiente atual (WordPress, DNS, hospedagem, e-mail)',
      phase: expectedPhases[0],
      week: 1,
      checked: true,
      position: 0,
    })
    expect(items.at(-1)).toMatchObject({
      id: 'f4-4',
      title: 'Início dos 60 dias de suporte pós-entrega',
      phase: expectedPhases[4],
      week: 9,
      checked: false,
      position: 3,
    })
  })

  it('C5 Hello Best roadmap and placeholder tiers', () => {
    const deliverable = fs.readFileSync(helloDeliverablePath, 'utf8')
    const roadmap = fs.readFileSync(helloRoadmapPath, 'utf8')
    expect(deliverable).toContain('GITHUB')
    expect(deliverable).toContain('SUPABASE')
    expect(deliverable).toContain('VERCEL')
    expect(roadmap).toContain('Chat 1:1 entre bests conectadas')
    expect(roadmap).toContain('Edição do perfil em tela dedicada')
    expect(roadmap).toContain('Posts da comunidade com dados reais')
    expect({ essencial: 'a preencher', basico: 'a preencher', completo: 'a preencher' })
      .toEqual({ essencial: 'a preencher', basico: 'a preencher', completo: 'a preencher' })
    expect('https://hello-best.lovable.app').toBe('https://hello-best.lovable.app')
  })
})
