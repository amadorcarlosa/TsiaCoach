import type { DeepReadonly } from 'vue'
import type { PlaygroundEventData, PlaygroundName, SceneSummary } from '#shared/effect/playground-events'
import type { PlaygroundEventDraft, PlaygroundRecorder } from '~/effect/playground-events'
import type { AlgebraTile } from '~/components/algebratiles/algebra-tile.types'
import { baseTenCatalog, type BaseTenBlock } from '~/components/basetenblocks/base10.types'
import type { RodTrain, SceneAction } from '~/components/rod/scene/rod.scene.types'
import type { AlgebraTileAction } from '~/composables/useAlgebraTileScene'
import type { BaseTenAction } from '~/composables/useBaseTenScene'

/**
 * Translates committed scene actions into allowlisted events. Each describer
 * sees the selection as it was before the action and the scene after it, and
 * returns null for actions that changed nothing a coach would care about.
 */

type Result = { allowed: true; createdIds?: readonly string[] } | { allowed: false; reason: string }
type Outcome = Pick<PlaygroundEventDraft, 'outcome' | 'reason'>

function outcomeOf(result: Result): Outcome {
  return result.allowed ? { outcome: 'applied' } : { outcome: 'rejected', reason: result.reason.slice(0, 200) }
}

function countBy(keys: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const key of keys) counts[key] = (counts[key] ?? 0) + 1
  return counts
}

const isZero = (delta: { x: number; y: number }) => delta.x === 0 && delta.y === 0
const ids = (values: readonly string[]) => values.slice(0, 100)

// ---- Rods ---------------------------------------------------------------------

type Train = DeepReadonly<RodTrain>

export function rodKind(train: Train): string {
  const total = train.parts.reduce((sum, part) => sum + part.value * (part.sign ?? 1), 0)
  const name = train.parts.length === 1 ? 'rod' : 'train'
  return total < 0 ? `${name}-neg-${-total}` : `${name}-${total}`
}

export function rodSceneSummary(trains: readonly Train[]): SceneSummary {
  const summary: Record<string, number> = { trains: trains.length, total: 0 }
  for (const train of trains) {
    for (const part of train.parts) {
      const key = part.sign === -1 ? `rod-neg-${part.value}` : `rod-${part.value}`
      summary[key] = (summary[key] ?? 0) + 1
      summary.total! += part.value * (part.sign ?? 1)
    }
  }
  return summary
}

const transformTypes: Record<string, string> = {
  'count-exchange': 'denomination.converted',
  'count-arrange': 'arrange.x-then-y',
}

function rodEventType(action: SceneAction): string | null {
  switch (action.type) {
    case 'create': return 'piece.created'
    case 'move': return isZero(action.delta) ? null : 'piece.moved'
    case 'delete': return 'piece.deleted'
    case 'clone': return 'piece.duplicated'
    case 'make-train': return 'rods.grouped'
    case 'ungroup': return 'rods.ungrouped'
    case 'cancel-zero-pair': return 'zero-pair.cancelled'
    case 'set-orientation': return 'rotated'
    case 'set-material-role': return 'material-role.changed'
    case 'board-transform': return transformTypes[action.transform.name] ?? 'board.transformed'
    default: return action.type
  }
}

function rodActionData(action: SceneAction): PlaygroundEventData {
  switch (action.type) {
    case 'create': return {
      value: action.value,
      ...(action.sign === -1 ? { sign: 'negative' as const } : {}),
      ...(action.materialRole ? { materialRole: action.materialRole } : {}),
    }
    case 'move': return { delta: { ...action.delta } }
    case 'make-rectangle': return { shape: { width: action.shape.columns, depth: action.shape.rows } }
    case 'regroup-factors': return action.shape ? { shape: { width: action.shape.columns, depth: action.shape.rows } } : {}
    case 'regroup-addends': return action.pair ? { values: [...action.pair] } : {}
    case 'regroup-area': return { variant: action.grouping }
    case 'set-orientation': return { orientation: action.orientation }
    case 'set-material-role': return { materialRole: action.materialRole }
    case 'board-transform': return { variant: action.transform.name.slice(0, 64) }
    default: return {}
  }
}

export function describeRodAction(
  selected: readonly Train[],
  action: SceneAction,
  result: Result,
  after: readonly Train[],
): PlaygroundEventDraft | null {
  const type = rodEventType(action)
  if (!type) return null
  return {
    type,
    ...outcomeOf(result),
    data: {
      ...(selected.length ? { pieceIds: ids(selected.map(train => train.id)), pieceKinds: ids(selected.map(rodKind)) } : {}),
      ...(result.allowed && result.createdIds?.length ? { createdIds: ids(result.createdIds) } : {}),
      ...rodActionData(action),
    },
    sceneSummary: rodSceneSummary(after),
  }
}

// ---- Base ten -----------------------------------------------------------------

export function baseTenSceneSummary(blocks: readonly DeepReadonly<BaseTenBlock>[]): SceneSummary {
  return {
    ...countBy(blocks.map(block => block.denomination)),
    blocks: blocks.length,
    total: blocks.reduce((sum, block) => sum + baseTenCatalog[block.denomination].value, 0),
  }
}

const baseTenTypes: Record<BaseTenAction['type'], string> = {
  'create': 'block.placed',
  'move': 'block.moved',
  'delete': 'block.deleted',
  'rotate': 'block.rotated',
  'set-pose': 'block.rotated',
  'clone': 'block.duplicated',
  'exchange-up': 'exchange.regrouped',
  'exchange-down': 'exchange.regrouped',
}

export function describeBaseTenAction(
  selected: readonly DeepReadonly<BaseTenBlock>[],
  action: BaseTenAction,
  result: Result,
  after: { blocks: readonly DeepReadonly<BaseTenBlock>[]; createdIds: readonly string[] },
): PlaygroundEventDraft | null {
  if (action.type === 'move' && isZero(action.delta)) return null
  return {
    type: baseTenTypes[action.type],
    ...outcomeOf(result),
    data: {
      ...(selected.length ? { pieceIds: ids(selected.map(block => block.id)), pieceKinds: ids(selected.map(block => block.denomination)) } : {}),
      ...(result.allowed && after.createdIds.length ? { createdIds: ids(after.createdIds) } : {}),
      ...(action.type === 'create' ? { denomination: action.denomination } : {}),
      ...(action.type === 'move' ? { delta: { ...action.delta } } : {}),
      ...(action.type === 'set-pose' ? { pose: action.pose } : {}),
      ...(action.type === 'exchange-up' ? { variant: 'up' } : action.type === 'exchange-down' ? { variant: 'down' } : {}),
    },
    sceneSummary: baseTenSceneSummary(after.blocks),
  }
}

// ---- Algebra tiles ------------------------------------------------------------

export const tileKind = (tile: DeepReadonly<AlgebraTile>) => tile.sign === 'negative' ? `${tile.term}.neg` : tile.term

export function algebraTileSceneSummary(
  tiles: readonly DeepReadonly<AlgebraTile>[],
  coefficients: Readonly<Record<string, number>>,
): SceneSummary {
  return { ...coefficients, tiles: tiles.length }
}

const algebraTileTypes: Record<AlgebraTileAction['type'], string> = {
  'create': 'tile.added',
  'move': 'tile.moved',
  'rotate': 'tile.rotated',
  'clone': 'tile.duplicated',
  'delete': 'tile.deleted',
  'flip-sign': 'tile.sign-flipped',
  'remove-zero-pairs': 'zero-pair.cancelled',
}

export function describeAlgebraTileAction(
  selected: readonly DeepReadonly<AlgebraTile>[],
  action: AlgebraTileAction,
  result: Result,
  after: { tiles: readonly DeepReadonly<AlgebraTile>[]; coefficients: Readonly<Record<string, number>>; createdIds: readonly string[] },
): PlaygroundEventDraft | null {
  if (action.type === 'move' && isZero(action.delta)) return null
  const removed = action.type === 'remove-zero-pairs' && result.allowed
    ? selected.filter(tile => !after.tiles.some(other => other.id === tile.id)).length
    : 0
  return {
    type: algebraTileTypes[action.type],
    ...outcomeOf(result),
    data: {
      ...(selected.length ? { pieceIds: ids(selected.map(tile => tile.id)), pieceKinds: ids(selected.map(tileKind)) } : {}),
      ...(result.allowed && after.createdIds.length ? { createdIds: ids(after.createdIds) } : {}),
      ...(action.type === 'create' ? { term: action.term, sign: action.sign } : {}),
      ...(action.type === 'move' ? { delta: { ...action.delta } } : {}),
      ...(removed ? { count: removed } : {}),
    },
    sceneSummary: algebraTileSceneSummary(after.tiles, after.coefficients),
  }
}

// ---- Wiring -------------------------------------------------------------------

/** Lets a playground record its own events and fold several scene edits into one. */
/** An action as the coach sees it in a board capture: what happened, never who. */
export type RecentAction = PlaygroundEventDraft & { at: string }

export const RECENT_ACTION_LIMIT = 20

export interface SceneEvents {
  record(draft: PlaygroundEventDraft): void
  /** The last actions on this scene, oldest first. Kept in memory even when the log is off. */
  recent(): readonly RecentAction[]
  /**
   * Runs `run` with per-edit recording paused, then records one event, such
   * as "added 3 x rods" in place of three creations.
   */
  during<T>(run: () => T, describe: (value: T) => PlaygroundEventDraft | null): T
  /**
   * Adds playground state, such as equation checks, to every later event's
   * summary, read after the action. Its keys win over the scene's own.
   */
  addSummary(extra: () => SceneSummary): void
}

/** Records nothing; used when the log is off. */
export const silentSceneEvents: SceneEvents = {
  record() {},
  recent: () => [],
  during: run => run(),
  addSummary() {},
}

const MAX_SUMMARY_KEYS = 40

/** The playground's keys first, then the scene's, within the schema's key limit. */
function mergeSummary(base: SceneSummary | undefined, extra: SceneSummary): SceneSummary {
  const merged: Record<string, number> = { ...extra }
  for (const [key, value] of Object.entries(base ?? {})) {
    if (Object.keys(merged).length >= MAX_SUMMARY_KEYS) break
    if (!(key in merged)) merged[key] = value
  }
  return merged
}

type Scene<Item, Action, R extends Result> = {
  apply(ids: readonly string[], action: Action): R
  selection: { readonly value: ReadonlySet<string> }
} & ({ trains: { readonly value: readonly Item[] } } | { tiles: { readonly value: readonly Item[] } } | { blocks: { readonly value: readonly Item[] } })

export type ActionContext<Item> = {
  /** The acted-on items as they were before the action. */
  selected: readonly Item[]
  /** Items present after the action that were not there before. */
  created: readonly string[]
}

/**
 * Wraps a scene's `apply` so every committed or refused action is recorded.
 * The scene itself is untouched; callers use the returned copy.
 */
export function recordSceneActions<Item extends { id: string }, Action, R extends Result, S extends Scene<Item, Action, R>>(
  scene: S,
  recorder: PlaygroundRecorder | null,
  describe: (context: ActionContext<Item>, action: Action, result: R, scene: S) => PlaygroundEventDraft | null,
  /** Fills in the scene summary for events the playground records itself. */
  summarize?: () => SceneSummary,
): S & { events: SceneEvents } {
  const items = (): readonly Item[] =>
    'trains' in scene ? scene.trains.value : 'tiles' in scene ? scene.tiles.value : scene.blocks.value
  let paused = 0
  const history: RecentAction[] = []
  const extras: (() => SceneSummary)[] = []
  const record = (draft: PlaygroundEventDraft | null) => {
    if (!draft) return
    try {
      let complete = draft.sceneSummary || !summarize ? draft : { ...draft, sceneSummary: summarize() }
      for (const extra of extras) {
        try { complete = { ...complete, sceneSummary: mergeSummary(complete.sceneSummary, extra()) } } catch { /* Keep the event. */ }
      }
      history.push({ ...complete, at: new Date().toISOString() })
      if (history.length > RECENT_ACTION_LIMIT) history.shift()
      recorder?.record(complete)
    } catch { /* Never break the playground. */ }
  }
  const events: SceneEvents = {
    record,
    recent: () => history.map(action => structuredClone(action)),
    during(run, describe) {
      paused++
      let value
      try { value = run() } finally { paused-- }
      try { record(describe(value)) } catch { /* Never break the playground. */ }
      return value
    },
    addSummary(extra) {
      extras.push(extra)
    },
  }
  return {
    ...scene,
    events,
    apply(ids: readonly string[], action: Action): R {
      if (paused) return scene.apply(ids, action)
      const before = items()
      const wanted = new Set(ids)
      const selected = before.filter(item => wanted.has(item.id))
      const result = scene.apply(ids, action)
      try {
        const existing = new Set(before.map(item => item.id))
        const created = result.allowed ? items().filter(item => !existing.has(item.id)).map(item => item.id) : []
        record(describe({ selected, created }, action, result, scene))
      } catch { /* Never break the playground. */ }
      return result
    },
  } as unknown as S & { events: SceneEvents }
}

export type RodSceneLike = Scene<Train, SceneAction, Result> & { trains: { readonly value: readonly Train[] } }
export type BaseTenSceneLike = Scene<DeepReadonly<BaseTenBlock>, BaseTenAction, Result> & { blocks: { readonly value: readonly DeepReadonly<BaseTenBlock>[] } }
export type AlgebraTileSceneLike = Scene<DeepReadonly<AlgebraTile>, AlgebraTileAction, Result> & {
  tiles: { readonly value: readonly DeepReadonly<AlgebraTile>[] }
  coefficients: { readonly value: Readonly<Record<string, number>> }
}
export type RodPlaygroundName = Exclude<PlaygroundName, 'base-ten' | 'algebra-tiles' | 'scaffold'>

/** Picks the describer for a playground's scene family. */
export function recordPlaygroundScene<S extends AlgebraTileSceneLike>(scene: S, playground: 'algebra-tiles', recorder: PlaygroundRecorder | null): S & { events: SceneEvents }
export function recordPlaygroundScene<S extends BaseTenSceneLike>(scene: S, playground: 'base-ten', recorder: PlaygroundRecorder | null): S & { events: SceneEvents }
export function recordPlaygroundScene<S extends RodSceneLike>(scene: S, playground: RodPlaygroundName, recorder: PlaygroundRecorder | null): S & { events: SceneEvents }
export function recordPlaygroundScene(scene: unknown, playground: PlaygroundName, recorder: PlaygroundRecorder | null): unknown {
  if (playground === 'algebra-tiles') {
    const tiles = scene as AlgebraTileSceneLike
    return recordSceneActions(tiles, recorder, ({ selected, created }, action: AlgebraTileAction, result) =>
      describeAlgebraTileAction(selected as readonly DeepReadonly<AlgebraTile>[], action, result, { tiles: tiles.tiles.value, coefficients: tiles.coefficients.value, createdIds: created }),
    () => algebraTileSceneSummary(tiles.tiles.value, tiles.coefficients.value))
  }
  if (playground === 'base-ten') {
    const blocks = scene as BaseTenSceneLike
    return recordSceneActions(blocks, recorder, ({ selected, created }, action: BaseTenAction, result) =>
      describeBaseTenAction(selected as readonly DeepReadonly<BaseTenBlock>[], action, result, { blocks: blocks.blocks.value, createdIds: created }),
    () => baseTenSceneSummary(blocks.blocks.value))
  }
  const rods = scene as RodSceneLike
  return recordSceneActions(rods, recorder, ({ selected }, action: SceneAction, result) =>
    describeRodAction(selected as readonly Train[], action, result, rods.trains.value),
  () => rodSceneSummary(rods.trains.value))
}
