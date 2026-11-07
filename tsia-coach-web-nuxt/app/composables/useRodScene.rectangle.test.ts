import { describe, expect, it } from 'vitest'
import { useRodScene } from './useRodScene'
import type { RodTrain, ScenePolicy } from '~/components/rod/scene/rod.scene.types'
import {
  areaGroupTrains,
  planRectangle,
  rectangleShapes,
  selectionArea,
  trainCells,
  transposeRectangle,
} from '~/components/rod/scene/rectangle-operations'
import { areaGroupReadings, tiledRectangle } from '~/components/tabla/area-grouping'
import { copyScene } from '~/components/rod/scene/scene-snapshot'

const upright = (id: string, x: number, value: RodTrain['parts'][0]['value'] = 3): RodTrain => ({
  id, anchor: { x, y: 0 }, parts: [{ value, orientation: 'vertical', offset: { x: 0, y: 0 } }],
})

function areaScene(overrides: Partial<ScenePolicy> = {}, protect: Set<string> = new Set()) {
  return useRodScene({
    columns: 24,
    rows: 10,
    spawnRows: [0],
    editable: () => true,
    allowOrientation: true,
    allowFactors: true,
    allowAreaRegroup: true,
    allowRectangles: true,
    protectedIds: () => protect,
    ...overrides,
  })
}

const eightThrees = () => Array.from({ length: 8 }, (_, index) => upright(`x${index}`, 5 + index))

describe('rectangle operations (pure)', () => {
  it('measures the aggregate selection and lists every factor shape, preferred first', () => {
    expect(selectionArea(eightThrees())).toEqual({ allowed: true, value: { area: 24 } })
    const shapes = rectangleShapes(24, shape => shape.rows === 8)
    expect(shapes[0]).toEqual({ rows: 8, columns: 3 })
    expect(shapes).toHaveLength(8)
    // Not hard-coded to the most square shape.
    expect(rectangleShapes(24)[0]).toEqual({ rows: 4, columns: 6 })
  })

  it('turns eight upright 3-rods into one 3 × 8 rectangle of eight horizontal 3-rods', () => {
    const planned = planRectangle(eightThrees(), { rows: 8, columns: 3 }, { x: 0, y: 0, width: 24, depth: 10 }, () => true)
    expect(planned.allowed).toBe(true)
    if (!planned.allowed) return
    const rectangle = planned.value
    expect(rectangle.parts).toHaveLength(8)
    expect(rectangle.parts.every(part => part.value === 3 && part.orientation === 'horizontal')).toBe(true)
    // Right-aligned in the source columns 5–12: columns 10–12, rows 0–7.
    expect(rectangle.anchor).toEqual({ x: 10, y: 0 })
    expect(new Set(trainCells(rectangle)).size).toBe(24)
    expect(tiledRectangle(rectangle)).toEqual({ offset: { x: 0, y: 0 }, width: 3, depth: 8 })
  })

  it('rejects invalid shapes, duplicates, towers, negative rods and mixed roles', () => {
    const area = { x: 0, y: 0, width: 24, depth: 10 }
    expect(planRectangle(eightThrees(), { rows: 5, columns: 5 }, area, () => true)).toMatchObject({ allowed: false })
    expect(planRectangle(eightThrees(), { rows: 2.5, columns: 9.6 }, area, () => true)).toMatchObject({ allowed: false })
    const [first] = eightThrees()
    expect(selectionArea([first!, first!])).toMatchObject({ allowed: false, reason: expect.stringMatching(/once/) })
    expect(selectionArea([{ ...first!, parts: [{ ...first!.parts[0]!, orientation: 'tower' }] }])).toMatchObject({ allowed: false })
    expect(selectionArea([{ ...first!, parts: [{ ...first!.parts[0]!, sign: -1 }] }])).toMatchObject({ allowed: false })
    expect(selectionArea([{ ...first!, materialRole: 'numerator' }, upright('b', 1)])).toMatchObject({ allowed: false })
    expect(planRectangle(eightThrees(), { rows: 8, columns: 3 }, area, () => false)).toMatchObject({ allowed: false, reason: expect.stringMatching(/No room/) })
  })

  it('reads a 3 × 8 rectangle as 3 groups of 8 (columns) and an 8 × 3 one the other way', () => {
    const tall = { offset: { x: 0, y: 0 }, width: 3, depth: 8 }
    expect(areaGroupReadings(tall).map(reading => [reading.label, reading.arrangement])).toEqual([
      ['3 groups of 8', 'vertical columns'],
      ['8 groups of 3', 'horizontal rows'],
    ])
    const wide = { offset: { x: 0, y: 0 }, width: 8, depth: 3 }
    expect(areaGroupReadings(wide).map(reading => [reading.label, reading.arrangement])).toEqual([
      ['8 groups of 3', 'vertical columns'],
      ['3 groups of 8', 'horizontal rows'],
    ])
  })

  it('builds groups over ten as independent trains of catalog rods', () => {
    const groups = areaGroupTrains({ offset: { x: 0, y: 0 }, width: 2, depth: 12 }, 'columns', { x: 4, y: 1 })!
    expect(groups).toHaveLength(2)
    expect(groups.map(train => train.parts.map(part => part.value))).toEqual([[10, 2], [10, 2]])
    expect(groups.every(train => train.parts.every(part => part.orientation === 'vertical'))).toBe(true)
    expect(groups.map(train => train.anchor)).toEqual([{ x: 4, y: 1 }, { x: 5, y: 1 }])
    expect(groups.flatMap(train => train.parts).some(part => part.addendGroup !== undefined)).toBe(false)
  })

  it('transposes a rectangle without flattening it, and changing shape differs from regrouping', () => {
    const planned = planRectangle(eightThrees(), { rows: 8, columns: 3 }, { x: 0, y: 0, width: 24, depth: 10 }, () => true)
    if (!planned.allowed) throw new Error(planned.reason)
    const turned = transposeRectangle(planned.value, 'vertical')!
    expect(tiledRectangle(turned)).toEqual({ offset: { x: 0, y: 0 }, width: 8, depth: 3 })
    expect(turned.parts.every(part => part.orientation === 'vertical' && part.value === 3)).toBe(true)
    // Same area, different occupied cells.
    expect(trainCells(turned)).toHaveLength(24)
    expect(trainCells(turned)).not.toEqual(trainCells(planned.value))
  })
})

describe('rectangles in the scene', () => {
  it('creates a rectangle through check/apply and selects it', () => {
    const scene = areaScene()
    expect(scene.replace(eightThrees()).allowed).toBe(true)
    const ids = scene.trains.value.map(train => train.id)
    const choices = scene.getRectangleChoices(ids, shape => shape.rows === 8)
    expect(choices[0]).toMatchObject({ shape: { rows: 8, columns: 3 }, suggested: true, result: { allowed: true } })
    const result = scene.apply(ids, { type: 'make-rectangle', shape: { rows: 8, columns: 3 } })
    expect(result.allowed).toBe(true)
    expect(scene.trains.value).toHaveLength(1)
    expect([...scene.selection.value]).toEqual(result.allowed ? result.createdIds : [])
  })

  it('groups a 3 × 8 rectangle into three vertical 8-rods covering the same cells', () => {
    const scene = areaScene()
    scene.replace(eightThrees())
    const made = scene.apply(scene.trains.value.map(train => train.id), { type: 'make-rectangle', shape: { rows: 8, columns: 3 } })
    if (!made.allowed) throw new Error(made.reason)
    const id = made.createdIds[0]!
    const before = trainCells(scene.trains.value[0]!)
    const choices = scene.getAreaGroupingChoices(id)
    expect(choices.map(choice => [choice.reading.label, choice.active])).toEqual([['3 groups of 8', false], ['8 groups of 3', true]])
    expect(scene.apply([id], { type: 'regroup-area', grouping: 'columns' }).allowed).toBe(true)
    const grouped = scene.trains.value[0]!
    expect(grouped.parts.map(part => [part.value, part.orientation])).toEqual([[8, 'vertical'], [8, 'vertical'], [8, 'vertical']])
    expect(trainCells(grouped)).toEqual(before)
  })

  it('rotates a rectangle by transposing it, and regroups it to ones in place', () => {
    const scene = areaScene()
    scene.replace(eightThrees())
    const made = scene.apply(scene.trains.value.map(train => train.id), { type: 'make-rectangle', shape: { rows: 8, columns: 3 } })
    if (!made.allowed) throw new Error(made.reason)
    const id = made.createdIds[0]!
    expect(scene.apply([id], { type: 'set-orientation', orientation: 'vertical' }).allowed).toBe(true)
    expect(tiledRectangle(scene.trains.value[0]!)).toMatchObject({ width: 8, depth: 3 })
    expect(scene.apply([id], { type: 'regroup-ones' }).allowed).toBe(true)
    expect(scene.trains.value[0]!.parts).toHaveLength(24)
    expect(tiledRectangle(scene.trains.value[0]!)).toMatchObject({ width: 8, depth: 3 })
  })

  it('groups several separate rods that fill a rectangle as one new object', () => {
    const scene = areaScene()
    // Eight separate lying 3-rods stacked into a 3 × 8 block, as a learner lays them by hand.
    const lying = Array.from({ length: 8 }, (_, row): RodTrain => ({
      id: `l${row}`, anchor: { x: 10, y: row }, parts: [{ value: 3, orientation: 'horizontal', offset: { x: 0, y: 0 } }],
    }))
    scene.replace(lying)
    const ids = lying.map(train => train.id)
    const choices = scene.getAreaGroupingChoices(ids)
    expect(choices.map(choice => [choice.reading.label, choice.result.allowed])).toEqual([['3 groups of 8', true], ['8 groups of 3', true]])
    const result = scene.apply(ids, { type: 'regroup-area', grouping: 'columns' })
    expect(result.allowed).toBe(true)
    expect(scene.trains.value).toHaveLength(1)
    expect(scene.trains.value[0]!.parts.map(part => [part.value, part.orientation])).toEqual([[8, 'vertical'], [8, 'vertical'], [8, 'vertical']])
    expect([...scene.selection.value]).toEqual(result.allowed ? result.createdIds : [])
    // A selection with a gap is refused, and boards without rectangles keep the one-object rule.
    const gappy = areaScene()
    gappy.replace(lying.filter(train => train.id !== 'l3'))
    expect(gappy.check(ids.filter(id => id !== 'l3'), { type: 'regroup-area', grouping: 'columns' })).toMatchObject({ allowed: false, reason: expect.stringMatching(/fill a rectangle exactly/) })
    const plain = areaScene({ allowRectangles: false })
    plain.replace(lying)
    expect(plain.getAreaGroupingChoices(ids)).toEqual([])
    expect(plain.check(ids, { type: 'regroup-area', grouping: 'columns' })).toMatchObject({ reason: 'Select one filled rectangle to regroup its area.' })
  })

  it('keeps rectangles off boards that do not opt in', () => {
    const scene = areaScene({ allowRectangles: false })
    scene.replace(eightThrees())
    const ids = scene.trains.value.map(train => train.id)
    expect(scene.check(ids, { type: 'make-rectangle', shape: { rows: 8, columns: 3 } })).toEqual({
      allowed: false, reason: 'This board does not offer rectangles.',
    })
  })
})

describe('protected objects', () => {
  it('rejects direct and indirect edits to protected trains through check and apply', () => {
    const protect = new Set<string>()
    const scene = areaScene({}, protect)
    scene.replace([...eightThrees(), upright('y0', 14, 8)])
    protect.add('y0')
    const before = JSON.stringify(copyScene(scene.trains.value))

    for (const action of [
      { type: 'move', delta: { x: 1, y: 0 } },
      { type: 'delete' },
      { type: 'clone' },
      { type: 'set-orientation', orientation: 'horizontal' },
    ] as const) {
      expect(scene.check(['y0'], action)).toMatchObject({ allowed: false, reason: expect.stringMatching(/outside the conversion/) })
      expect(scene.apply(['y0'], action).allowed).toBe(false)
    }
    // Indirect: a board transform that removes a protected train.
    const transforming = areaScene({
      planTransform: () => ({ allowed: true, remove: ['y0'], add: [] }),
    }, protect)
    transforming.replace([...eightThrees(), upright('y0', 14, 8)])
    expect(transforming.apply(['x0'], { type: 'board-transform', transform: { name: 'any' } })).toMatchObject({ allowed: false })
    expect(JSON.stringify(copyScene(scene.trains.value))).toBe(before)

    // Editable material still works.
    expect(scene.apply(['x0'], { type: 'delete' }).allowed).toBe(true)
  })
})
