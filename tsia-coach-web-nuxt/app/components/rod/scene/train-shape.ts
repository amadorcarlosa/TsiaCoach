import type { DeepReadonly } from 'vue'
import { tiledRectangle } from '~/components/tabla/area-grouping'
import type { RodTrain } from './rod.scene.types'
import { trainOrientation } from './train-orientation'

export type TrainShape =
  | 'single'
  | 'linear'
  | 'rectangle'
  | 'irregular'

export function trainShape(
  train: DeepReadonly<RodTrain>,
): TrainShape {
  if (train.parts.length === 1) return 'single'
  if (trainOrientation(train) !== undefined) return 'linear'
  if (tiledRectangle(train)) return 'rectangle'
  return 'irregular'
}
