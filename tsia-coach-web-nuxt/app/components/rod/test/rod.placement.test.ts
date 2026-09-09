import { describe, expect, it } from 'vitest'
import { findFreeRodPosition, placementFailure, type RodBoardSpace} from "~/components/rod/movement/rod.placement.ts";
import type {PlacedRod} from "~/components/rod/movement/rod-board.types.ts";


function space(): RodBoardSpace {
  return { columns: 24, rows: 11, spawnRows: [2, 5, 8] }
}

const obstacle: PlacedRod = { id: 'existing', value: 8, x: 8, y: 2 }

describe('rod placement', () => {
  it.each([
    { x: -1, y: 2 },
    { x: 19, y: 2 },
    { x: 0, y: -1 },
    { x: 0, y: 11 },
    { x: 0.5, y: 2 },
    { x: 0, y: 2.5 },
    { x: Number.NaN, y: 2 },
    { x: 0, y: Number.POSITIVE_INFINITY },
  ])('rejects an invalid six-rod footprint at %j', position => {
    expect(placementFailure(6, position, space(), [])).toBe('outside-board')
  })

  it.each([{ x: 0, y: 0 }, { x: 18, y: 10 }])(
    'accepts a footprint exactly inside the board edges at %j', position => {
      expect(placementFailure(6, position, space(), [])).toBeNull()
    },
  )

  it.each([3, 8, 10, 15])('rejects overlap from column %i', x => {
    expect(placementFailure(6, { x, y: 2 }, space(), [obstacle])).toBe('occupied')
  })

  it.each([
    { x: 2, y: 2 }, // Right edge touches the obstacle's left edge.
    { x: 16, y: 2 }, // Left edge touches its right edge.
    { x: 8, y: 1 },
    { x: 8, y: 3 },
  ])('allows touching edges at %j', position => {
    expect(placementFailure(6, position, space(), [obstacle])).toBeNull()
  })

  it('excludes the moving rod but still checks other rods', () => {
    const other: PlacedRod = { id: 'other', value: 4, x: 16, y: 2 }
    expect(placementFailure(8, { x: 8, y: 2 }, space(), [obstacle, other], obstacle.id)).toBeNull()
    expect(placementFailure(8, { x: 9, y: 2 }, space(), [obstacle, other], obstacle.id)).toBe('occupied')
  })

  it('finds the first fitting gap rather than appending after the last rod', () => {
    const pieces: PlacedRod[] = [
      { id: 'left', value: 4, x: 0, y: 2 },
      { id: 'right', value: 8, x: 10, y: 2 },
    ]
    expect(findFreeRodPosition(6, space(), pieces)).toEqual({ x: 4, y: 2 })
  })

  it('tries the next target when the remaining gap is too short', () => {
    const pieces: PlacedRod[] = [
      { id: 'a', value: 10, x: 0, y: 2 },
      { id: 'b', value: 10, x: 10, y: 2 },
    ]
    expect(findFreeRodPosition(6, space(), pieces)).toEqual({ x: 0, y: 5 })
  })

  it('returns null when target space is full, even if reference rows are empty', () => {
    const pieces: PlacedRod[] = space().spawnRows.flatMap(y =>
      [0, 8, 16].map(x => ({ id: `${y}-${x}`, value: 8 as const, x, y })),
    )
    expect(findFreeRodPosition(1, space(), pieces)).toBeNull()
  })
})
