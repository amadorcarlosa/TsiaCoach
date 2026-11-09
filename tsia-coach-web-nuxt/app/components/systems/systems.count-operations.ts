import type { DeepReadonly } from 'vue'
import type { BoardTransform, RodTrain } from '~/components/rod/scene/rod.scene.types'
import { copyScene } from '~/components/rod/scene/scene-snapshot'
import { trainFitsRegion } from '~/components/rod/scene/scene-regions'
import { checkEquation, exchangeStep, type CandidateCounts } from './systems.candidates'
import { evaluateCountSystem } from './systems.count-evaluate'
import { canonicalSlots, countLayout, unitTrain, type CountUnit } from './systems.count-layout'
import type { SystemsBoardConfig, VariableId } from './systems.schema'

/**
 * Pure planners for rod-count commands. Like the row-length planners they
 * return removals, additions and wording; the scene replans them at commit
 * against its current trains and assigns IDs.
 */

export type CountTransformName = 'count-exchange' | 'count-arrange'

export type CountPlanDetail = {
  /** Trains the learner chose to exchange. */
  exchanged: readonly string[]
  /** Trains that only slide to a canonical slot. */
  movedFrom: readonly string[]
  /** New y rods the exchange creates (before IDs are assigned). */
  added: readonly RodTrain[]
  /** Units that only change place. */
  moved: readonly RodTrain[]
  next: CandidateCounts
}

export type CountPlan = {
  remove: readonly string[]
  add: RodTrain[]
  title: string
  lines: readonly string[]
  conserves: boolean
  key: string
  detail: CountPlanDetail
}

export type CountPlanResult = { allowed: true; plan: CountPlan } | { allowed: false; reason: string }

type Snapshot = readonly DeepReadonly<RodTrain>[]

export const countReasons = {
  notCandidate: 'Make Equation 1 hold with whole, upright x and y rods first.',
  solved: 'Both equations already hold: this is the common solution.',
  stale: 'The rods changed. Open the preview again.',
  select: 'Select existing rods first.',
  unassigned: 'Move or remove the unassigned material first.',
  arranged: 'The rods already stand x first, then y.',
  unknown: 'Unknown rod-count command.',
} as const

const reject = (reason: string): CountPlanResult => ({ allowed: false, reason })
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** Canonical form of every train on the learner band, for stale checks. */
function bandKey(config: SystemsBoardConfig, trains: Snapshot, transform: BoardTransform): string {
  const { upper } = countLayout(config)
  const inputs = trains.filter(train => trainFitsRegion(train, upper))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return JSON.stringify([copyScene(inputs), { name: transform.name, params: transform.params ?? null }])
}

/**
 * Lays the remaining units out canonically, keeping every train already in
 * place (same ID, same object) and re-adding only what must move.
 */
function arrange(
  config: SystemsBoardConfig,
  trains: Snapshot,
  remaining: readonly CountUnit[],
  removedTrainIds: ReadonlySet<string>,
  next: CandidateCounts,
  newY: number,
) {
  const layout = countLayout(config)
  const { x: a, y: b } = config.system.equations[0].coefficients
  const slots = canonicalSlots(layout, next)
  const atSlot = (unit: CountUnit) => unit.footprint.y === layout.upper.y && slots[unit.variable].includes(unit.footprint.x)

  const byTrain = new Map<string, CountUnit[]>()
  for (const unit of remaining) byTrain.set(unit.trainId, [...(byTrain.get(unit.trainId) ?? []), unit])

  const kept = new Set<string>()
  for (const train of trains) {
    if (removedTrainIds.has(train.id)) continue
    const units = byTrain.get(train.id)
    if (units && units.length === train.parts.length && units.every(atSlot)) kept.add(train.id)
  }
  const occupied = new Set(remaining.filter(unit => kept.has(unit.trainId)).map(unit => unit.footprint.x))
  const free = (variable: VariableId) => slots[variable].filter(column => !occupied.has(column))
  const freeX = free('x')
  const freeY = free('y')

  const moving = remaining.filter(unit => !kept.has(unit.trainId))
  const movingX = moving.filter(unit => unit.variable === 'x')
  const movingY = moving.filter(unit => unit.variable === 'y')
  if (movingX.length !== freeX.length || movingY.length + newY !== freeY.length) return null

  const moved = [
    ...movingX.map((_, index) => unitTrain(freeX[index]!, layout.upper.y, a)),
    ...movingY.map((_, index) => unitTrain(freeY[index]!, layout.upper.y, b)),
  ]
  const added = Array.from({ length: newY }, (_, index) => unitTrain(freeY[movingY.length + index]!, layout.upper.y, b))
  const movedFrom = [...new Set(moving.map(unit => unit.trainId))].filter(id => !removedTrainIds.has(id))
  return { moved, added, movedFrom }
}

export function planCountTransform(
  config: SystemsBoardConfig,
  trains: Snapshot,
  ids: readonly string[],
  transform: BoardTransform,
): CountPlanResult {
  const evaluation = evaluateCountSystem(config, trains)
  if (!evaluation.valid) return reject(evaluation.reason)
  const key = bandKey(config, trains, transform)
  const { x: a, y: b } = config.system.equations[0].coefficients
  const c = config.system.equations[0].targetArea

  switch (transform.name) {
    case 'count-exchange': {
      // Replaces only the conversion's source rods with upright y rods at the
      // validated positions; every other rod keeps its ID and place.
      const source = conversionSource(config, trains, ids)
      if (!source.allowed) return reject(source.reason)
      const { step, next } = source
      const positions = decodePlacements(transform.params)
      if (!positions || positions.length !== step.addedY) {
        return reject(`Place exactly ${plural(step.addedY, 'y rod')} (${b}-rods) to finish the conversion.`)
      }
      const added = positions.map(point => unitTrain(point.x, point.y, b))
      const selected = new Set(ids)
      const after = [...trains.filter(train => !selected.has(train.id)), ...added]
      const result = evaluateCountSystem(config, after)
      if (
        !result.valid || result.material.unassigned.length ||
        result.counts.xCount !== next.xCount || result.counts.yCount !== next.yCount || !result.upper.satisfied
      ) {
        return reject('The new y rods must stand upright inside Equation 1.')
      }
      return {
        allowed: true,
        plan: {
          remove: [...ids],
          add: added,
          title: 'Apply conversion',
          lines: [
            `${step.removedX} × ${a} = ${step.preservedArea} = ${step.addedY} × ${b}`,
            `x: ${source.counts.xCount} → ${next.xCount}     y: ${source.counts.yCount} → ${next.yCount}`,
            `${a}(${next.xCount}) + ${b}(${next.yCount}) = ${c}`,
          ],
          conserves: true,
          key,
          detail: { exchanged: [...ids], movedFrom: [], added, moved: [], next },
        },
      }
    }

    case 'count-arrange': {
      if (evaluation.material.unassigned.length) return reject(countReasons.unassigned)
      if (!evaluation.material.units.length) return reject('Add x and y rods first.')
      if (evaluation.canonical) return reject(countReasons.arranged)
      const layout = arrange(config, trains, evaluation.material.units, new Set(), evaluation.counts, 0)
      if (!layout) return reject('These rods cannot be laid out on the board.')
      return {
        allowed: true,
        plan: {
          remove: layout.movedFrom,
          add: layout.moved,
          title: 'Arrange x rods, then y rods',
          lines: [
            `Stand the ${plural(evaluation.counts.xCount, 'x rod')} side by side from the left, then the ${plural(evaluation.counts.yCount, 'y rod')}.`,
            'No rods are added or removed, so Equation 1 keeps its area.',
          ],
          conserves: true,
          key,
          detail: { exchanged: [], movedFrom: layout.movedFrom, added: [], moved: layout.moved, next: evaluation.counts },
        },
      }
    }

    default:
      return reject(countReasons.unknown)
  }
}

export type ConversionSource =
  | {
      allowed: true
      sourceIds: readonly string[]
      step: ReturnType<typeof exchangeStep>
      counts: CandidateCounts
      next: CandidateCounts
    }
  | { allowed: false; reason: string }

/**
 * Whether these trains can start an exchange. Selected whole x rods may
 * already be lying down for conversion; only that explicit selection gets
 * its source meaning back. All other material must remain whole upright
 * units, and the reconstructed source counts must satisfy Equation 1.
 * This never changes ordinary scene classification or takes part of a train.
 */
export function conversionSource(config: SystemsBoardConfig, trains: Snapshot, ids: readonly string[]): ConversionSource {
  const evaluation = evaluateCountSystem(config, trains)
  if (!evaluation.valid) return { allowed: false, reason: evaluation.reason }
  if (evaluation.solved) return { allowed: false, reason: countReasons.solved }
  const { x: a, y: b } = config.system.equations[0].coefficients
  const step = exchangeStep(a, b)
  const selected = new Set(ids)
  if (!ids.length || selected.size !== ids.length || ids.some(id => !trains.some(train => train.id === id))) {
    return { allowed: false, reason: countReasons.select }
  }
  const chosen = trains.filter(train => selected.has(train.id)).flatMap(train => train.parts)
  if (chosen.some(part => part.value !== a || part.orientation === 'tower')) {
    return { allowed: false, reason: `Select only x rods (${a}-rods) from Equation 1.` }
  }
  if (chosen.length !== step.removedX) {
    return { allowed: false, reason: `Select exactly ${plural(step.removedX, 'x rod')} (${a}-rods) to exchange; ${chosen.length} selected.` }
  }
  if (evaluation.material.unassigned.some(part => !selected.has(part.trainId))) {
    return { allowed: false, reason: countReasons.notCandidate }
  }
  const remaining = evaluation.material.units.filter(unit => !selected.has(unit.trainId))
  const counts = {
    xCount: remaining.filter(unit => unit.variable === 'x').length + chosen.length,
    yCount: remaining.filter(unit => unit.variable === 'y').length,
  }
  const [first, second] = config.system.equations
  if (counts.xCount < 1 || counts.yCount < 1 || !checkEquation(first, counts).satisfied) {
    return { allowed: false, reason: countReasons.notCandidate }
  }
  if (checkEquation(second, counts).satisfied) return { allowed: false, reason: countReasons.solved }
  const next = { xCount: counts.xCount - step.removedX, yCount: counts.yCount + step.addedY }
  if (next.xCount < 1) return { allowed: false, reason: `Exchanging ${plural(step.removedX, 'x rod')} would leave no x rods.` }
  return { allowed: true, sourceIds: [...ids], step, counts, next }
}

/** Board cells where new upright y rods stand, as board-transform parameters. */
export function encodePlacements(points: readonly { x: number; y: number }[]): Record<string, number> {
  return Object.fromEntries([['count', points.length], ...points.flatMap((point, index) => [[`x${index}`, point.x], [`y${index}`, point.y]])])
}

/** Integer placements only; anything else is rejected rather than coerced. */
export function decodePlacements(params: Readonly<Record<string, number>> | undefined): { x: number; y: number }[] | null {
  const count = params?.count
  if (!params || !Number.isSafeInteger(count) || count! < 0 || count! > 100) return null
  const points: { x: number; y: number }[] = []
  for (let index = 0; index < count!; index++) {
    const x = params[`x${index}`]
    const y = params[`y${index}`]
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return null
    points.push({ x: x!, y: y! })
  }
  return points
}

/**
 * Where a rectangle-and-group conversion of these sources ends up by default:
 * the y rods right-aligned in the sources' columns, standing at the top.
 */
export function defaultPlacements(config: SystemsBoardConfig, trains: Snapshot, ids: readonly string[]): { x: number; y: number }[] {
  const { upper } = countLayout(config)
  const step = exchangeStep(config.system.equations[0].coefficients.x, config.system.equations[0].coefficients.y)
  const right = Math.max(...trains.filter(train => ids.includes(train.id))
    .flatMap(train => train.parts.map(part => train.anchor.x + part.offset.x)))
  return Array.from({ length: step.addedY }, (_, index) => ({ x: right - step.addedY + 1 + index, y: upper.y }))
}

/**
 * The trains to select for one exchange: the rightmost x rods, as whole
 * trains whose units add up to exactly the exchange size. Null when the
 * current trains cannot give an exact selection.
 */
export function exchangeSelection(config: SystemsBoardConfig, trains: Snapshot): { ids: string[] } | { reason: string } {
  const evaluation = evaluateCountSystem(config, trains)
  if (!evaluation.valid) return { reason: evaluation.reason }
  if (!evaluation.candidate) return { reason: countReasons.notCandidate }
  if (evaluation.solved) return { reason: countReasons.solved }
  const { x: a, y: b } = config.system.equations[0].coefficients
  const step = exchangeStep(a, b)
  const units = evaluation.material.units
  const pureX = trains
    .filter(train => {
      const own = units.filter(unit => unit.trainId === train.id)
      return own.length > 0 && own.length === train.parts.length && own.every(unit => unit.variable === 'x')
    })
    .map(train => ({
      id: train.id,
      size: train.parts.length,
      right: Math.max(...units.filter(unit => unit.trainId === train.id).map(unit => unit.footprint.x)),
    }))
    .sort((p, q) => q.right - p.right)
  const ids: string[] = []
  let total = 0
  for (const item of pureX) {
    if (total + item.size > step.removedX) continue
    ids.push(item.id)
    total += item.size
    if (total === step.removedX) break
  }
  if (total !== step.removedX) return { reason: `Separate the x rods so exactly ${step.removedX} can be selected.` }
  if (evaluation.counts.xCount - step.removedX < 1) return { reason: 'An exchange would leave no x rods.' }
  return { ids }
}

/** Units in the current selection, counted by part, for status text. */
export function selectedUnitCount(config: SystemsBoardConfig, trains: Snapshot, ids: ReadonlySet<string>): number {
  const evaluation = evaluateCountSystem(config, trains)
  if (!evaluation.valid) return 0
  return evaluation.material.units.filter(unit => ids.has(unit.trainId) && unit.variable === 'x').length
}
