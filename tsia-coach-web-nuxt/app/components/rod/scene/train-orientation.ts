import type { DeepReadonly } from 'vue'
import type { RodTrain, TrainPart } from './rod.scene.types'

export function trainOrientation(
  train: DeepReadonly<RodTrain>,
): TrainPart['orientation'] | undefined {
  const first = train.parts[0]
  if (!first) return undefined

  if (train.parts.length === 1) return first.orientation

  const orientation = first.orientation
  if (orientation === 'tower') return undefined

  let cursor = 0

  for (const part of train.parts) {
    if (part.orientation !== orientation) return undefined

    const expectedX = orientation === 'horizontal' ? cursor : 0
    const expectedY = orientation === 'vertical' ? cursor : 0

    if (
      part.offset.x !== expectedX ||
      part.offset.y !== expectedY
    ) {
      return undefined
    }

    cursor += part.value
  }

  return orientation
}
