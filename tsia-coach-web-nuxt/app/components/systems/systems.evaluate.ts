import type { DeepReadonly } from 'vue'
import type { RodTrain } from '~/components/rod/scene/rod.scene.types'
import { partFootprint } from '~/components/rod/scene/part-footprint'
import { partSign } from '~/components/rod/scene/rod-arithmetic'
import { trainFitsRegion } from '~/components/rod/scene/scene-regions'
import { systemsGeometry, type VariableRegion } from './systems.geometry'
import type { SystemsBoardConfig, VariableId } from './systems.schema'

/**
 * Pure snapshot-to-constraint evaluation: no DOM, no Vue state, no mutation.
 * It reports what the committed rods show and never infers a missing value.
 */

export type GroupStatus =
  | 'empty'
  | 'incomplete'
  | 'gaps'
  | 'unequal-widths'
  | 'misaligned'
  | 'rectangle'

export type GroupEvaluation = {
  regionId: string
  equationId: string
  variable: VariableId
  coefficient: number
  occupiedArea: number
  /** Cells in each lane, top to bottom. Observed, not a claimed value. */
  rowWidths: readonly number[]
  status: GroupStatus
  /** The variable length, only for a complete rectangle. */
  length: number | null
  /** Region-relative start column of a complete rectangle. */
  start: number | null
}

export type EquationEvaluation = {
  equationId: string
  index: number
  targetArea: number
  occupiedArea: number
  /** occupied - target: positive is excess, negative is missing. */
  difference: number
  areaMatches: boolean
  /** Both groups are rectangles and the area matches. */
  satisfied: boolean
  groups: Record<VariableId, GroupEvaluation>
}

export type Agreement = 'unknown' | 'agrees' | 'disagrees'

export type SystemEvaluation =
  | {
      valid: true
      equations: readonly [EquationEvaluation, EquationEvaluation]
      agreement: Record<VariableId, Agreement>
      satisfied: boolean
      /** Cells of loose material in staging. Counted toward nothing. */
      stagingArea: number
    }
  | { valid: false; reason: string }

type Snapshot = readonly DeepReadonly<RodTrain>[]

function cellsOf(train: DeepReadonly<RodTrain>): { x: number; y: number }[] {
  return train.parts.flatMap(part => {
    const box = partFootprint(part, train.anchor)
    const cells: { x: number; y: number }[] = []
    for (let y = box.y; y < box.y + box.depth; y++) {
      for (let x = box.x; x < box.x + box.width; x++) cells.push({ x, y })
    }
    return cells
  })
}

function evaluateGroup(region: VariableRegion, snapshot: Snapshot): GroupEvaluation {
  const lanes: number[][] = Array.from({ length: region.coefficient }, () => [])
  for (const train of snapshot) {
    if (!trainFitsRegion(train, region)) continue
    for (const cell of cellsOf(train)) lanes[cell.y - region.y]!.push(cell.x - region.x)
  }
  for (const lane of lanes) lane.sort((a, b) => a - b)

  const rowWidths = lanes.map(lane => lane.length)
  const occupiedArea = rowWidths.reduce((sum, width) => sum + width, 0)
  const base = {
    regionId: region.id,
    equationId: region.equationId,
    variable: region.variable,
    coefficient: region.coefficient,
    occupiedArea,
    rowWidths,
    length: null,
    start: null,
  }

  if (occupiedArea === 0) return { ...base, status: 'empty' }
  if (lanes.some(lane => lane.length === 0)) return { ...base, status: 'incomplete' }
  // A lane is solid when its cells run without a break from first to last.
  if (lanes.some(lane => lane[lane.length - 1]! - lane[0]! + 1 !== lane.length)) {
    return { ...base, status: 'gaps' }
  }
  if (new Set(rowWidths).size > 1) return { ...base, status: 'unequal-widths' }
  // Equal counts are not enough: every row must start in the same column.
  if (new Set(lanes.map(lane => lane[0])).size > 1) return { ...base, status: 'misaligned' }

  return { ...base, status: 'rectangle', length: rowWidths[0]!, start: lanes[0]![0]! }
}

export function evaluateSystem(config: SystemsBoardConfig, snapshot: Snapshot): SystemEvaluation {
  const geometry = systemsGeometry(config)

  // Untrusted input is refused, never counted: overlapping material would
  // otherwise count twice toward an area.
  const seen = new Set<string>()
  for (const train of snapshot) {
    if (train.parts.some(part => partSign(part) === -1)) {
      return { valid: false, reason: 'Negative rods are not used on this board.' }
    }
    if (!geometry.regions.some(region => trainFitsRegion(train, region))) {
      return { valid: false, reason: 'A train lies outside every group.' }
    }
    for (const cell of cellsOf(train)) {
      const key = `${cell.x},${cell.y}`
      if (seen.has(key)) return { valid: false, reason: 'Two rods share the same cells.' }
      seen.add(key)
    }
  }

  const equations = config.system.equations.map((equation, index): EquationEvaluation => {
    const group = (variable: VariableId) => evaluateGroup(
      geometry.variableRegions.find(region => region.equationId === equation.id && region.variable === variable)!,
      snapshot,
    )
    const groups = { x: group('x'), y: group('y') }
    const occupiedArea = groups.x.occupiedArea + groups.y.occupiedArea
    const areaMatches = occupiedArea === equation.targetArea
    return {
      equationId: equation.id,
      index,
      targetArea: equation.targetArea,
      occupiedArea,
      difference: occupiedArea - equation.targetArea,
      areaMatches,
      satisfied: areaMatches && groups.x.status === 'rectangle' && groups.y.status === 'rectangle',
      groups,
    }
  }) as unknown as readonly [EquationEvaluation, EquationEvaluation]

  // Missing data is never equality: both lengths must exist to compare.
  const agree = (variable: VariableId): Agreement => {
    const [first, second] = equations.map(equation => equation.groups[variable].length)
    if (first === null || second === null) return 'unknown'
    return first === second ? 'agrees' : 'disagrees'
  }
  const agreement = { x: agree('x'), y: agree('y') }

  const stagingArea = snapshot
    .filter(train => geometry.staging && trainFitsRegion(train, geometry.staging))
    .reduce((sum, train) => sum + cellsOf(train).length, 0)

  return {
    valid: true,
    equations,
    agreement,
    satisfied: equations.every(equation => equation.satisfied) &&
      agreement.x === 'agrees' && agreement.y === 'agrees',
    stagingArea,
  }
}
