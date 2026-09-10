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

export type SceneAction =
    | { type: 'create'; value: CuisenaireRodValue }
    | { type: 'move'; delta: Point }
    | { type: 'clone' }
    | { type: 'delete' }
    |{ type: 'make-train' }
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