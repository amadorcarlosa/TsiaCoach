import { getTablaGeometry } from '~/components/tabla/tabla.geometry'
import { getFractionTablaGeometry } from '~/components/tabla/fraction-tabla.geometry'
import { getMathTablaGeometry } from '~/components/tabla/mathtabla.geometry'
import { fractionReadout } from '~/components/tabla/fraction-readout'
import { getMathTablaReadouts } from '~/components/tabla/mathtabla.readouts'
import type { SceneSnapshot } from '~/components/rod/scene/scene-snapshot'
import { authoringGoalSchema } from './goal.schema'
import type { BoardGoalAdapter, GoalCondition, GoalTarget } from './goal.types'
import { occupiedCells, matchesRectangle, matchesExactFraction, type GoalRegion } from './goal-occupancy'

type Pair = GoalTarget & { numeratorCapacity: number; denominatorCapacity: number; read: (scene: SceneSnapshot) => { numerator: number; denominator: number } }
const regionTypes = ['empty-region', 'region-total', 'occupied-area', 'filled-rectangle'] as const
function createAdapter(regions: GoalRegion[], pairs: Pair[] = []): BoardGoalAdapter {
  const supportedTypes: GoalCondition['type'][] = [...regionTypes, ...(pairs.length ? ['fraction-exact', 'empty-pair'] as const : [])]
  const adapter: BoardGoalAdapter = {
    supportedTypes, regions, pairs,
    parse(input) {
      const parsed = authoringGoalSchema.safeParse(input)
      if (!parsed.success) return { allowed: false, reason: parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') }
      const used = new Set<string>()
      for (const condition of parsed.data.conditions) {
        if (!supportedTypes.includes(condition.type)) return { allowed: false, reason: 'Unsupported condition type.' }
        const key = 'pairId' in condition ? `pair:${condition.pairId}` : `region:${condition.regionId}`
        if (used.has(key)) return { allowed: false, reason: 'Duplicate target conditions are not supported.' }
        used.add(key)
        if ('pairId' in condition) {
          const pair = pairs.find(pair => pair.id === condition.pairId)
          if (!pair) return { allowed: false, reason: 'Unknown pair.' }
          if (condition.type === 'fraction-exact' && (condition.numerator > pair.numeratorCapacity || condition.denominator > pair.denominatorCapacity)) return { allowed: false, reason: 'Fraction totals exceed track capacity.' }
        } else {
          const region = regions.find(region => region.id === condition.regionId)
          if (!region) return { allowed: false, reason: 'Unknown region.' }
          if (condition.type === 'occupied-area' && condition.cells > region.width * region.depth) return { allowed: false, reason: 'Occupied area exceeds region capacity.' }
          if (condition.type === 'filled-rectangle' && (condition.x + condition.columns > region.width || condition.y + condition.rows > region.depth)) return { allowed: false, reason: 'Rectangle exceeds region bounds.' }
        }
      }
      return { allowed: true, value: parsed.data }
    },
    evaluate(goal, scene) {
      // Defensive for runtime callers: absent or invalid goals are not success.
      const parsed = adapter.parse(goal)
      if (!parsed.allowed) return { satisfied: false, conditions: [] }
      const conditions = parsed.value.conditions.map((condition, index) => {
        let satisfied: boolean
        if ('pairId' in condition) {
          const actual = pairs.find(pair => pair.id === condition.pairId)!.read(scene)
          satisfied = condition.type === 'empty-pair'
            ? actual.numerator === 0 && actual.denominator === 0
            : matchesExactFraction(actual, condition)
        } else {
          const region = regions.find(region => region.id === condition.regionId)!
          const occupied = occupiedCells(scene, region)
          switch (condition.type) {
            case 'empty-region': satisfied = occupied.size === 0; break
            case 'occupied-area': satisfied = occupied.size === condition.cells; break
            case 'filled-rectangle': satisfied = matchesRectangle(occupied, condition); break
            case 'region-total': {
              let total = 0
              for (const train of scene) for (const part of train.parts) {
                const x = train.anchor.x + part.offset.x
                const y = train.anchor.y + part.offset.y
                const width = part.orientation === 'horizontal' ? part.value : 1
                const depth = part.orientation === 'vertical' ? part.value : 1
                if (x >= region.x && y >= region.y && x + width <= region.x + region.width && y + depth <= region.y + region.depth) total += part.value
              }
              satisfied = total === condition.value
            }
          }
        }
        return { index, satisfied, ...(!satisfied ? { reason: 'Condition is not satisfied.' } : {}) }
      })
      return { satisfied: conditions.every(condition => condition.satisfied), conditions }
    },
  }
  return adapter
}
export function createBarGoalAdapter(config: { columns: number; targetCount: number }) {
  const geometry = getTablaGeometry(config.targetCount, 1, config.columns)
  return createAdapter(geometry.targets.map((target, index) => ({ id: target.id, label: `Target ${index + 1}`, x: 0, y: target.row, width: config.columns, depth: 1 })))
}
export function createArrayGoalAdapter(config: { columns: number; rows: number }) {
  return createAdapter([{ id: 'array', label: 'Array', x: 0, y: 0, width: config.columns, depth: config.rows }])
}
export function createFractionGoalAdapter(config: { columns: number; pairCount: number }) {
  const geometry = getFractionTablaGeometry(config.pairCount, 1, config.columns)
  return createAdapter(geometry.targets.flatMap((target, index) => [
    { id: `${target.id}-n`, label: `Fraction ${index + 1} numerator`, x: 0, y: target.numeratorRow, width: config.columns, depth: 1 },
    { id: `${target.id}-d`, label: `Fraction ${index + 1} denominator`, x: 0, y: target.denominatorRow, width: config.columns, depth: 1 },
  ]), geometry.targets.map((target, index) => ({ id: target.id, label: `Fraction ${index + 1}`, numeratorCapacity: config.columns, denominatorCapacity: config.columns, read: scene => fractionReadout(scene, geometry.targets).find(pair => pair.pairId === target.id)! })))
}
export function createMathTablaGoalAdapter(config: { centralColumns: number; centralRows: number }) {
  const geometry = getMathTablaGeometry(config.centralColumns, config.centralRows, 1)
  const labels = ['Horizontal denominator', 'Horizontal numerator', 'Vertical denominator', 'Vertical numerator', 'Central array']
  return createAdapter(geometry.regions.map((region, index) => ({ ...region, label: labels[index]! })), (['horizontal', 'vertical'] as const).map(id => ({
    id, label: `${id === 'horizontal' ? 'Horizontal' : 'Vertical'} reference pair`,
    numeratorCapacity: id === 'horizontal' ? config.centralColumns : config.centralRows,
    denominatorCapacity: id === 'horizontal' ? config.centralColumns : config.centralRows,
    read: scene => getMathTablaReadouts(scene, geometry)[id],
  })))
}
