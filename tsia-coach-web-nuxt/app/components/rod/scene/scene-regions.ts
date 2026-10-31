import type { DeepReadonly } from 'vue'
import type { RodTrain, SceneRegion } from './rod.scene.types'
import { contains, partFootprint } from './part-footprint'

export function trainFitsRegion(
  train: DeepReadonly<RodTrain>,
  region: SceneRegion,
): boolean {
  return train.parts.length > 0 && train.parts.every(part => {
    if (!region.orientations.includes(part.orientation)) return false
    return contains(region, partFootprint(part, train.anchor))
  })
}

/** The region containing a board point, or undefined on a gap between regions. */
export function regionAt<Region extends SceneRegion>(
  regions: readonly Region[],
  point: { x: number; y: number },
): Region | undefined {
  return regions.find(region =>
    point.x >= region.x && point.x < region.x + region.width &&
    point.y >= region.y && point.y < region.y + region.depth,
  )
}
