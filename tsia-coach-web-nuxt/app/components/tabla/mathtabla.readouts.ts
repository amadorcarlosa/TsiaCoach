import type { SceneSnapshot } from '~/components/rod/scene/scene-snapshot'
import type { SceneRegion } from '~/components/rod/scene/rod.scene.types'
import { trainFitsRegion } from '~/components/rod/scene/scene-regions'
import type { getMathTablaGeometry } from './mathtabla.geometry'

export type MathTablaGuide = Pick<SceneRegion, 'x' | 'y' | 'width' | 'depth'>

// 'incomplete': at least one D track is empty, so no whole is defined yet.
// 'exceeds-board': both D totals are positive but the rectangle does not fit the
// central grid. A clipped rectangle would misrepresent the whole, so none is drawn.
export type MathTablaWholeState = 'incomplete' | 'ready' | 'exceeds-board'

export function getMathTablaReadouts(
  trains: SceneSnapshot,
  geometry: ReturnType<typeof getMathTablaGeometry>,
) {
  const total = (id: string) => {
    const region = geometry.regions.find(item => item.id === id)!
    return trains.filter(train => trainFitsRegion(train, region))
      .reduce((sum, train) => sum + train.parts.reduce((value, part) => value + part.value, 0), 0)
  }
  const horizontal = { numerator: total('horizontal-n'), denominator: total('horizontal-d') }
  const vertical = { numerator: total('vertical-n'), denominator: total('vertical-d') }
  const width = horizontal.denominator
  const depth = vertical.denominator
  const state: MathTablaWholeState = width < 1 || depth < 1
    ? 'incomplete'
    : width > geometry.array.width || depth > geometry.array.depth
      ? 'exceeds-board'
      : 'ready'
  const guide: MathTablaGuide | null = state === 'ready'
    ? { x: geometry.array.x, y: geometry.array.y, width, depth }
    : null

  // Count physical central cells, clipped to the guide. Reference totals never
  // substitute for the occupied area; a partial rod contributes only its overlap.
  const occupied = new Set<string>()
  if (guide) {
    for (const train of trains) {
      if (!trainFitsRegion(train, geometry.array)) continue
      for (const part of train.parts) {
        const left = train.anchor.x + part.offset.x
        const top = train.anchor.y + part.offset.y
        const width = part.orientation === 'horizontal' ? part.value : 1
        const depth = part.orientation === 'vertical' ? part.value : 1
        for (let y = Math.max(top, guide.y); y < Math.min(top + depth, guide.y + guide.depth); y++) {
          for (let x = Math.max(left, guide.x); x < Math.min(left + width, guide.x + guide.width); x++) {
            occupied.add(`${x},${y}`)
          }
        }
      }
    }
  }

  return { horizontal, vertical, state, guide, occupiedCells: occupied.size, guideCells: guide ? guide.width * guide.depth : 0 }
}
