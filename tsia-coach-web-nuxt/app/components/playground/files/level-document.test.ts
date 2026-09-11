import { describe, expect, it } from 'vitest'
import { createArrayGoalAdapter, createBarGoalAdapter, createFractionGoalAdapter, createMathTablaGoalAdapter } from '../goals/board-goal-adapters'
import { validateSnapshot } from '~/components/rod/scene/validate-snapshot'
import { getMathTablaGeometry } from '~/components/tabla/mathtabla.geometry'
import { validateLevelDocument, type LevelDocumentAdapter, type LevelDocumentV1 } from './level-document'
import { boardDescriptorSchema, levelDocumentSchema, partSchema, pointSchema, stepSchema, trainSchema } from './level-document.schema'
const adapter: LevelDocumentAdapter = {
  board: { kind: 'array', config: { columns: 24, rows: 12 } },
  goals: createArrayGoalAdapter({ columns: 24, rows: 12 }),
  validateSnapshot: scene => validateSnapshot(scene, { columns: 24, rows: 12, spawnRows: [0], allowOrientation: true, editable: () => false }),
}
export function documentFixture(): LevelDocumentV1 {
  return { version: 1, board: { kind: 'array', config: { columns: 24, rows: 12 } }, steps: [{
    id: 'step-1', title: 'First', prompt: 'Make a rectangle.',
    trains: [{ id: 'train-1', anchor: { x: 0, y: 0 }, parts: [{ value: 3, offset: { x: 0, y: 0 }, orientation: 'horizontal' }] }],
    goal: { type: 'all', conditions: [{ type: 'occupied-area', regionId: 'array', cells: 6 }] },
  }] }
}
describe('strict document schemas', () => {
  it.each([null, {}, { x: 0.5, y: 0 }, { x: 0, y: '0' }, { x: 0, y: 0, z: 0 }])('rejects invalid points %j', input => expect(pointSchema.safeParse(input).success).toBe(false))
  it.each([0, 11, 1.5, '2', null, Infinity, NaN])('rejects invalid rod values %j', value => {
    expect(partSchema.safeParse({ ...documentFixture().steps[0]!.trains[0]!.parts[0], value }).success).toBe(false)
  })
  it.each(['diagonal', '', null])('rejects invalid orientation %j', orientation => {
    expect(partSchema.safeParse({ ...documentFixture().steps[0]!.trains[0]!.parts[0], orientation }).success).toBe(false)
  })
  it.each(['', '   ', null, 1])('rejects invalid train and step IDs %j', id => {
    expect(trainSchema.safeParse({ ...documentFixture().steps[0]!.trains[0], id }).success).toBe(false)
    expect(stepSchema.safeParse({ ...documentFixture().steps[0], id }).success).toBe(false)
  })
  it('requires parts, all metadata, goals, and trains and rejects every extra field', () => {
    const doc = documentFixture(), step = doc.steps[0]!, train = step.trains[0]!, part = train.parts[0]!
    for (const [schema, input] of [[levelDocumentSchema, doc], [boardDescriptorSchema, doc.board], [stepSchema, step], [trainSchema, train], [partSchema, part]] as const) {
      expect(schema.safeParse({ ...input, extra: true }).success).toBe(false)
    }
    expect(trainSchema.safeParse({ ...train, parts: [] }).success).toBe(false)
    for (const field of ['title', 'prompt', 'trains', 'goal']) expect(stepSchema.safeParse({ ...step, [field]: undefined }).success).toBe(false)
    expect(stepSchema.safeParse({ ...step, title: 42 }).success).toBe(false)
    expect(stepSchema.safeParse({ ...step, prompt: 42 }).success).toBe(false)
    expect(levelDocumentSchema.safeParse({ ...doc, version: 2 }).success).toBe(false)
  })
  it.each([
    { kind: 'other', config: {} },
    { kind: 'bar', config: { columns: 24, targetCount: 0 } },
    { kind: 'array', config: { columns: 0, rows: 12 } },
    { kind: 'fraction', config: { columns: 24, pairCount: 1.5 } },
    { kind: 'mathtabla', config: { centralColumns: 24, centralRows: -1 } },
    { kind: 'array', config: { columns: 24, rows: 12, cellSize: 36 } },
  ])('rejects invalid board descriptors %j', input => expect(boardDescriptorSchema.safeParse(input).success).toBe(false))
})
describe('complete document validation', () => {
  it('validates independently of portrait editability and owns all nested data', () => {
    const input = documentFixture()
    const result = validateLevelDocument(input, adapter)
    expect(result.allowed).toBe(true)
    if (!result.allowed) throw new Error(result.reason)
    input.steps[0]!.trains[0]!.anchor.x = 99
    input.steps[0]!.goal!.conditions.splice(0)
    expect(result.value.steps[0]!.trains[0]!.anchor.x).toBe(0)
    expect(result.value.steps[0]!.goal!.conditions).toHaveLength(1)
  })
  it('allows empty steps and repeated train IDs across snapshots, but not duplicate step IDs', () => {
    const input = documentFixture()
    expect(validateLevelDocument({ ...input, steps: [] }, adapter).allowed).toBe(true)
    input.steps.push({ ...structuredClone(input.steps[0]!), id: 'step-2' })
    expect(validateLevelDocument(input, adapter).allowed).toBe(true)
    input.steps[1]!.id = 'step-1'
    expect(validateLevelDocument(input, adapter).allowed).toBe(false)
  })
  it('rejects the complete document for an invalid later scene, duplicate train or invalid goal', () => {
    for (const failure of ['scene', 'train', 'goal']) {
      const input = documentFixture()
      const later = structuredClone(input.steps[0]!); later.id = 'later'
      if (failure === 'scene') later.trains[0]!.anchor.x = 24
      if (failure === 'train') later.trains.push(structuredClone(later.trains[0]!))
      if (failure === 'goal') later.goal = { type: 'all', conditions: [{ type: 'empty-region', regionId: 'missing' }] }
      input.steps.push(later)
      expect(validateLevelDocument(input, adapter).allowed).toBe(false)
    }
  })
  it.each([
    { kind: 'bar', config: { columns: 24, targetCount: 3 } },
    { kind: 'array', config: { columns: 23, rows: 12 } },
    { kind: 'array', config: { columns: 24, rows: 11 } },
  ])('rejects board incompatibility %j', board => expect(validateLevelDocument({ ...documentFixture(), board }, adapter).allowed).toBe(false))
  it('compares every named board configuration field independent of key order', () => {
    const boards = [
      { board: { kind: 'bar' as const, config: { columns: 24, targetCount: 3 } }, goals: createBarGoalAdapter({ columns: 24, targetCount: 3 }) },
      { board: { kind: 'fraction' as const, config: { columns: 24, pairCount: 2 } }, goals: createFractionGoalAdapter({ columns: 24, pairCount: 2 }) },
      { board: { kind: 'mathtabla' as const, config: { centralColumns: 24, centralRows: 12 } }, goals: createMathTablaGoalAdapter({ centralColumns: 24, centralRows: 12 }) },
    ]
    for (const board of boards) {
      const current = { ...board, validateSnapshot: adapter.validateSnapshot }
      expect(validateLevelDocument({ version: 1, board: board.board, steps: [] }, current).allowed).toBe(true)
      for (const key of Object.keys(board.board.config)) {
        const config = { ...board.board.config, [key]: 99 }
        expect(validateLevelDocument({ version: 1, board: { ...board.board, config }, steps: [] }, current).allowed).toBe(false)
      }
    }
  })
  it('applies complete scene policy rules for tracks, orientations, overlap, and region containment', () => {
    const doc = documentFixture(), train = doc.steps[0]!.trains[0]!
    const policy = { columns: 24, rows: 12, spawnRows: [0], allowOrientation: false, editable: () => false }
    expect(validateSnapshot([train, { ...train, id: 'other' }], policy).allowed).toBe(false)
    expect(validateSnapshot([train], { ...policy, trackRows: [2] }).allowed).toBe(false)
    expect(validateSnapshot([{ ...train, parts: [{ ...train.parts[0]!, orientation: 'tower' }] }], policy).allowed).toBe(false)
    expect(validateSnapshot([{ ...train, parts: [{ ...train.parts[0]!, offset: { x: 0, y: 1 } }] }], { ...policy, requireHorizontalAnchorRow: true }).allowed).toBe(false)
    expect(validateSnapshot([train], { ...policy, regions: getMathTablaGeometry().regions }).allowed).toBe(false)
  })
})
