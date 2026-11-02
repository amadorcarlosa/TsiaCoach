import type { SceneSnapshot } from '~/components/rod/scene/scene-snapshot'
import type { SceneResult } from '~/components/rod/scene/rod.scene.types'
import type { GoalAdapter, Validation } from '../goals/goal.types'
import { levelDocumentSchema, type BoardDescriptor, type LevelDocumentV1 } from './level-document.schema'
import type { SystemsBoardConfig } from '~/components/systems/systems.schema'
import { equationText } from '~/components/systems/systems.geometry'

/** Field-by-field, so key order in a hand-written file never matters. */
function sameSystem(a: SystemsBoardConfig, b: SystemsBoardConfig): boolean {
  return a.laneColumns === b.laneColumns && a.regionGapRows === b.regionGapRows &&
    a.system.equations.every((equation, index) => {
      const other = b.system.equations[index]
      return other !== undefined && equation.id === other.id && equation.targetArea === other.targetArea &&
        equation.coefficients.x === other.coefficients.x && equation.coefficients.y === other.coefficients.y
    })
}
export type { BoardDescriptor, LevelDocumentV1 } from './level-document.schema'
export type LevelDocumentAdapter = {
  board: BoardDescriptor
  goals: GoalAdapter
  validateSnapshot: (snapshot: SceneSnapshot) => SceneResult
}
export function sameBoard(a: BoardDescriptor, b: BoardDescriptor): boolean {
  switch (a.kind) {
    case 'bar': return b.kind === 'bar' && a.config.columns === b.config.columns && a.config.targetCount === b.config.targetCount
    case 'array': return b.kind === 'array' && a.config.columns === b.config.columns && a.config.rows === b.config.rows
    case 'fraction': return b.kind === 'fraction' && a.config.columns === b.config.columns && a.config.pairCount === b.config.pairCount
    // The activity is part of the board's identity: a fraction-multiplication
    // level may contain layered overlaps that the area activity rejects, so it
    // must not load into one. The scene check below then runs under the right
    // mode rather than reinterpreting the file.
    case 'mathtabla': return b.kind === 'mathtabla' && a.config.centralColumns === b.config.centralColumns && a.config.centralRows === b.config.centralRows && a.config.activity === b.config.activity
    case 'systems': return b.kind === 'systems' && sameSystem(a.config, b.config)
  }
}
/** Names a board's kind and configuration, e.g. "an array board (100 columns, 100 rows)". */
function describeBoard(board: BoardDescriptor): string {
  if (board.kind === 'systems') {
    return `a systems of equations board (${board.config.system.equations.map(equationText).join('; ')}, ` +
      `${board.config.laneColumns} columns per row)`
  }
  const settings = Object.entries(board.config)
    .map(([key, value]) => `${value} ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`)
    .join(', ')
  const article = /^[aeiou]/.test(board.kind) ? 'an' : 'a'
  return `${article} ${board.kind} board (${settings})`
}
/** Only the activity differs: say so, rather than blaming the board size. */
function activityMismatch(document: BoardDescriptor, playground: BoardDescriptor): string {
  if (
    document.kind !== 'mathtabla' || playground.kind !== 'mathtabla' ||
    document.config.centralColumns !== playground.config.centralColumns ||
    document.config.centralRows !== playground.config.centralRows
  ) return `This level was made for ${describeBoard(document)}, but this playground is ${describeBoard(playground)}.`

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
