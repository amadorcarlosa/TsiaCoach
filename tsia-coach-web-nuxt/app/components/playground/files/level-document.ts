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
    // The activity is part of the board's identity: a fraction-multiplication
    // level may contain layered overlaps that the area activity rejects, so it
    // must not load into one. The scene check below then runs under the right
    // mode rather than reinterpreting the file.
    case 'mathtabla': return b.kind === 'mathtabla' && a.config.centralColumns === b.config.centralColumns && a.config.centralRows === b.config.centralRows && a.config.activity === b.config.activity
  }
}
/** Only the activity differs: say so, rather than blaming the board size. */
function activityMismatch(document: BoardDescriptor, playground: BoardDescriptor): string {
  if (
    document.kind !== 'mathtabla' || playground.kind !== 'mathtabla' ||
    document.config.centralColumns !== playground.config.centralColumns ||
    document.config.centralRows !== playground.config.centralRows
  ) return 'Board kind or configuration does not match this playground.'

  const name = (board: Extract<BoardDescriptor, { kind: 'mathtabla' }>) =>
    board.config.activity ?? 'area'

  return `This level was authored for the ${name(document)} activity, ` +
    `and MathTabla is in the ${name(playground)} activity. Switch activity before importing it.`
}

/** Parse the entire document and all later steps before returning fresh, owned data. */
export function validateLevelDocument(input: unknown, adapter: LevelDocumentAdapter): Validation<LevelDocumentV1> {
  const parsed = levelDocumentSchema.safeParse(input)
  if (!parsed.success) return { allowed: false, reason: parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') }
  const document = parsed.data
  if (!sameBoard(document.board, adapter.board)) {
    return { allowed: false, reason: activityMismatch(document.board, adapter.board) }
  }
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
