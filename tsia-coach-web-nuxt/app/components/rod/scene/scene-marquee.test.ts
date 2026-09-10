import { describe, expect, it } from 'vitest'
import type { Point } from '~/components/grid/gridPointer'
import type { RodTrain, TrainPart } from './rod.scene.types'
import {
  marqueeHits,
  marqueeRect,
  marqueeSelection,
  overlaps,
  type MarqueeRect,
} from './scene-marquee'

function train(
  id: string,
  anchor: Point,
  parts: TrainPart[],
): RodTrain {
  return { id, anchor, parts }
}

function single(
  id: string,
  anchor: Point,
  value: TrainPart['value'],
  orientation: TrainPart['orientation'] = 'horizontal',
): RodTrain {
  return train(id, anchor, [{ value, orientation, offset: { x: 0, y: 0 } }])
}

it('does not select a train through empty space between its parts', () => {
  const gapped: RodTrain = {
    id: 'gapped',
    anchor: { x: 0, y: 0 },
    parts: [
      {
        value: 2,
        orientation: 'horizontal',
        offset: { x: 0, y: 0 },
      },
      {
        value: 2,
        orientation: 'horizontal',
        offset: { x: 4, y: 0 },
      },
    ],
  }

  expect(marqueeHits([gapped], {
    x: 2.5,
    y: 0.2,
    width: 1,
    depth: 0.6,
  })).toEqual([])

  expect(marqueeHits([gapped], {
    x: 4.2,
    y: 0.2,
    width: 0.2,
    depth: 0.2,
  })).toEqual(['gapped'])
})

describe('overlaps', () => {
  const rod: MarqueeRect = { x: 2, y: 3, width: 4, depth: 1 }

  it('treats edge contact as a miss', () => {
    // Right edge of the rectangle touches the rod's left edge.
    expect(overlaps({ x: 0, y: 3, width: 2, depth: 1 }, rod)).toBe(false)
    // Bottom edge touches the rod's top edge.
    expect(overlaps({ x: 2, y: 1, width: 4, depth: 2 }, rod)).toBe(false)
    // Corner contact only.
    expect(overlaps({ x: 6, y: 4, width: 1, depth: 1 }, rod)).toBe(false)
    // A zero-area rectangle never selects.
    expect(overlaps({ x: 3, y: 3.5, width: 0, depth: 0 }, rod)).toBe(false)
  })

  it('requires positive overlap on both axes', () => {
    expect(overlaps({ x: 0, y: 3, width: 2.01, depth: 1 }, rod)).toBe(true)
    expect(overlaps({ x: 2, y: 1, width: 4, depth: 2.01 }, rod)).toBe(true)
    // Overlapping on x only is not enough.
    expect(overlaps({ x: 3, y: 5, width: 1, depth: 1 }, rod)).toBe(false)
  })
})

describe('marqueeRect', () => {
  it('normalizes all four drag directions to the same rectangle', () => {
    const a: Point = { x: 1.25, y: 2.5 }
    const b: Point = { x: 4.75, y: 0.5 }
    const expected: MarqueeRect = { x: 1.25, y: 0.5, width: 3.5, depth: 2 }

    expect(marqueeRect(a, b)).toEqual(expected)
    expect(marqueeRect(b, a)).toEqual(expected)
    expect(marqueeRect({ x: a.x, y: b.y }, { x: b.x, y: a.y })).toEqual(expected)
    expect(marqueeRect({ x: b.x, y: a.y }, { x: a.x, y: b.y })).toEqual(expected)
  })

  it('collapses a stationary drag to a zero-area rectangle', () => {
    expect(marqueeRect({ x: 3, y: 3 }, { x: 3, y: 3 }))
      .toEqual({ x: 3, y: 3, width: 0, depth: 0 })
  })
})

describe('marqueeHits', () => {
  const horizontal = single('horizontal', { x: 0, y: 0 }, 4)
  const vertical = single('vertical', { x: 6, y: 0 }, 4, 'vertical')
  const tower = single('tower', { x: 10, y: 0 }, 4, 'tower')
  // A 2 x 3 factor rectangle: two horizontal threes stacked.
  const factors = train('factors', { x: 0, y: 6 }, [
    { value: 3, orientation: 'horizontal', offset: { x: 0, y: 0 } },
    { value: 3, orientation: 'horizontal', offset: { x: 0, y: 1 } },
  ])
  const scene = [horizontal, vertical, tower, factors]

  it('uses the horizontal footprint', () => {
    expect(marqueeHits(scene, { x: 3.5, y: 0.5, width: 1, depth: 0.25 }))
      .toEqual(['horizontal'])
    expect(marqueeHits(scene, { x: 4, y: 0.5, width: 1, depth: 0.25 }))
      .toEqual([])
    expect(marqueeHits(scene, { x: 0.5, y: 1, width: 1, depth: 1 }))
      .toEqual([])
  })

  it('uses the vertical footprint', () => {
    expect(marqueeHits(scene, { x: 6.5, y: 3.5, width: 0.25, depth: 1 }))
      .toEqual(['vertical'])
    expect(marqueeHits(scene, { x: 6.5, y: 4, width: 0.25, depth: 1 }))
      .toEqual([])
    expect(marqueeHits(scene, { x: 7, y: 1, width: 1, depth: 1 }))
      .toEqual([])
  })

  it('uses only the ground footprint of a tower', () => {
    expect(marqueeHits(scene, { x: 10.5, y: 0.5, width: 0.25, depth: 0.25 }))
      .toEqual(['tower'])
    // Its rendered height reaches four cells but the hit area stays 1 x 1.
    expect(marqueeHits(scene, { x: 10.5, y: 1.5, width: 0.25, depth: 2 }))
      .toEqual([])
  })

  it('uses every part of a factor rectangle', () => {
    expect(marqueeHits(scene, { x: 2.5, y: 7.5, width: 0.25, depth: 0.25 }))
      .toEqual(['factors'])
    expect(marqueeHits(scene, { x: 0.5, y: 6.5, width: 0.25, depth: 0.25 }))
      .toEqual(['factors'])
    expect(marqueeHits(scene, { x: 3, y: 6, width: 1, depth: 2 }))
      .toEqual([])
  })

  it('accepts fractional rectangles from any drag direction', () => {
    const corners: [Point, Point][] = [
      [{ x: 0.5, y: 0.5 }, { x: 10.5, y: 0.75 }],
      [{ x: 10.5, y: 0.75 }, { x: 0.5, y: 0.5 }],
      [{ x: 0.5, y: 0.75 }, { x: 10.5, y: 0.5 }],
      [{ x: 10.5, y: 0.5 }, { x: 0.5, y: 0.75 }],
    ]

    for (const [a, b] of corners) {
      expect(marqueeHits(scene, marqueeRect(a, b)))
        .toEqual(['horizontal', 'vertical', 'tower'])
    }
  })

  it('preserves scene order in the result', () => {
    expect(marqueeHits(scene, { x: 0, y: 0, width: 12, depth: 8 }))
      .toEqual(['horizontal', 'vertical', 'tower', 'factors'])
  })
})

describe('marqueeSelection', () => {
  const initial: ReadonlySet<string> = new Set(['a'])

  it('replace ignores the initial selection', () => {
    expect([...marqueeSelection(initial, ['b'], 'replace')]).toEqual(['b'])
    expect([...marqueeSelection(initial, [], 'replace')]).toEqual([])
  })

  it('add keeps the initial selection', () => {
    expect([...marqueeSelection(initial, ['b'], 'add')]).toEqual(['a', 'b'])
    expect([...marqueeSelection(initial, ['a'], 'add')]).toEqual(['a'])
  })

  it('toggle re-derives from the initial selection on every pass', () => {
    // Entering the selected train removes it.
    expect([...marqueeSelection(initial, ['a'], 'toggle')]).toEqual([])
    // Leaving restores it, since the preview is not cumulative.
    expect([...marqueeSelection(initial, [], 'toggle')]).toEqual(['a'])
    // Re-entering with another train removes a and adds b.
    expect([...marqueeSelection(initial, ['a', 'b'], 'toggle')]).toEqual(['b'])
    // Leaving a but keeping b.
    expect([...marqueeSelection(initial, ['b'], 'toggle')]).toEqual(['a', 'b'])
  })

  it('never mutates the initial selection', () => {
    marqueeSelection(initial, ['a', 'b'], 'toggle')
    marqueeSelection(initial, ['b'], 'add')
    marqueeSelection(initial, [], 'replace')

    expect([...initial]).toEqual(['a'])
  })
})
