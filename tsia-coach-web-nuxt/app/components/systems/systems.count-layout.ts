import type { DeepReadonly } from 'vue'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import type { Rectangle, RodTrain, SceneRegion } from '~/components/rod/scene/rod.scene.types'
import { partFootprint } from '~/components/rod/scene/part-footprint'
import { partSign } from '~/components/rod/scene/rod-arithmetic'
import { trainFitsRegion } from '~/components/rod/scene/scene-regions'
import type { CandidateCounts } from './systems.candidates'
import type { SystemsBoardConfig, VariableId } from './systems.schema'

/**
 * Rendering geometry for the rod-count strategy. Rods stand upright side by
 * side, so a rectangle's width is a count and its height is a rod value.
 * Equation 1 is the learner's band (the only scene region); Equation 2 is a
 * derived check drawn below it and is never scene material.
 */

/** Columns left of the bands for variable labels. Never editable. */
export const COUNT_GUTTER_COLUMNS = 2
export const COUNT_REGION_ID = 'equation-1:rods'

export type CountBand = Rectangle & { equationIndex: 0 | 1 }

export type CountLayout = {
  columns: number
  rows: number
  /** The learner band, top-aligned. */
  upper: SceneRegion & CountBand
  /** The derived check band, bottom-aligned. Not a scene region. */
  lower: CountBand
  regions: readonly SceneRegion[]
}

export function countLayout(config: SystemsBoardConfig): CountLayout {
  const [first, second] = config.system.equations
  const width = config.laneColumns
  const upperDepth = Math.max(first.coefficients.x, first.coefficients.y)
  const lowerDepth = Math.max(second.coefficients.x, second.coefficients.y)
  const upper = {
    id: COUNT_REGION_ID,
    equationIndex: 0 as const,
    x: COUNT_GUTTER_COLUMNS,
    y: 0,
    width,
    depth: upperDepth,
    // Vertical first: rods created from the tray stand upright. Lying rods
    // still count (same area); towers are loose, uncounted material.
    orientations: ['vertical', 'horizontal', 'tower'] as const,
  }
  const lower = { equationIndex: 1 as const, x: COUNT_GUTTER_COLUMNS, y: upperDepth + config.regionGapRows, width, depth: lowerDepth }
  return {
    columns: COUNT_GUTTER_COLUMNS + width,
    rows: lower.y + lower.depth,
    upper,
    lower,
    regions: [upper],
  }
}

/** One counted rod: a part, upright or lying, whose value names its variable. */
export type CountUnit = {
  trainId: string
  partIndex: number
  variable: VariableId
  value: number
  footprint: Rectangle
  /** Standing in a single column; only upright units sit in a canonical slot. */
  upright: boolean
}

export type UnassignedReason = 'value' | 'orientation'

/** Material that is neither a whole x rod nor a whole y rod. Counted toward nothing. */
export type UnassignedPart = {
  trainId: string
  partIndex: number
  value: number
  footprint: Rectangle
  reason: UnassignedReason
}

export type CountMaterial = {
  units: readonly CountUnit[]
  unassigned: readonly UnassignedPart[]
  xCount: number
  yCount: number
  unassignedArea: number
}

type Snapshot = readonly DeepReadonly<RodTrain>[]

/**
 * Membership is explicit: the equation is the band a train lies in, and the
 * variable is the rod value (a or b), which differ by schema rule. A train may
 * hold several units, so units are parts, never train IDs.
 */
export function classifyCountMaterial(config: SystemsBoardConfig, trains: Snapshot): CountMaterial {
  const { x: a, y: b } = config.system.equations[0].coefficients
  const { upper } = countLayout(config)
  const units: CountUnit[] = []
  const unassigned: UnassignedPart[] = []
  for (const train of trains) {
    if (!trainFitsRegion(train, upper)) continue
    train.parts.forEach((part, partIndex) => {
      const footprint = partFootprint(part, train.anchor)
      const variable: VariableId | null = part.value === a ? 'x' : part.value === b ? 'y' : null
      if (variable && part.orientation !== 'tower') {
        units.push({ trainId: train.id, partIndex, variable, value: part.value, footprint, upright: part.orientation === 'vertical' })
      } else {
        unassigned.push({ trainId: train.id, partIndex, value: part.value, footprint, reason: variable ? 'orientation' : 'value' })
      }
    })
  }
  return {
    units,
    unassigned,
    xCount: units.filter(unit => unit.variable === 'x').length,
    yCount: units.filter(unit => unit.variable === 'y').length,
    unassignedArea: unassigned.reduce((sum, part) => sum + part.value, 0),
  }
}

/** Board column of each canonical slot: x rods first, then y rods, top-aligned. */
export function canonicalSlots(layout: CountLayout, counts: CandidateCounts): Record<VariableId, number[]> {
  const column = (index: number) => layout.upper.x + index
  return {
    x: Array.from({ length: counts.xCount }, (_, index) => column(index)),
    y: Array.from({ length: counts.yCount }, (_, index) => column(counts.xCount + index)),
  }
}

export function unitTrain(column: number, row: number, value: number, id = ''): RodTrain {
  return {
    id,
    anchor: { x: column, y: row },
    parts: [{ value: value as CuisenaireRodValue, offset: { x: 0, y: 0 }, orientation: 'vertical' }],
  }
}

/**
 * The automatic check: Equation 2's rods for the same counts, bottom-aligned
 * so x columns sit under Equation 1's x columns. Decorative and never saved.
 */
export function derivedLowerTrains(config: SystemsBoardConfig, counts: CandidateCounts): RodTrain[] {
  const layout = countLayout(config)
  const { x: d, y: e } = config.system.equations[1].coefficients
  const bottom = layout.lower.y + layout.lower.depth
  const slots = canonicalSlots(layout, counts)
  return [
    ...slots.x.map((column, index) => unitTrain(column, bottom - d, d, `derived-x-${index}`)),
    ...slots.y.map((column, index) => unitTrain(column, bottom - e, e, `derived-y-${index}`)),
  ]
}

/** Every unit already in its canonical slot, with nothing else on the band. */
export function isCanonical(config: SystemsBoardConfig, material: CountMaterial): boolean {
  if (material.unassigned.length) return false
  const layout = countLayout(config)
  const slots = canonicalSlots(layout, { xCount: material.xCount, yCount: material.yCount })
  return material.units.every(unit =>
    unit.upright && unit.footprint.y === layout.upper.y && slots[unit.variable].includes(unit.footprint.x))
}

export const hasNegative = (trains: Snapshot) => trains.some(train => train.parts.some(part => partSign(part) === -1))
