import type { SceneSnapshot } from '~/components/rod/scene/scene-snapshot'
import type { MaterialRole, SceneRegion } from '~/components/rod/scene/rod.scene.types'
import { trainFitsRegion } from '~/components/rod/scene/scene-regions'
import { trainFootprints } from '~/components/rod/scene/part-footprint'
import type { getMathTablaGeometry } from './mathtabla.geometry'

export type MathTablaGuide = Pick<SceneRegion, 'x' | 'y' | 'width' | 'depth'>

// 'incomplete': at least one D track is empty, so no whole is defined yet.
// 'exceeds-board': both D totals are positive but the rectangle does not fit the
// central grid. A clipped rectangle would misrepresent the whole, so none is drawn.
export type MathTablaWholeState = 'incomplete' | 'ready' | 'exceeds-board'

/**
 * Role of central material for counting purposes. Outside fraction
 * multiplication nothing has a role, so every eligible piece counts as it
 * always did; inside it, material saved before roles existed keeps its
 * historical selected-quantity meaning.
 */
function countingRole(
  train: SceneSnapshot[number],
  layered: boolean,
): MaterialRole | null {
  if (!layered) return null
  return train.materialRole ?? 'numerator'
}

export function getMathTablaReadouts(
  trains: SceneSnapshot,
  geometry: ReturnType<typeof getMathTablaGeometry>,
  options: { layered?: boolean } = {},
) {
  const layered = options.layered === true
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
  // Each set is unique cells, so two pieces covering one cell count it once.
  const occupied = new Set<string>()
  const numerator = new Set<string>()
  const denominator = new Set<string>()

  if (guide) {
    for (const train of trains) {
      if (!trainFitsRegion(train, geometry.array)) continue
      const role = countingRole(train, layered)

      for (const part of trainFootprints(train)) {
        for (let y = Math.max(part.y, guide.y); y < Math.min(part.y + part.depth, guide.y + guide.depth); y++) {
          for (let x = Math.max(part.x, guide.x); x < Math.min(part.x + part.width, guide.x + guide.width); x++) {
            const cell = `${x},${y}`
            occupied.add(cell)
            if (role === 'numerator') numerator.add(cell)
            if (role === 'denominator') denominator.add(cell)
          }
        }
      }
    }
  }

  const guideCells = guide ? guide.width * guide.depth : 0

  return {
    horizontal,
    vertical,
    state,
    guide,
    // Every eligible central cell. Unchanged outside fraction multiplication.
    occupiedCells: occupied.size,
    /**
     * Cells the selected quantity covers. Denominator tiles and both reference
     * tracks contribute nothing, so a fully tiled whole still selects none.
     */
    numeratorCells: numerator.size,
    /**
     * How much of the whole is physically tiled. Progress only: the whole is
     * the area the D references define, whether or not tiles are placed.
     */
    denominatorCells: denominator.size,
    guideCells,
  }
}
