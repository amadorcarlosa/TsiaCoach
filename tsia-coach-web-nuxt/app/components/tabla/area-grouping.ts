import type { DeepReadonly } from 'vue'
import type { Point } from '~/components/grid/gridPointer'
import { CuisenaireRodValues, type CuisenaireRodValue } from '~/components/rod/rod.types'
import type { RodTrain, TrainPart } from '~/components/rod/scene/rod.scene.types'

/**
 * How a rectangle is partitioned. It never changes the rectangle's size.
 * 'columns': the horizontal axis counts groups, the vertical axis measures one group.
 * 'rows':    the vertical axis counts groups, the horizontal axis measures one group.
 */
export type AreaGrouping = 'columns' | 'rows'

export const areaGroupings = ['columns', 'rows'] as const satisfies readonly AreaGrouping[]

/** A rectangle of whole cells, offset from a train anchor or a board origin. */
export type AreaRectangle = {
  offset: Point
  width: number
  depth: number
}

export type AreaGroupReading = {
  grouping: AreaGrouping
  /** How many groups the rectangle is cut into. */
  count: number
  /** Square units in one group. */
  unitsPerGroup: number
  /** count × unitsPerGroup; the area never changes with the grouping. */
  total: number
  /** Orientation a raised rod would take to stand for one group. */
  orientation: Extract<TrainPart['orientation'], 'horizontal' | 'vertical'>
  /** 'vertical columns' / 'horizontal rows'; a square area needs it to read unambiguously. */
  arrangement: string
  /** '3 groups of 5' */
  label: string
  /** '3 groups × 5 square units = 15 square units' */
  sentence: string
  /**
   * Flat partitions exist for every integer group; raised rods exist only for
   * the 1-10 catalog, so a 14-unit group has no rod to stand for it.
   */
  rodSupported: boolean
}

const rodValues = new Set<number>(Object.values(CuisenaireRodValues))

export function isRodValue(value: number): value is CuisenaireRodValue {
  return rodValues.has(value)
}

function wholeRectangle(rectangle: AreaRectangle): boolean {
  return (
    Number.isInteger(rectangle.offset.x) &&
    Number.isInteger(rectangle.offset.y) &&
    Number.isInteger(rectangle.width) &&
    Number.isInteger(rectangle.depth) &&
    rectangle.width >= 1 &&
    rectangle.depth >= 1
  )
}

/**
 * Reads a rectangle as a group count and a group value. Both directions are
 * derived from the rectangle's current dimensions, so neither axis is
 * permanently the group count.
 */
export function areaGroupReading(
  rectangle: AreaRectangle,
  grouping: AreaGrouping,
): AreaGroupReading | null {
  if (!wholeRectangle(rectangle)) return null

  const columns = grouping === 'columns'
  const count = columns ? rectangle.width : rectangle.depth
  const unitsPerGroup = columns ? rectangle.depth : rectangle.width
  const groups = count === 1 ? 'group' : 'groups'
  const total = count * unitsPerGroup

  return {
    grouping,
    count,
    unitsPerGroup,
    total,
    orientation: columns ? 'vertical' : 'horizontal',
    arrangement: columns ? 'vertical columns' : 'horizontal rows',
    label: `${count} ${groups} of ${unitsPerGroup}`,
    sentence:
      `${count} ${groups} × ${unitsPerGroup} square units ` +
      `= ${total} square units`,
    rodSupported: isRodValue(unitsPerGroup),
  }
}

/** Both readings of the same rectangle, columns first. */
export function areaGroupReadings(rectangle: AreaRectangle): AreaGroupReading[] {
  return areaGroupings
    .map(grouping => areaGroupReading(rectangle, grouping))
    .filter((reading): reading is AreaGroupReading => reading !== null)
}

/**
 * Flat bands covering the rectangle exactly once. Available for any integer
 * dimensions, including those no rod can express.
 */
export function areaGroupPartitions(
  rectangle: AreaRectangle,
  grouping: AreaGrouping,
): AreaRectangle[] | null {
  const reading = areaGroupReading(rectangle, grouping)
  if (!reading) return null

  const { offset, width, depth } = rectangle

  return Array.from({ length: reading.count }, (_, index): AreaRectangle =>
    grouping === 'columns'
      ? { offset: { x: offset.x + index, y: offset.y }, width: 1, depth }
      : { offset: { x: offset.x, y: offset.y + index }, width, depth: 1 },
  )
}

/**
 * Raised rods for the same partition, one rod per group. Null when the group
 * value is outside the rod catalog; the flat partition still exists.
 */
export function areaGroupParts(
  rectangle: AreaRectangle,
  grouping: AreaGrouping,
): TrainPart[] | null {
  const reading = areaGroupReading(rectangle, grouping)
  if (!reading || !reading.rodSupported) return null

  // Checked above; never cast an arbitrary dimension into a rod value.
  const value = reading.unitsPerGroup
  if (!isRodValue(value)) return null

  const { offset } = rectangle

  return Array.from({ length: reading.count }, (_, index): TrainPart =>
    grouping === 'columns'
      ? { value, orientation: 'vertical', offset: { x: offset.x + index, y: offset.y } }
      : { value, orientation: 'horizontal', offset: { x: offset.x, y: offset.y + index } },
  )
}

/**
 * The rectangle a train's parts fill exactly, in anchor-relative coordinates.
 * Null for a tower, a hole, an L shape, overlapping parts, or any part off the
 * cell lattice. A bounding box alone would accept all of those.
 */
export function tiledRectangle(
  train: DeepReadonly<RodTrain>,
): AreaRectangle | null {
  if (!train.parts.length) return null

  const cells = new Set<string>()
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const part of train.parts) {
    if (part.orientation === 'tower') return null
    if (!isRodValue(part.value)) return null
    if (
      !Number.isInteger(part.offset.x) ||
      !Number.isInteger(part.offset.y)
    ) return null

    const width = part.orientation === 'horizontal' ? part.value : 1
    const depth = part.orientation === 'vertical' ? part.value : 1

    for (let y = part.offset.y; y < part.offset.y + depth; y++) {
      for (let x = part.offset.x; x < part.offset.x + width; x++) {
        const key = `${x},${y}`
        if (cells.has(key)) return null
        cells.add(key)

        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  const width = maxX - minX + 1
  const depth = maxY - minY + 1

  // Equal area proves the bounding box is filled, given no cell repeats.
  if (width * depth !== cells.size) return null

  return { offset: { x: minX, y: minY }, width, depth }
}

function layoutKey(parts: readonly DeepReadonly<TrainPart>[]): string {
  return parts
    .map(part => `${part.offset.y},${part.offset.x},${part.orientation},${part.value}`)
    .sort()
    .join('|')
}

/**
 * The grouping a filled rectangle already shows, derived from its complete part
 * layout. trainOrientation() cannot answer this: adjacent columns are not a
 * linear end-to-end train.
 */
export function areaGroupingOf(
  train: DeepReadonly<RodTrain>,
): AreaGrouping | undefined {
  const rectangle = tiledRectangle(train)
  if (!rectangle) return undefined

  const actual = layoutKey(train.parts)

  return areaGroupings.find(grouping => {
    const parts = areaGroupParts(rectangle, grouping)
    return parts !== null &&
      parts.length === train.parts.length &&
      layoutKey(parts) === actual
  })
}
