import type { DeepReadonly } from 'vue'
import type { RodTrain } from './rod.scene.types'

export type SceneSnapshot = readonly DeepReadonly<RodTrain>[]

export function copyScene(source: SceneSnapshot): RodTrain[] {
  return source.map(train => ({
    id: train.id,
    anchor: { ...train.anchor },
    // The role travels with the train itself, never in a side table that a
    // capture or restore could lose. Absent stays absent.
    ...(train.materialRole ? { materialRole: train.materialRole } : {}),
    parts: train.parts.map(part => ({
      ...(part.addendGroup !== undefined ? { addendGroup: part.addendGroup } : {}),
      value: part.value,
      // Copied as given, even when malformed, so validation can reject it
      // rather than a copy silently turning a negative rod positive.
      ...(part.sign !== undefined ? { sign: part.sign } : {}),
      orientation: part.orientation,
      offset: { ...part.offset },
    })),
  }))
}
