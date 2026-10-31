import { describe, expect, it } from 'vitest'
import { contains, partFootprint, trainBounds, trainFootprints } from './part-footprint'

describe('part footprints', () => {
  it.each([
    ['horizontal', { width: 4, depth: 1 }],
    ['vertical', { width: 1, depth: 4 }],
    ['tower', { width: 1, depth: 1 }],
  ] as const)('a %s 4-rod covers its cells', (orientation, size) => {
    expect(partFootprint({ value: 4, offset: { x: 1, y: 2 }, orientation }, { x: 10, y: 20 }))
      .toEqual({ x: 11, y: 22, ...size })
  })

  it('places a train and bounds it from its anchor', () => {
    const train = {
      anchor: { x: 3, y: 1 },
      parts: [
        { value: 5, offset: { x: 0, y: 0 }, orientation: 'vertical' as const },
        { value: 2, offset: { x: 0, y: 5 }, orientation: 'vertical' as const },
      ],
    }
    expect(trainFootprints(train)).toEqual([
      { x: 3, y: 1, width: 1, depth: 5 },
      { x: 3, y: 6, width: 1, depth: 2 },
    ])
    expect(trainBounds(train)).toEqual({ x: 3, y: 1, width: 1, depth: 7 })
  })

  it('checks containment edge to edge', () => {
    const outer = { x: 2, y: 2, width: 4, depth: 3 }
    expect(contains(outer, { x: 2, y: 2, width: 4, depth: 3 })).toBe(true)
    expect(contains(outer, { x: 3, y: 2, width: 4, depth: 1 })).toBe(false)
    expect(contains(outer, { x: 2, y: 1, width: 1, depth: 1 })).toBe(false)
  })
})
