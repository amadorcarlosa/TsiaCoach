import type { DeepReadonly } from 'vue'
import type { Point } from '~/components/grid/gridPointer'
import { arrayRodDimensions } from '../array/array-rod.types'
import type { RodTrain } from './rod.scene.types'

export type MarqueeRect = {
  x: number
  y: number
  width: number
  depth: number
}

export type MarqueeMode = 'replace' | 'add' | 'toggle'

export function marqueeRect(a: Point, b: Point): MarqueeRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    depth: Math.abs(b.y - a.y),
  }
}

export function overlaps(a: MarqueeRect, b: MarqueeRect): boolean {
  // Strict inequalities: touching an edge does not select.
  return (
    Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width)
    && Math.max(a.y, b.y) < Math.min(a.y + a.depth, b.y + b.depth)
  )
}

export function marqueeHits(
  trains: readonly DeepReadonly<RodTrain>[],
  rect: MarqueeRect,
): string[] {
  return trains
    .filter(train => train.parts.some(part => {
      const size = arrayRodDimensions(part.value, part.orientation)

      return overlaps(rect, {
        x: train.anchor.x + part.offset.x,
        y: train.anchor.y + part.offset.y,
        width: size.width,
        depth: size.depth,
      })
    }))
    .map(train => train.id)
}

export function marqueeSelection(
  initial: ReadonlySet<string>,
  hits: readonly string[],
  mode: MarqueeMode,
): Set<string> {
  if (mode === 'replace') return new Set(hits)

  const result = new Set(initial)

  for (const id of hits) {
    if (mode === 'toggle' && initial.has(id)) result.delete(id)
    else result.add(id)
  }

  return result
}
