import { describe, expect, it } from 'vitest'
import { createArrayGoalAdapter, createBarGoalAdapter, createFractionGoalAdapter, createMathTablaGoalAdapter } from './board-goal-adapters'
import type { AuthoringGoal, GoalCondition } from './goal.types'
import type { RodTrain } from '~/components/rod/scene/rod.scene.types'
import { authoringGoalSchema } from './goal.schema'
const all = (...conditions: GoalCondition[]): AuthoringGoal => ({ type: 'all', conditions })
const rod = (value: RodTrain['parts'][number]['value'], x: number, y: number, orientation: RodTrain['parts'][number]['orientation'] = 'horizontal'): RodTrain => ({ id: `${x},${y}`, anchor: { x, y }, parts: [{ value, offset: { x: 0, y: 0 }, orientation }] })
const array = createArrayGoalAdapter({ columns: 12, rows: 10 })
const fraction = createFractionGoalAdapter({ columns: 12, pairCount: 2 })
const rectangle = all({ type: 'filled-rectangle', regionId: 'array', x: 0, y: 0, columns: 3, rows: 2 })
describe('goal semantics', () => {
  it('compares raw 2/3 totals, rejecting 4/6 and zero denominators', () => {
    const goal = all({ type: 'fraction-exact', pairId: 'pair-0', numerator: 2, denominator: 3 })
    expect(fraction.evaluate(goal, [rod(2, 0, 1), rod(3, 0, 2)]).satisfied).toBe(true)
    expect(fraction.evaluate(goal, [rod(4, 0, 1), rod(6, 0, 2)]).satisfied).toBe(false)
    expect(fraction.evaluate(goal, [rod(2, 0, 1)]).satisfied).toBe(false)
  })
  it('empty pair requires both tracks empty, not an incomplete fraction', () => {
    const goal = all({ type: 'empty-pair', pairId: 'pair-0' })
    expect(fraction.evaluate(goal, []).satisfied).toBe(true)
    for (const y of [1, 2]) expect(fraction.evaluate(goal, [rod(2, 0, y)]).satisfied).toBe(false)
  })
  it('requires exact rectangle membership, rejecting scattered or additional cells', () => {
    const filled = [rod(3, 0, 0), rod(3, 0, 1)]
    expect(array.evaluate(rectangle, filled).satisfied).toBe(true)
    expect(array.evaluate(rectangle, [rod(3, 0, 0), rod(3, 0, 3)]).satisfied).toBe(false)
    expect(array.evaluate(rectangle, [...filled, rod(1, 5, 5)]).satisfied).toBe(false)
  })
  it('counts tower footprints separately from values and deduplicates cells', () => {
    const tower = rod(10, 0, 0, 'tower')
    expect(array.evaluate(all({ type: 'occupied-area', regionId: 'array', cells: 1 }), [tower, tower]).satisfied).toBe(true)
    expect(array.evaluate(all({ type: 'region-total', regionId: 'array', value: 10 }), [tower]).satisfied).toBe(true)
  })
  it('combines independent targets with AND, uses region-relative coordinates and ignores other regions', () => {
    const adapter = createMathTablaGoalAdapter({ centralColumns: 12, centralRows: 10 })
    const goal = all({ type: 'fraction-exact', pairId: 'horizontal', numerator: 3, denominator: 4 }, { type: 'fraction-exact', pairId: 'vertical', numerator: 2, denominator: 3 }, rectangle.conditions[0]!)
    const scene = [rod(3, 2, 1), rod(4, 2, 0), rod(2, 1, 2, 'vertical'), rod(3, 0, 2, 'vertical'), rod(3, 2, 2), rod(3, 2, 3)]
    expect(adapter.evaluate(goal, scene).satisfied).toBe(true)
    expect(adapter.evaluate(goal, scene.slice(1)).satisfied).toBe(false)
    expect(adapter.evaluate(rectangle, scene).satisfied).toBe(true)
  })
  it('null means no goal authored, never success', () => {
    expect(authoringGoalSchema.safeParse(null).success).toBe(false)
    // Exercise defensive runtime behavior without widening the authored contract.
    expect(Reflect.apply(array.evaluate, array, [null, []]).satisfied).toBe(false)
  })
  it.each([
    { type: 'equivalent', pairId: 'pair-0' },
    { type: 'empty-region', regionId: 'missing' },
    { type: 'empty-pair', pairId: 'pair-0' },
    { type: 'occupied-area', regionId: 'array', cells: 121 },
    { type: 'filled-rectangle', regionId: 'array', x: 11, y: 0, columns: 2, rows: 1 },
    { type: 'region-total', regionId: 'array', value: -1 },
    { type: 'empty-region', regionId: 'array', extra: true },
  ])('rejects unsupported, invalid and out-of-bounds conditions: %j', condition => {
    expect(array.parse({ type: 'all', conditions: [condition] }).allowed).toBe(false)
  })
  it('rejects unknown pairs, oversized fractions and duplicate targets', () => {
    for (const pairId of ['missing', 'pair-0']) expect(fraction.parse(all({ type: 'fraction-exact', pairId, numerator: 13, denominator: 1 })).allowed).toBe(false)
    expect(array.parse(all({ type: 'empty-region', regionId: 'array' }, { type: 'occupied-area', regionId: 'array', cells: 0 })).allowed).toBe(false)
    expect(createBarGoalAdapter({ columns: 24, targetCount: 3 }).parse(rectangle).allowed).toBe(false)
  })
})

it('validates every goal field strictly and returns newly parsed plain data', () => {
  const valid = [
    { type: 'fraction-exact', pairId: 'pair-0', numerator: 0, denominator: 1 },
    { type: 'empty-pair', pairId: 'pair-0' },
    { type: 'empty-region', regionId: 'array' },
    { type: 'region-total', regionId: 'array', value: 0 },
    { type: 'occupied-area', regionId: 'array', cells: 0 },
    { type: 'filled-rectangle', regionId: 'array', x: 0, y: 0, columns: 1, rows: 1 },
  ]
  for (const condition of valid) {
    expect(authoringGoalSchema.safeParse({ type: 'all', conditions: [condition] }).success).toBe(true)
    for (const key of Object.keys(condition)) {
      expect(authoringGoalSchema.safeParse({ type: 'all', conditions: [{ ...condition, [key]: undefined }] }).success).toBe(false)
      expect(authoringGoalSchema.safeParse({ type: 'all', conditions: [{ ...condition, [key]: null }] }).success).toBe(false)
      if (key !== 'type') expect(authoringGoalSchema.safeParse({ type: 'all', conditions: [{ ...condition, [key]: typeof Reflect.get(condition, key) === 'number' ? 0.5 : '   ' }] }).success).toBe(false)
    }
  }
  for (const input of [{ type: 'all', conditions: [] }, { type: 'any', conditions: [valid[2]] }, { type: 'all', conditions: [valid[2]], extra: 1 }]) {
    expect(authoringGoalSchema.safeParse(input).success).toBe(false)
  }
  const input = { type: 'all', conditions: [{ type: 'empty-region', regionId: ' array ' }] }
  const parsed = array.parse(input)
  expect(parsed).toEqual({ allowed: true, value: { type: 'all', conditions: [{ type: 'empty-region', regionId: 'array' }] } })
  input.conditions[0]!.regionId = 'changed'
  if (parsed.allowed) expect(parsed.value.conditions[0]).toMatchObject({ regionId: 'array' })
})

it('evaluation can be passed as a standalone callback and only reads the scene', () => {
  const { evaluate } = array
  const scene = Object.freeze([Object.freeze({ id: 'tower', anchor: Object.freeze({ x: 0, y: 0 }), parts: Object.freeze([Object.freeze({ value: 10 as const, orientation: 'tower' as const, offset: Object.freeze({ x: 0, y: 0 }) })]) })])
  expect(evaluate(all({ type: 'occupied-area', regionId: 'array', cells: 1 }), scene).satisfied).toBe(true)
})
