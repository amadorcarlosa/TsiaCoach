import type { RodSign } from './rod.scene.types'

// Structural, readonly-friendly inputs so Vue scene state needs no casts.
type SignedPart = { readonly value: number; readonly sign?: RodSign }
type SignedTrain = { readonly parts: readonly SignedPart[] }

/** Material sign of a whole train. A zero-total train is still 'mixed' material, never empty. */
export type TrainSignKind = 'positive' | 'negative' | 'mixed'

/** Runtime guard for untrusted input: only 1 and -1 are signs. */
export const isRodSign = (value: unknown): value is RodSign => value === 1 || value === -1

export const partSign = (part: SignedPart): RodSign => part.sign ?? 1

/** The part's arithmetic contribution. Geometry uses `part.value` instead. */
export const partSignedValue = (part: SignedPart): number => part.value * partSign(part)

/** Physical length of all parts: what layout, cursors and footprints advance by. */
export const trainMagnitude = (train: SignedTrain): number =>
  train.parts.reduce((sum, part) => sum + part.value, 0)

/** The train's mathematical total. +10 and -10 give 0 while still occupying 20 cells. */
export const trainSignedTotal = (train: SignedTrain): number =>
  train.parts.reduce((sum, part) => sum + partSignedValue(part), 0)

export function trainSignKind(train: SignedTrain): TrainSignKind {
  const negative = train.parts.some(part => partSign(part) === -1)
  const positive = train.parts.some(part => partSign(part) === 1)
  return negative && positive ? 'mixed' : negative ? 'negative' : 'positive'
}

/** The one sign a homogeneous train carries; undefined for mixed material. */
export function trainUniformSign(train: SignedTrain): RodSign | undefined {
  const kind = trainSignKind(train)
  return kind === 'mixed' ? undefined : kind === 'negative' ? -1 : 1
}

/** Keeps positive parts free of a `sign` key, so positive scenes serialise as before. */
export const signField = (sign: RodSign): { sign?: RodSign } => (sign === -1 ? { sign } : {})

/** Display a signed number with a typographic minus, e.g. "−12". */
export const formatSigned = (value: number): string => (value < 0 ? `−${-value}` : String(value))

/** A negative addend is parenthesised in a sum: "(−12) + (−12)". */
export const formatAddend = (value: number): string => (value < 0 ? `(${formatSigned(value)})` : String(value))

export const MIXED_SIGN_REGROUP_REASON =
  'This train mixes positive and negative rods. Regrouping mixed signs is not available yet; ' +
  'undo the train to work with each sign separately.'
