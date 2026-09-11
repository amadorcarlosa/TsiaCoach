import type { Point } from '~/components/grid/gridPointer'
import type { CuisenaireRodValue } from '../rod.types'

export type TrainPart = {
  value: CuisenaireRodValue
  offset: Point
  orientation: 'horizontal' | 'vertical' | 'tower'
}

export type RodTrain = {
  id: string
  anchor: Point
  parts: TrainPart[]
}

export type SceneRegion = {
  id: string
  x: number
  y: number
  width: number
  depth: number
  orientations: readonly TrainPart['orientation'][]
}

export type AddendPair = readonly [
  CuisenaireRodValue,
  CuisenaireRodValue,
]

export type AddendChoice = {
  pair: AddendPair
  result: SceneResult
}

export type FactorShape = {
  rows: number
  columns: CuisenaireRodValue
}

export type FactorChoice = {
  shape: FactorShape
  result: SceneResult
}

export type SceneAction =
    | {
      type: 'create'
      value: CuisenaireRodValue
      row?: number
      regionId?: string
    }
    | { type: 'move'; delta: Point }
    | { type: 'clone' }
    | { type: 'delete' }
    | { type: 'make-train' }
    | { type: 'regroup-ones' }
    | { type: 'regroup-addends'; pair?: AddendPair }
    | { type: 'regroup-factors'; shape?: FactorShape }
    | { type: 'ungroup' }
    | {
  type: 'set-orientation'
  orientation: TrainPart['orientation']
}

export type ScenePolicy = {
  columns: number
  rows: number
  spawnRows: readonly number[]
  trackRows?: readonly number[]
  regions?: readonly SceneRegion[]
  editable: () => boolean
  allowOrientation: boolean
  allowFactors?: boolean
  /** Every part must be horizontal and share the train's anchor row. */
  requireHorizontalAnchorRow?: boolean
}

export type SceneResult =
    | { allowed: true }
    | { allowed: false; reason: string }

export type SceneApplyResult =
    | { allowed: true; createdIds: readonly string[] }
    | { allowed: false; reason: string }
