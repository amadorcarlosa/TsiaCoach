import { describe, expect, it } from 'vitest'
import type { RodTrain, TrainPart } from '~/components/rod/scene/rod.scene.types'
import { trainOrientation } from '~/components/rod/scene/train-orientation'
import {
  areaGroupPartitions,
  areaGroupParts,
  areaGroupReading,
  areaGroupReadings,
  areaGroupingOf,
  tiledRectangle,
} from './area-grouping'

const area = (width: number, depth: number, x = 0, y = 0) =>
  ({ offset: { x, y }, width, depth })

function train(parts: TrainPart[], x = 2, y = 2): RodTrain {
  return { id: 'selected', anchor: { x, y }, parts }
}

function cells(parts: readonly TrainPart[], anchor = { x: 0, y: 0 }): string[] {
  const occupied: string[] = []

  for (const part of parts) {
    const width = part.orientation === 'horizontal' ? part.value : 1
    const depth = part.orientation === 'vertical' ? part.value : 1

    for (let y = 0; y < depth; y++) {
      for (let x = 0; x < width; x++) {
        occupied.push(
          `${anchor.x + part.offset.x + x},${anchor.y + part.offset.y + y}`,
        )
      }
    }
  }

  return occupied.sort()
}

describe('two groupings of the same 3 × 5 area', () => {
  it('counts groups on the axis the grouping names, without rotating the rectangle', () => {
    expect(areaGroupReadings(area(3, 5))).toEqual([
      {
        grouping: 'columns', count: 3, unitsPerGroup: 5, total: 15,
        orientation: 'vertical', arrangement: 'vertical columns',
        label: '3 groups of 5',
        sentence: '3 groups × 5 square units = 15 square units',
        rodSupported: true,
      },
      {
        grouping: 'rows', count: 5, unitsPerGroup: 3, total: 15,
        orientation: 'horizontal', arrangement: 'horizontal rows',
        label: '5 groups of 3',
        sentence: '5 groups × 3 square units = 15 square units',
        rodSupported: true,
      },
    ])
  })

  it('builds three vertical fives for columns and five horizontal threes for rows', () => {
    expect(areaGroupParts(area(3, 5), 'columns')).toEqual([
      { value: 5, orientation: 'vertical', offset: { x: 0, y: 0 } },
      { value: 5, orientation: 'vertical', offset: { x: 1, y: 0 } },
      { value: 5, orientation: 'vertical', offset: { x: 2, y: 0 } },
    ])

    expect(areaGroupParts(area(3, 5), 'rows')).toEqual([
      { value: 3, orientation: 'horizontal', offset: { x: 0, y: 0 } },
      { value: 3, orientation: 'horizontal', offset: { x: 0, y: 1 } },
      { value: 3, orientation: 'horizontal', offset: { x: 0, y: 2 } },
      { value: 3, orientation: 'horizontal', offset: { x: 0, y: 3 } },
      { value: 3, orientation: 'horizontal', offset: { x: 0, y: 4 } },
    ])
  })

  it('occupies exactly the same 15 cells and the same 3 × 5 footprint either way', () => {
    const columns = areaGroupParts(area(3, 5), 'columns')!
    const rows = areaGroupParts(area(3, 5), 'rows')!
    const total = (parts: TrainPart[]) => parts.reduce((sum, part) => sum + part.value, 0)

    expect(total(columns)).toBe(15)
    expect(total(rows)).toBe(15)
    expect(cells(columns)).toHaveLength(15)
    expect(cells(columns)).toEqual(cells(rows))

    expect(tiledRectangle(train(columns))).toEqual(area(3, 5))
    expect(tiledRectangle(train(rows))).toEqual(area(3, 5))
  })

  it('keeps the offset of a rectangle that fills only part of a larger whole', () => {
    const parts = areaGroupParts(area(3, 5, 4, 1), 'columns')!

    expect(parts.map(part => part.offset)).toEqual([
      { x: 4, y: 1 }, { x: 5, y: 1 }, { x: 6, y: 1 },
    ])

    expect(tiledRectangle(train(parts))).toEqual(area(3, 5, 4, 1))
    expect(cells(parts)).toEqual(cells(areaGroupParts(area(3, 5, 4, 1), 'rows')!))
  })

  it('derives the current grouping from the whole layout, which trainOrientation cannot', () => {
    const columns = train(areaGroupParts(area(3, 5), 'columns')!)
    const rows = train(areaGroupParts(area(3, 5), 'rows')!)

    expect(areaGroupingOf(columns)).toBe('columns')
    expect(areaGroupingOf(rows)).toBe('rows')

    // Adjacent columns are not an end-to-end line, so the linear helper abstains.
    expect(trainOrientation(columns)).toBeUndefined()
    expect(trainOrientation(rows)).toBeUndefined()
  })
})

describe('shapes that must not be treated as groupable areas', () => {
  it('rejects a hole, an L shape, overlapping parts and a tower', () => {
    const rejected: Record<string, TrainPart[]> = {
      hole: [
        { value: 3, orientation: 'horizontal', offset: { x: 0, y: 0 } },
        { value: 1, orientation: 'horizontal', offset: { x: 0, y: 1 } },
        { value: 1, orientation: 'horizontal', offset: { x: 2, y: 1 } },
        { value: 3, orientation: 'horizontal', offset: { x: 0, y: 2 } },
      ],
      l: [
        { value: 3, orientation: 'horizontal', offset: { x: 0, y: 0 } },
        { value: 1, orientation: 'horizontal', offset: { x: 0, y: 1 } },
      ],
      overlapping: [
        { value: 3, orientation: 'horizontal', offset: { x: 0, y: 0 } },
        { value: 3, orientation: 'horizontal', offset: { x: 1, y: 0 } },
      ],
      tower: [{ value: 5, orientation: 'tower', offset: { x: 0, y: 0 } }],
      empty: [],
      fractional: [{ value: 3, orientation: 'horizontal', offset: { x: 0.5, y: 0 } }],
    }

    for (const [name, parts] of Object.entries(rejected)) {
      expect(tiledRectangle(train(parts)), name).toBeNull()
      expect(areaGroupingOf(train(parts)), name).toBeUndefined()
    }
  })

  it('accepts a mixed but exact tiling and reports no grouping for it', () => {
    // Two vertical threes beside three horizontal twos: a filled 3 × 3 square
    // that is neither grouping, so no choice is marked active.
    const mixed = train([
      { value: 3, orientation: 'vertical', offset: { x: 0, y: 0 } },
      { value: 2, orientation: 'horizontal', offset: { x: 1, y: 0 } },
      { value: 2, orientation: 'horizontal', offset: { x: 1, y: 1 } },
      { value: 2, orientation: 'horizontal', offset: { x: 1, y: 2 } },
    ])

    expect(tiledRectangle(mixed)).toEqual(area(3, 3))
    expect(areaGroupingOf(mixed)).toBeUndefined()
  })

  it('rejects rectangles that are not whole positive cells', () => {
    for (const rectangle of [
      area(0, 5), area(3, 0), area(-3, 5), { offset: { x: 0, y: 0 }, width: 2.5, depth: 4 },
      { offset: { x: 0.5, y: 0 }, width: 3, depth: 5 },
    ]) {
      expect(areaGroupReading(rectangle, 'columns')).toBeNull()
      expect(areaGroupPartitions(rectangle, 'rows')).toBeNull()
      expect(areaGroupParts(rectangle, 'rows')).toBeNull()
    }

    expect(areaGroupReadings(area(0, 5))).toEqual([])
  })
})

describe('group values beyond the rod catalog', () => {
  it('keeps flat partitions for a 14 × 3 area while only columns can be built with rods', () => {
    const columns = areaGroupReading(area(14, 3), 'columns')!
    const rows = areaGroupReading(area(14, 3), 'rows')!

    expect(columns).toMatchObject({ count: 14, unitsPerGroup: 3, rodSupported: true })
    expect(rows).toMatchObject({ count: 3, unitsPerGroup: 14, rodSupported: false })

    expect(areaGroupParts(area(14, 3), 'columns')).toHaveLength(14)
    expect(areaGroupParts(area(14, 3), 'rows')).toBeNull()

    // The explanatory partition is still available in both directions.
    expect(areaGroupPartitions(area(14, 3), 'rows')).toEqual([
      { offset: { x: 0, y: 0 }, width: 14, depth: 1 },
      { offset: { x: 0, y: 1 }, width: 14, depth: 1 },
      { offset: { x: 0, y: 2 }, width: 14, depth: 1 },
    ])
  })

  it('partitions a whole whose both dimensions exceed the catalog', () => {
    expect(areaGroupParts(area(12, 11), 'columns')).toBeNull()
    expect(areaGroupParts(area(12, 11), 'rows')).toBeNull()
    expect(areaGroupPartitions(area(12, 11), 'columns')).toHaveLength(12)
    expect(areaGroupPartitions(area(12, 11), 'rows')).toHaveLength(11)
  })
})

describe('regions one cell wide or deep', () => {
  // factorShapes() excludes a factor of one; a region of one column is still a
  // real area with two readings, so grouping must not inherit that exclusion.
  it('reads a 1 × 5 column as one group of five or five groups of one', () => {
    expect(areaGroupReadings(area(1, 5)).map(reading => reading.label))
      .toEqual(['1 group of 5', '5 groups of 1'])

    expect(areaGroupReading(area(1, 5), 'columns')!.sentence)
      .toBe('1 group × 5 square units = 5 square units')

    expect(areaGroupParts(area(1, 5), 'columns')).toEqual([
      { value: 5, orientation: 'vertical', offset: { x: 0, y: 0 } },
    ])

    expect(areaGroupParts(area(1, 5), 'rows')).toEqual([
      { value: 1, orientation: 'horizontal', offset: { x: 0, y: 0 } },
      { value: 1, orientation: 'horizontal', offset: { x: 0, y: 1 } },
      { value: 1, orientation: 'horizontal', offset: { x: 0, y: 2 } },
      { value: 1, orientation: 'horizontal', offset: { x: 0, y: 3 } },
      { value: 1, orientation: 'horizontal', offset: { x: 0, y: 4 } },
    ])
  })

  it('reads a 4 × 1 row and a single cell', () => {
    expect(areaGroupReadings(area(4, 1)).map(reading => reading.label))
      .toEqual(['4 groups of 1', '1 group of 4'])

    expect(areaGroupingOf(train(areaGroupParts(area(4, 1), 'rows')!))).toBe('rows')

    expect(areaGroupReadings(area(1, 1)).map(reading => reading.total)).toEqual([1, 1])
    expect(areaGroupingOf(train(areaGroupParts(area(1, 1), 'columns')!))).toBe('columns')
    expect(areaGroupingOf(train(areaGroupParts(area(1, 1), 'rows')!))).toBe('rows')
  })
})
