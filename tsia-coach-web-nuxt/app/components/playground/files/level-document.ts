import type { SceneSnapshot } from '~/components/rod/scene/scene-snapshot'
import type { SceneResult } from '~/components/rod/scene/rod.scene.types'
import type { GoalAdapter, Validation } from '../goals/goal.types'
import { levelDocumentSchema, type BoardDescriptor, type LevelDocumentV1 } from './level-document.schema'
export type { BoardDescriptor, LevelDocumentV1 } from './level-document.schema'
export type LevelDocumentAdapter = {
  board: BoardDescriptor
  goals: GoalAdapter
  validateSnapshot: (snapshot: SceneSnapshot) => SceneResult
}
function sameBoard(a: BoardDescriptor, b: BoardDescriptor): boolean {
  switch (a.kind) {
    case 'bar': return b.kind === 'bar' && a.config.columns === b.config.columns && a.config.targetCount === b.config.targetCount
    case 'array': return b.kind === 'array' && a.config.columns === b.config.columns && a.config.rows === b.config.rows
    case 'fraction': return b.kind === 'fraction' && a.config.columns === b.config.columns && a.config.pairCount === b.config.pairCount
    case 'mathtabla': return b.kind === 'mathtabla' && a.config.centralColumns === b.config.centralColumns && a.config.centralRows === b.config.centralRows
  }
}
/** Parse the entire document and all later steps before returning fresh, owned data. */
export function validateLevelDocument(input: unknown, adapter: LevelDocumentAdapter): Validation<LevelDocumentV1> {
  const parsed = levelDocumentSchema.safeParse(input)
  if (!parsed.success) return { allowed: false, reason: parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') }
  const document = parsed.data
  if (!sameBoard(document.board, adapter.board)) return { allowed: false, reason: 'Board kind or configuration does not match this playground.' }
  const stepIds = new Set<string>()
  for (const step of document.steps) {
    if (stepIds.has(step.id)) return { allowed: false, reason: 'Duplicate step ID.' }
    stepIds.add(step.id)
    if (new Set(step.trains.map(train => train.id)).size !== step.trains.length) return { allowed: false, reason: `Step ${step.id}: duplicate train ID.` }
    const scene = adapter.validateSnapshot(step.trains)
    if (!scene.allowed) return { allowed: false, reason: `Step ${step.id}: ${scene.reason}` }
    if (step.goal !== null) {
      const goal = adapter.goals.parse(step.goal)
      if (!goal.allowed) return { allowed: false, reason: `Step ${step.id}: ${goal.reason}` }
      step.goal = goal.value
    }
  }
  return { allowed: true, value: document }
}
