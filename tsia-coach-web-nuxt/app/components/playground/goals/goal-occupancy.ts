import type { SceneSnapshot } from '~/components/rod/scene/scene-snapshot'
import type { GoalCondition } from './goal.types'
export type CellKey = `${number},${number}`
export type GoalRegion = { id: string; label: string; x: number; y: number; width: number; depth: number }
/** Union actual part footprints, clipped to the region, in region-relative cells. */
export function occupiedCells(scene: SceneSnapshot, region: GoalRegion): Set<CellKey> {
  const cells = new Set<CellKey>()
  for (const train of scene) for (const part of train.parts) {
    const left = train.anchor.x + part.offset.x
    const top = train.anchor.y + part.offset.y
    const width = part.orientation === 'horizontal' ? part.value : 1
    const depth = part.orientation === 'vertical' ? part.value : 1
    for (let y = Math.max(top, region.y); y < Math.min(top + depth, region.y + region.depth); y++) {
      for (let x = Math.max(left, region.x); x < Math.min(left + width, region.x + region.width); x++) {
        cells.add(`${x - region.x},${y - region.y}`)
      }
    }
  }
  return cells
}
export function matchesRectangle(occupied: ReadonlySet<CellKey>, goal: Extract<GoalCondition, { type: 'filled-rectangle' }>): boolean {
  if (occupied.size !== goal.columns * goal.rows) return false
  for (let y = goal.y; y < goal.y + goal.rows; y++) {
    for (let x = goal.x; x < goal.x + goal.columns; x++) {
      if (!occupied.has(`${x},${y}`)) return false
    }
  }
  return true
}
export function matchesExactFraction(actual: { numerator: number; denominator: number }, expected: Extract<GoalCondition, { type: 'fraction-exact' }>): boolean {
  return actual.denominator > 0 && actual.numerator === expected.numerator && actual.denominator === expected.denominator
}
