import { describe, expect, it } from 'vitest'
import { getMathTablaGeometry } from './mathtabla.geometry'

describe('MathTabla geometry', () => {
  it('places D outside N with shared origins and no separator cells or corner region', () => {
    const board = getMathTablaGeometry()
    expect(board.config).toEqual({ columns: 26, rows: 14, cellSize: 36 })
    expect(board.regions).toEqual([
      { id: 'horizontal-d', x: 2, y: 0, width: 24, depth: 1, orientations: ['horizontal'] },
      { id: 'horizontal-n', x: 2, y: 1, width: 24, depth: 1, orientations: ['horizontal'] },
      { id: 'vertical-d', x: 0, y: 2, width: 1, depth: 12, orientations: ['vertical'] },
      { id: 'vertical-n', x: 1, y: 2, width: 1, depth: 12, orientations: ['vertical'] },
      { id: 'array', x: 2, y: 2, width: 24, depth: 12, orientations: ['horizontal', 'vertical'] },
    ])
    expect(board.array).toBe(board.regions[4])
  })

  it('uses configured capacity and keeps region coordinates independent of cell size', () => {
    expect(getMathTablaGeometry(8, 6, 18).config).toEqual({ columns: 10, rows: 8, cellSize: 18 })
    expect(getMathTablaGeometry(24, 12, 18).regions).toEqual(getMathTablaGeometry().regions)
  })

  it.each([
    [0, 12, 36], [1.5, 12, 36], [24, 0, 36], [24, 1.5, 36],
    [24, 12, 0], [24, 12, -1], [24, 12, NaN], [24, 12, Infinity],
  ])('rejects invalid dimensions %s × %s at %s', (columns, rows, cellSize) => {
    expect(() => getMathTablaGeometry(columns, rows, cellSize)).toThrow(RangeError)
  })
})
