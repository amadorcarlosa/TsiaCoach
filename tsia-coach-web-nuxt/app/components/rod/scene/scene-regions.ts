import type { DeepReadonly } from 'vue'
import type { RodTrain, SceneRegion } from './rod.scene.types'

export function trainFitsRegion(
  train: DeepReadonly<RodTrain>,
  region: SceneRegion,
): boolean {
  return train.parts.length > 0 && train.parts.every(part => {
    if (!region.orientations.includes(part.orientation)) return false

    const x = train.anchor.x + part.offset.x
    const y = train.anchor.y + part.offset.y
    const width = part.orientation === 'horizontal' ? part.value : 1
    const depth = part.orientation === 'vertical' ? part.value : 1

    return (
      x >= region.x && y >= region.y &&
      x + width <= region.x + region.width &&
      y + depth <= region.y + region.depth
    )
  })
}
