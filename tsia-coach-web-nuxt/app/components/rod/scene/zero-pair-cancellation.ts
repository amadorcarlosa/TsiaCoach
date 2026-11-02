import type { DeepReadonly } from 'vue'
import type { Point } from '~/components/grid/gridPointer'
import type { CuisenaireRodValue } from '../rod.types'
import type { RodSign, RodTrain } from './rod.scene.types'
import { partSign, signField } from './rod-arithmetic'
import { copyScene } from './scene-snapshot'

/**
 * Zero-pair cancellation of one positive and one negative single rod.
 * Pure: no Vue state, DOM, timers or ID allocation. The same inputs always
 * give the same plan, and nothing passed in is mutated.
 */

export type ZeroPairOrientation = 'horizontal' | 'vertical'

export type ZeroPairInput = {
  id: string
  sign: RodSign
  magnitude: CuisenaireRodValue
  orientation: ZeroPairOrientation
}

/** One piece of the larger rod's preview split, in that train's local cells. */
export type ZeroPairPiece = {
  role: 'remainder' | 'cancelling'
  value: CuisenaireRodValue
  sign: RodSign
  offset: Point
  orientation: ZeroPairOrientation
}

export type ZeroPairPlan = {
  positive: ZeroPairInput
  negative: ZeroPairInput
  /** min(p, n): the magnitude each side gives up. */
  cancelledMagnitude: number
  /** p - n. Never cast to a rod value; the survivor uses its magnitude. */
  signedRemainder: number
  /** The larger rod's train, kept with its ID and anchor; null for an equal pair. */
  survivorId: string | null
  removedIds: readonly string[]
  /** The larger rod split into remainder + cancelling piece; null for an equal pair. */
  decomposition: { trainId: string; pieces: readonly ZeroPairPiece[] } | null
  /** Replacement for the survivor's train; null when no rods remain. */
  survivor: RodTrain | null
}

export type ZeroPairResult =
  | { allowed: true; plan: ZeroPairPlan }
  | { allowed: false; reason: string }

export const zeroPairReasons = {
  unavailable: 'Zero-pair cancellation is available on the Array board.',
  count: 'Select exactly two rods: one positive and one negative.',
  missing: 'Select existing rods first.',
  multiPart: 'Cancel works on single rods. Use Undo train to separate the rods first.',
  tower: 'Lay both rods horizontally or vertically before cancelling.',
  sameSign: 'Select one positive rod and one negative rod.',
  role: 'Rods with a denominator or numerator role cannot be cancelled.',
  stale: 'The rods changed. Preview the zero pair again.',
} as const

const reject = (reason: string): ZeroPairResult => ({ allowed: false, reason })

function asRodValue(value: number): CuisenaireRodValue {
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new RangeError(`No rod has magnitude ${value}.`)
  }
  return value as CuisenaireRodValue
}

export function planZeroPair(
  trains: readonly DeepReadonly<RodTrain>[],
  ids: readonly string[],
  options: { enabled: boolean },
): ZeroPairResult {
  if (!options.enabled) return reject(zeroPairReasons.unavailable)
  if (ids.length !== 2 || ids[0] === ids[1]) return reject(zeroPairReasons.count)

  const selected = ids.map(id => trains.find(train => train.id === id))
  if (selected.some(train => !train)) return reject(zeroPairReasons.missing)
  const pair = selected as DeepReadonly<RodTrain>[]

  if (pair.some(train => train.parts.length !== 1)) return reject(zeroPairReasons.multiPart)
  if (pair.some(train => train.materialRole !== undefined)) return reject(zeroPairReasons.role)
  if (pair.some(train => train.parts[0]!.orientation === 'tower')) return reject(zeroPairReasons.tower)

  // Identify the inputs by sign, so selection order never changes the answer.
  const positiveTrain = pair.find(train => partSign(train.parts[0]!) === 1)
  const negativeTrain = pair.find(train => partSign(train.parts[0]!) === -1)
  if (!positiveTrain || !negativeTrain) return reject(zeroPairReasons.sameSign)

  const input = (train: DeepReadonly<RodTrain>): ZeroPairInput => {
    const part = train.parts[0]!
    return {
      id: train.id,
      sign: partSign(part),
      magnitude: part.value,
      orientation: part.orientation as ZeroPairOrientation,
    }
  }
  const positive = input(positiveTrain)
  const negative = input(negativeTrain)

  const cancelledMagnitude = Math.min(positive.magnitude, negative.magnitude)
  const signedRemainder = positive.magnitude - negative.magnitude

  if (signedRemainder === 0) {
    return {
      allowed: true,
      plan: {
        positive, negative, cancelledMagnitude, signedRemainder,
        survivorId: null,
        removedIds: [positive.id, negative.id],
        decomposition: null,
        survivor: null,
      },
    }
  }

  const largerTrain = signedRemainder > 0 ? positiveTrain : negativeTrain
  const smaller = signedRemainder > 0 ? negative : positive
  const larger = signedRemainder > 0 ? positive : negative
  const part = largerTrain.parts[0]!
  const remainder = asRodValue(Math.abs(signedRemainder))
  const along = (distance: number): Point => larger.orientation === 'horizontal'
    ? { x: part.offset.x + distance, y: part.offset.y }
    : { x: part.offset.x, y: part.offset.y + distance }

  // The split partitions the larger rod's own cells: remainder first along
  // increasing x (or y), then the material that matches the smaller rod.
  const pieces: ZeroPairPiece[] = [
    { role: 'remainder', value: remainder, sign: larger.sign, offset: along(0), orientation: larger.orientation },
    {
      role: 'cancelling', value: asRodValue(cancelledMagnitude), sign: larger.sign,
      offset: along(remainder), orientation: larger.orientation,
    },
  ]

  // Same ID, anchor and orientation; no stale addendGroup on the new single part.
  const survivor: RodTrain = {
    id: largerTrain.id,
    anchor: { ...largerTrain.anchor },
    parts: [{
      value: remainder,
      ...signField(larger.sign),
      offset: along(0),
      orientation: larger.orientation,
    }],
  }

  return {
    allowed: true,
    plan: {
      positive, negative, cancelledMagnitude, signedRemainder,
      survivorId: larger.id,
      removedIds: [smaller.id],
      decomposition: { trainId: larger.id, pieces },
      survivor,
    },
  }
}

/**
 * The complete scene after the plan: unselected trains are carried over as
 * they are, in their order, and nothing else moves or packs.
 */
export function applyZeroPairPlan(
  trains: readonly RodTrain[],
  plan: ZeroPairPlan,
): RodTrain[] {
  const removed = new Set(plan.removedIds)
  return trains
    .filter(train => !removed.has(train.id))
    .map(train => train.id === plan.survivorId ? plan.survivor! : train)
}

/**
 * Canonical form of the inputs a preview was built from, for the stale-view
 * check. Order-independent and complete: anchors, parts, signs, orientations
 * and metadata all take part, so any change is detected.
 */
export function zeroPairBaseline(
  trains: readonly DeepReadonly<RodTrain>[],
  ids: readonly string[],
): string {
  const wanted = new Set(ids)
  const inputs = trains
    .filter(train => wanted.has(train.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return JSON.stringify(copyScene(inputs))
}
