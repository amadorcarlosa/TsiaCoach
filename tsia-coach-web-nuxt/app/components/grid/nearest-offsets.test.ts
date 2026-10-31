import { describe, expect, it } from 'vitest'
import { offsetsByDistance, onBoardRange } from './nearest-offsets'

/** The search order clone used before: build every offset, then sort. */
function sortedOffsets(columns: number, rows: number) {
  const offsets: { x: number; y: number }[] = []
  for (let y = -rows; y <= rows; y++) for (let x = -columns; x <= columns; x++) if (x || y) offsets.push({ x, y })
  return offsets.sort((a, b) => Math.abs(a.x) + Math.abs(a.y) - Math.abs(b.x) - Math.abs(b.y) || b.x - a.x || b.y - a.y)
}

describe('offsetsByDistance', () => {
  it.each([[1, 1], [3, 2], [7, 4], [12, 24]])('matches the old sorted order on a %i × %i range', (columns, rows) => {
    const generated = [...offsetsByDistance({ minX: -columns, maxX: columns, minY: -rows, maxY: rows })]
    expect(generated).toEqual(sortedOffsets(columns, rows))
  })

  it('keeps the old order when limited to a range', () => {
    const range = { minX: -2, maxX: 5, minY: -1, maxY: 3 }
    const within = sortedOffsets(5, 3).filter(({ x, y }) =>
      x >= range.minX && x <= range.maxX && y >= range.minY && y <= range.maxY)
    expect([...offsetsByDistance(range)]).toEqual(within)
  })

  it('yields nothing for an empty range, and stops when asked', () => {
    expect([...offsetsByDistance({ minX: 1, maxX: 0, minY: 0, maxY: 0 })]).toEqual([])
    const offsets = offsetsByDistance({ minX: -500, maxX: 500, minY: -500, maxY: 500 })
    expect(offsets.next().value).toEqual({ x: 1, y: 0 })
  })
})

describe('onBoardRange', () => {
  it('allows offsets that keep every box on the board', () => {
    expect(onBoardRange([{ x: 2, y: 1, width: 3, depth: 1 }, { x: 4, y: 3, width: 1, depth: 2 }], 10, 8))
      .toEqual({ minX: -2, maxX: 5, minY: -1, maxY: 3 })
  })
})
