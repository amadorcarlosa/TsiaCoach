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

export type AddendPair = readonly [
  CuisenaireRodValue,
  CuisenaireRodValue,
]

export type AddendChoice = {
  pair: AddendPair
  result: SceneResult
}

export type SceneAction =
    | { type: 'create'; value: CuisenaireRodValue }
    | { type: 'move'; delta: Point }
    | { type: 'clone' }
    | { type: 'delete' }
    | { type: 'make-train' }
    | { type: 'regroup-ones' }
    | { type: 'regroup-addends'; pair?: AddendPair }
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
  editable: () => boolean
  allowOrientation: boolean
}

export type SceneResult =
    | { allowed: true }
    | { allowed: false; reason: string }

export type SceneApplyResult =
    | { allowed: true; createdIds: readonly string[] }
    | { allowed: false; reason: string }
