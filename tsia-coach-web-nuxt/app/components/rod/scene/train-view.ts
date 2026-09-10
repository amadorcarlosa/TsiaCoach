import type { DeepReadonly } from 'vue'
import { arrayRodDimensions } from '../array/array-rod.types'
import type { RodTrain } from './rod.scene.types'

export function trainView(train: DeepReadonly<RodTrain>) {
  const first = train.parts[0]
  if (!first) throw new Error(`Train ${train.id} has no parts`)

  const dimensions = train.parts.reduce(
    (bounds, part) => {
      const size = arrayRodDimensions(
        part.value,
        part.orientation,
      )

      return {
        width: Math.max(
          bounds.width,
          part.offset.x + size.width,
        ),
        depth: Math.max(
          bounds.depth,
          part.offset.y + size.depth,
        ),
        height: Math.max(bounds.height, size.height),
      }
    },
    { width: 0, depth: 0, height: 0 },
  )

  return {
    id: train.id,
    x: train.anchor.x,
    y: train.anchor.y,
    parts: train.parts,
    dimensions,

    // Retains the legacy rod prop; never cast the total to a rod value.
    value: first.value,

    total: train.parts.reduce(
      (sum, part) => sum + part.value,
      0,
    ),

    orientation: train.parts.length === 1
      ? first.orientation
      : undefined,
  }
}
