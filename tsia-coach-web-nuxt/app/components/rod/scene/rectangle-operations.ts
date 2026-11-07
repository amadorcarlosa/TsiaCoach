import type { DeepReadonly } from 'vue'
import type { Point } from '~/components/grid/gridPointer'
import { offsetsByDistance } from '~/components/grid/nearest-offsets'
import type { AreaGrouping, AreaRectangle } from '~/components/tabla/area-grouping'
import { areaGroupPartitions, tiledRectangle } from '~/components/tabla/area-grouping'
import { CuisenaireRodValues, type CuisenaireRodValue } from '../rod.types'
import { factorParts, factorShapes } from './factor-groupings'
import { partFootprint } from './part-footprint'
import { isRodSign } from './rod-arithmetic'
import type { FactorShape, Rectangle, RodTrain, TrainPart } from './rod.scene.types'

/**
 * Pure area operations on rectangles. They never look at a board: callers pass
 * an acceptance test that runs the scene's full placement validation, so
 * availability and commit share one rule.
 */

type Snapshot = readonly DeepReadonly<RodTrain>[]

export type RectangleResult<T> = { allowed: true; value: T } | { allowed: false; reason: string }

const allow = <T>(value: T): RectangleResult<T> => ({ allowed: true, value })
const reject = (reason: string): RectangleResult<never> => ({ allowed: false, reason })

export const rectangleReasons = {
  select: 'Select at least one rod to make a rectangle.',
  duplicate: 'Each selected object can be used once.',
  tower: 'Lay towers down before making a rectangle.',
  signs: 'Rectangles are available for positive rods only.',
  roles: 'Select material of one kind to make a rectangle.',
  shape: 'Choose a rectangle whose rows × columns equal the selected area.',
  space: 'No room for this rectangle. Move other rods or choose another shape.',
} as const

/** Physical cells of the selection, with the metadata a rectangle would carry. */
export function selectionArea(selected: Snapshot): RectangleResult<{ area: number; materialRole?: RodTrain['materialRole'] }> {
  if (!selected.length) return reject(rectangleReasons.select)
  if (new Set(selected.map(train => train.id)).size !== selected.length) return reject(rectangleReasons.duplicate)
  const parts = selected.flatMap(train => train.parts)
  if (!parts.length) return reject(rectangleReasons.select)
  if (parts.some(part => part.orientation === 'tower')) return reject(rectangleReasons.tower)
  // Area work has no signed meaning yet; never drop a sign silently.
  if (parts.some(part => part.sign !== undefined && (!isRodSign(part.sign) || part.sign === -1))) return reject(rectangleReasons.signs)
  const roles = new Set(selected.map(train => train.materialRole ?? null))
  if (roles.size > 1) return reject(rectangleReasons.roles)
  const area = parts.reduce((sum, part) => sum + part.value, 0)
  if (!Number.isSafeInteger(area) || area < 1) return reject(rectangleReasons.select)
  const role = selected[0]!.materialRole
  return allow(role ? { area, materialRole: role } : { area })
}

/**
 * Every integer rectangle of this area, including a single row or column.
 * Shapes `prefer` accepts come first, then the most square.
 */
export function rectangleShapes(area: number, prefer?: (shape: FactorShape) => boolean): FactorShape[] {
  return factorShapes(area, true)
    .map(shape => ({ shape, preferred: prefer?.(shape) === true }))
    .sort((a, b) => Number(b.preferred) - Number(a.preferred))
    .map(item => item.shape)
}

const sameShape = (a: FactorShape, b: FactorShape) => a.rows === b.rows && a.columns === b.columns

/** The box around every cell the trains cover. */
export function cellBounds(trains: Snapshot): Rectangle {
  const boxes = trains.flatMap(train => train.parts.map(part => partFootprint(part, train.anchor)))
  const x = Math.min(...boxes.map(box => box.x))
  const y = Math.min(...boxes.map(box => box.y))
  return {
    x,
    y,
    width: Math.max(...boxes.map(box => box.x + box.width)) - x,
    depth: Math.max(...boxes.map(box => box.y + box.depth)) - y,
  }
}

/**
 * One train filling `shape`, made of catalog rods: each row is a train of the
 * largest rods that fit, so 3 columns × 8 rows is eight horizontal 3-rods.
 * Placed right-aligned at the top of the selection's bounds when that fits,
 * otherwise at the nearest position `accept` allows inside `area`.
 */
export function planRectangle(
  selected: Snapshot,
  shape: FactorShape,
  area: Rectangle,
  accept: (train: RodTrain) => boolean,
): RectangleResult<RodTrain> {
  const measured = selectionArea(selected)
  if (!measured.allowed) return measured
  const valid = rectangleShapes(measured.value.area)
  if (!Number.isInteger(shape.rows) || !Number.isInteger(shape.columns) || !valid.some(item => sameShape(item, shape))) {
    return reject(rectangleReasons.shape)
  }

  const bounds = cellBounds(selected)
  const origin: Point = { x: bounds.x + bounds.width - shape.columns, y: bounds.y }
  const parts = factorParts(shape)
  const at = (offset: Point): RodTrain => ({
    id: '',
    anchor: { x: origin.x + offset.x, y: origin.y + offset.y },
    parts: parts.map(part => ({ ...part, offset: { ...part.offset } })),
    ...(measured.value.materialRole ? { materialRole: measured.value.materialRole } : {}),
  })
  const inside = (train: RodTrain) =>
    train.anchor.x >= area.x && train.anchor.y >= area.y &&
    train.anchor.x + shape.columns <= area.x + area.width &&
    train.anchor.y + shape.rows <= area.y + area.depth

  function* offsets(): Generator<Point> {
    yield { x: 0, y: 0 }
    yield* offsetsByDistance({
      minX: area.x - origin.x,
      maxX: area.x + area.width - shape.columns - origin.x,
      minY: area.y - origin.y,
      maxY: area.y + area.depth - shape.rows - origin.y,
    })
  }
  for (const offset of offsets()) {
    const candidate = at(offset)
    if (inside(candidate) && accept(candidate)) return allow(candidate)
  }
  return reject(rectangleReasons.space)
}

const descending = Object.values(CuisenaireRodValues).sort((a, b) => b - a)

/** Catalog rods covering `length` cells: 12 is 10 + 2. */
export function catalogLengths(length: number): CuisenaireRodValue[] {
  const values: CuisenaireRodValue[] = []
  let remaining = length
  for (const value of descending) {
    while (remaining >= value) {
      values.push(value)
      remaining -= value
    }
  }
  return values
}

/**
 * One independent train per group of a filled rectangle, each tiled with
 * catalog rods along the group. A column grouping gives vertical trains and a
 * row grouping horizontal ones, so groups of any size keep their boundaries
 * without casting a dimension to a rod value. Board coordinates.
 */
export function areaGroupTrains(rectangle: AreaRectangle, grouping: AreaGrouping, anchor: Point = { x: 0, y: 0 }): RodTrain[] | null {
  const bands = areaGroupPartitions(rectangle, grouping)
  if (!bands) return null
  const orientation: TrainPart['orientation'] = grouping === 'columns' ? 'vertical' : 'horizontal'
  return bands.map(band => {
    const length = grouping === 'columns' ? band.depth : band.width
    let cursor = 0
    const parts = catalogLengths(length).map((value): TrainPart => {
      const part: TrainPart = {
        value,
        orientation,
        offset: grouping === 'columns' ? { x: 0, y: cursor } : { x: cursor, y: 0 },
      }
      cursor += value
      return part
    })
    return { id: '', anchor: { x: anchor.x + band.offset.x, y: anchor.y + band.offset.y }, parts }
  })
}

/**
 * Turns a filled rectangle a quarter about its corner: rows become columns.
 * Every part must share one orientation; `orientation` is the one they take.
 * Null for anything that is not a single-orientation filled rectangle.
 */
export function transposeRectangle(
  train: DeepReadonly<RodTrain>,
  orientation: Extract<TrainPart['orientation'], 'horizontal' | 'vertical'>,
): RodTrain | null {
  const rectangle = tiledRectangle(train)
  if (!rectangle) return null
  const current = new Set(train.parts.map(part => part.orientation))
  if (current.size !== 1) return null
  const [from] = current
  const copy = (part: DeepReadonly<TrainPart>, swap: boolean): TrainPart => ({
    ...(part.sign !== undefined ? { sign: part.sign } : {}),
    value: part.value,
    orientation: swap ? orientation : part.orientation,
    offset: swap
      ? { x: part.offset.y - rectangle.offset.y + rectangle.offset.x, y: part.offset.x - rectangle.offset.x + rectangle.offset.y }
      : { ...part.offset },
  })
  return {
    id: train.id,
    anchor: { ...train.anchor },
    parts: train.parts.map(part => copy(part, from !== orientation)),
    ...(train.materialRole ? { materialRole: train.materialRole } : {}),
  }
}

/**
 * Several selected objects as one object, every part kept where it is. Used
 * to recognise a selection that already fills a rectangle; the caller still
 * checks that it is filled. Null for mixed roles.
 */
export function combineTrains(selected: Snapshot): RodTrain | null {
  if (!selected.length) return null
  if (new Set(selected.map(train => train.materialRole ?? null)).size > 1) return null
  const x = Math.min(...selected.map(train => train.anchor.x))
  const y = Math.min(...selected.map(train => train.anchor.y))
  const role = selected[0]!.materialRole
  return {
    id: '',
    anchor: { x, y },
    parts: selected.flatMap(train => train.parts.map((part): TrainPart => ({
      ...(part.sign !== undefined ? { sign: part.sign } : {}),
      value: part.value,
      orientation: part.orientation,
      offset: { x: train.anchor.x + part.offset.x - x, y: train.anchor.y + part.offset.y - y },
    }))),
    ...(role ? { materialRole: role } : {}),
  }
}

/** A filled rectangle as unit cells, keeping its footprint. */
export function rectangleOnes(train: DeepReadonly<RodTrain>): TrainPart[] | null {
  const rectangle = tiledRectangle(train)
  if (!rectangle) return null
  const parts: TrainPart[] = []
  for (let y = 0; y < rectangle.depth; y++) {
    for (let x = 0; x < rectangle.width; x++) {
      parts.push({ value: 1, orientation: 'horizontal', offset: { x: rectangle.offset.x + x, y: rectangle.offset.y + y } })
    }
  }
  return parts
}

/** The cells of a placed train, as "x,y" keys, for invariant checks. */
export function trainCells(train: DeepReadonly<RodTrain>): string[] {
  const cells: string[] = []
  for (const part of train.parts) {
    const box = partFootprint(part, train.anchor)
    for (let y = box.y; y < box.y + box.depth; y++) {
      for (let x = box.x; x < box.x + box.width; x++) cells.push(`${x},${y}`)
    }
  }
  return cells.sort()
}
