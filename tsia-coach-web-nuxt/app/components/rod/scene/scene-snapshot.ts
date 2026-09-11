import type { DeepReadonly } from 'vue'
import type { RodTrain } from './rod.scene.types'

export type SceneSnapshot = readonly DeepReadonly<RodTrain>[]

export function copyScene(source: SceneSnapshot): RodTrain[] {
  return source.map(train => ({
    id: train.id,
    anchor: { ...train.anchor },
    parts: train.parts.map(part => ({
      value: part.value,
      orientation: part.orientation,
      offset: { ...part.offset },
    })),
  }))
}
