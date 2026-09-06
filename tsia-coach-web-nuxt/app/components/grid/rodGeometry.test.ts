import { describe, expect, it } from 'vitest'
import { canPlaceRod, footprint } from './rodGeometry'

describe('rod rotation', () => {
  const rod = { length: 3, x: 1, y: 1, vertical: true }
  it('swaps the footprint while preserving length', () => {
    expect(footprint(rod)).toEqual({ x: 1, y: 1, width: 1, height: 3 })
    expect(footprint({ ...rod, vertical: false })).toEqual({ x: 1, y: 1, width: 3, height: 1 })
  })
  it('a tower occupies one cell regardless of its height', () => {
    const tower = { length: 10, x: 11, y: 11, vertical: false, tower: true }
    expect(footprint(tower)).toEqual({ x: 11, y: 11, width: 1, height: 1 })
    expect(canPlaceRod(tower, [], 12, 12)).toBe(true)
    expect(canPlaceRod({ ...tower, tower: false }, [], 12, 12)).toBe(false)
    expect(canPlaceRod(tower, [{ ...tower, length: 1 }], 12, 12)).toBe(false)
  })
  it('allows touching edges but rejects overlap', () => {
    expect(canPlaceRod(rod, [{ ...rod, x: 2 }], 12, 12)).toBe(true)
    expect(canPlaceRod(rod, [{ ...rod, y: 3 }], 12, 12)).toBe(false)
  })
  it('rejects a rotation extending beyond the board', () => {
    expect(canPlaceRod({ ...rod, y: 10 }, [], 12, 12)).toBe(false)
    expect(canPlaceRod({ ...rod, y: 9 }, [], 12, 12)).toBe(true)
  })
})
