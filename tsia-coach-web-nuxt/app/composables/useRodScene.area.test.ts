import { describe, expect, it } from 'vitest'
import { useRodScene } from './useRodScene'
import { useAreaGroupingMenuChoice } from './useAreaGroupingMenuChoice'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import type { RodTrain, ScenePolicy, SceneAction, TrainPart } from '~/components/rod/scene/rod.scene.types'
import { areaGroupParts } from '~/components/tabla/area-grouping'
import { getMathTablaGeometry } from '~/components/tabla/mathtabla.geometry'
import { getMathTablaReadouts } from '~/components/tabla/mathtabla.readouts'

function createAreaScene(overrides: Partial<ScenePolicy> = {}) {
  return useRodScene({
    columns: 24,
    rows: 12,
    spawnRows: Array.from({ length: 12 }, (_, row) => row),
    editable: () => true,
    allowOrientation: true,
    allowFactors: true,
    allowAreaRegroup: true,
    ...overrides,
  })
}

type Scene = ReturnType<typeof createAreaScene>
type ReadonlyTrain = Scene['trains']['value'][number]

function add(scene: Scene, value: CuisenaireRodValue): string {
  const result = scene.apply([], { type: 'create', value })
  if (!result.allowed) throw new Error(result.reason)
  return result.createdIds[0]!
}

function snapshot(scene: Scene) {
  return JSON.stringify({
    trains: scene.trains.value,
    selection: [...scene.selection.value],
  })
}

function cellSet(train: ReadonlyTrain): string[] {
  const cells: string[] = []

  for (const part of train.parts) {
    const width = part.orientation === 'horizontal' ? part.value : 1
    const depth = part.orientation === 'vertical' ? part.value : 1

    for (let y = 0; y < depth; y++) {
      for (let x = 0; x < width; x++) {
        cells.push(
          `${train.anchor.x + part.offset.x + x},${train.anchor.y + part.offset.y + y}`,
        )
      }
    }
  }

  return cells.sort()
}

/** Fifteen units arranged as five horizontal threes, through public actions. */
function fill3by5(scene: Scene): string {
  const ten = add(scene, 10)
  const five = add(scene, 5)

  if (!scene.apply([ten, five], { type: 'make-train' }).allowed) {
    throw new Error('Could not combine the rods')
  }

  const id = [...scene.selection.value][0]!

  if (!scene.apply([id], {
    type: 'regroup-factors',
    shape: { rows: 5, columns: 3 },
  }).allowed) {
    throw new Error('Could not arrange the rectangle')
  }

  return id
}

function hydrate(scene: Scene, parts: TrainPart[], anchor = { x: 0, y: 0 }): string {
  const train: RodTrain = { id: 'area', anchor, parts }
  const result = scene.replace([train])
  if (!result.allowed) throw new Error(result.reason)
  scene.select([train.id])
  return train.id
}

describe('regroup-area on a filled rectangle', () => {
  it('switches a 3 × 5 rectangle between three fives and five threes in the same cells', () => {
    const scene = createAreaScene()
    const id = fill3by5(scene)
    const anchor = { ...scene.trains.value[0]!.anchor }
    const cells = cellSet(scene.trains.value[0]!)

    expect(cells).toHaveLength(15)

    expect(scene.apply([id], {
      type: 'regroup-area',
      grouping: 'columns',
    })).toEqual({ allowed: true, createdIds: [] })

    const columns = scene.trains.value[0]!

    expect(columns.parts).toEqual([
      { value: 5, orientation: 'vertical', offset: { x: 0, y: 0 } },
      { value: 5, orientation: 'vertical', offset: { x: 1, y: 0 } },
      { value: 5, orientation: 'vertical', offset: { x: 2, y: 0 } },
    ])

    expect(scene.trains.value).toHaveLength(1)
    expect(columns.id).toBe(id)
    expect(columns.anchor).toEqual(anchor)
    expect(cellSet(columns)).toEqual(cells)
    expect([...scene.selection.value]).toEqual([id])

    expect(scene.apply([id], {
      type: 'regroup-area',
      grouping: 'rows',
    }).allowed).toBe(true)

    const rows = scene.trains.value[0]!

    expect(rows.parts).toEqual([
      { value: 3, orientation: 'horizontal', offset: { x: 0, y: 0 } },
      { value: 3, orientation: 'horizontal', offset: { x: 0, y: 1 } },
      { value: 3, orientation: 'horizontal', offset: { x: 0, y: 2 } },
      { value: 3, orientation: 'horizontal', offset: { x: 0, y: 3 } },
      { value: 3, orientation: 'horizontal', offset: { x: 0, y: 4 } },
    ])

    expect(cellSet(rows)).toEqual(cells)

    // Round trip: identity, position, cells and selection all survive.
    expect(scene.apply([id], {
      type: 'regroup-area',
      grouping: 'columns',
    }).allowed).toBe(true)

    expect(scene.trains.value[0]!.parts).toEqual(columns.parts)
    expect(scene.trains.value[0]!.id).toBe(id)
    expect(scene.trains.value[0]!.anchor).toEqual(anchor)
    expect(cellSet(scene.trains.value[0]!)).toEqual(cells)
    expect([...scene.selection.value]).toEqual([id])
  })

  it('regroups where it stands and leaves other objects untouched', () => {
    const scene = createAreaScene()
    const id = fill3by5(scene)

    expect(scene.apply([id], { type: 'move', delta: { x: 6, y: 2 } }).allowed).toBe(true)

    const other = add(scene, 4)
    const before = JSON.stringify(scene.trains.value.find(train => train.id === other))

    scene.select([id])
    expect(scene.apply([id], { type: 'regroup-area', grouping: 'columns' }).allowed).toBe(true)

    expect(scene.trains.value.find(train => train.id === id)!.anchor).toEqual({ x: 6, y: 2 })
    expect(JSON.stringify(scene.trains.value.find(train => train.id === other))).toBe(before)
  })

  it('treats the grouping it already shows as an allowed no-op', () => {
    const scene = createAreaScene()
    const id = fill3by5(scene)

    const choices = scene.getAreaGroupingChoices(id)

    expect(choices.map(choice => [choice.reading.label, choice.active, choice.result.allowed]))
      .toEqual([
        ['3 groups of 5', false, true],
        ['5 groups of 3', true, true],
      ])

    const before = snapshot(scene)
    expect(scene.apply([id], { type: 'regroup-area', grouping: 'rows' }).allowed).toBe(true)
    expect(snapshot(scene)).toBe(before)
  })
})

describe('regroup-area refusals leave the scene unchanged', () => {
  it('rejects a hole, an L shape and a tower', () => {
    const shapes: Record<string, TrainPart[]> = {
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
      tower: [{ value: 5, orientation: 'tower', offset: { x: 0, y: 0 } }],
    }

    for (const [name, parts] of Object.entries(shapes)) {
      const scene = createAreaScene()
      const id = hydrate(scene, parts)
      const before = snapshot(scene)

      for (const grouping of ['columns', 'rows'] as const) {
        const result = scene.check([id], { type: 'regroup-area', grouping })
        expect(result.allowed, name).toBe(false)
        if (result.allowed) throw new Error('Expected a rejection')

        expect(result.reason, name).toBe(
          name === 'tower'
            ? 'Lay the tower horizontally or vertically before regrouping.'
            : 'Select one object that completely fills a rectangle, with no gaps and no overlaps.',
        )

        expect(scene.apply([id], { type: 'regroup-area', grouping }).allowed).toBe(false)
      }

      expect(snapshot(scene), name).toBe(before)
      expect(scene.getAreaGroupingChoices(id), name).toEqual([])
    }
  })

  it('rejects more than one selected train', () => {
    const scene = createAreaScene()
    const first = add(scene, 3)
    const second = add(scene, 3)
    scene.select([first, second])

    const before = snapshot(scene)

    expect(scene.check([first, second], { type: 'regroup-area', grouping: 'rows' })).toEqual({
      allowed: false,
      reason: 'Select one filled rectangle to regroup its area.',
    })

    expect(scene.apply([first, second], {
      type: 'regroup-area',
      grouping: 'rows',
    }).allowed).toBe(false)

    expect(snapshot(scene)).toBe(before)

    const picker = useAreaGroupingMenuChoice(scene)
    expect(picker.value).toMatchObject({
      kind: 'submenu',
      label: 'Regroup selected area',
      children: [],
      disabledReason: 'Select one filled rectangle to regroup its area.',
    })
  })

  it('rejects an empty selection and a scene that does not opt in', () => {
    const scene = createAreaScene()

    expect(scene.check([], { type: 'regroup-area', grouping: 'rows' })).toEqual({
      allowed: false,
      reason: 'Select existing trains first.',
    })

    const bar = createAreaScene({ allowFactors: false, allowAreaRegroup: false })
    const id = add(bar, 3)
    bar.select([id])
    const before = snapshot(bar)

    expect(bar.check([id], { type: 'regroup-area', grouping: 'rows' })).toEqual({
      allowed: false,
      reason: 'Area grouping is available in MathTabla.',
    })

    expect(bar.apply([id], { type: 'regroup-area', grouping: 'columns' }).allowed).toBe(false)
    expect(snapshot(bar)).toBe(before)
  })

  it('refuses a group value with no rod while keeping the other direction', () => {
    const scene = createAreaScene()
    // Fourteen vertical threes: a 14 × 3 area no single horizontal rod can group.
    const id = hydrate(scene, areaGroupParts({ offset: { x: 0, y: 0 }, width: 14, depth: 3 }, 'columns')!)

    const before = snapshot(scene)
    const result = scene.check([id], { type: 'regroup-area', grouping: 'rows' })

    expect(result).toEqual({
      allowed: false,
      reason:
        'A group of 14 square units needs a 14-rod, and rods are valued 1–10. ' +
        'Group the whole instead to show these parts flat.',
    })

    expect(scene.apply([id], { type: 'regroup-area', grouping: 'rows' }).allowed).toBe(false)
    expect(snapshot(scene)).toBe(before)

    expect(scene.getAreaGroupingChoices(id).map(choice => [
      choice.reading.label, choice.reading.rodSupported, choice.active, choice.result.allowed,
    ])).toEqual([
      ['14 groups of 3', true, true, true],
      ['3 groups of 14', false, false, false],
    ])

    const picker = useAreaGroupingMenuChoice(scene)
    expect(picker.value).toMatchObject({
      kind: 'submenu',
      disabledReason: undefined,
      children: [
        { kind: 'action', label: '14 groups of 3 (vertical columns)', checked: true },
        { kind: 'action', label: '3 groups of 14 (horizontal rows)', checked: false },
      ],
    })
  })

  it('keeps check pure and allocates no ids for a rejected action', () => {
    const scene = createAreaScene()
    const id = fill3by5(scene)
    const before = snapshot(scene)

    expect(scene.check([id], { type: 'regroup-area', grouping: 'columns' })).toEqual({ allowed: true })
    expect(scene.getAreaGroupingChoices(id)).toHaveLength(2)
    expect(snapshot(scene)).toBe(before)

    // Both groupings cover the identical cells, so nothing on the board can
    // block one without blocking the other. A rejection needs a bad request.
    const other = add(scene, 4)
    scene.select([id, other])
    const guarded = snapshot(scene)

    expect(scene.check([id, other], { type: 'regroup-area', grouping: 'columns' }).allowed).toBe(false)
    expect(scene.apply([id, other], { type: 'regroup-area', grouping: 'columns' }).allowed).toBe(false)
    expect(snapshot(scene)).toBe(guarded)

    // Ids stay contiguous: neither check nor the rejected apply consumed one.
    expect(add(scene, 2)).toBe('train-5')
  })

  it('does not alter what regroup-factors means', () => {
    const scene = createAreaScene()
    const id = fill3by5(scene)

    // regroup-factors may change the footprint; regroup-area may not.
    expect(scene.apply([id], {
      type: 'regroup-factors',
      shape: { rows: 3, columns: 5 },
    }).allowed).toBe(true)

    expect(scene.trains.value[0]!.parts).toEqual([
      { value: 5, orientation: 'horizontal', offset: { x: 0, y: 0 } },
      { value: 5, orientation: 'horizontal', offset: { x: 0, y: 1 } },
      { value: 5, orientation: 'horizontal', offset: { x: 0, y: 2 } },
    ])

    const forbidden: SceneAction[] = [
      { type: 'regroup-ones' },
      { type: 'regroup-addends', pair: [10, 5] },
    ]

    const before = snapshot(scene)

    for (const action of forbidden) {
      expect(scene.check([id], action).allowed).toBe(false)
      expect(snapshot(scene)).toBe(before)
    }

    // The 5 × 3 footprint now reads the other way round, from its own dimensions.
    expect(scene.getAreaGroupingChoices(id).map(choice => choice.reading.label))
      .toEqual(['5 groups of 3', '3 groups of 5'])
  })
})

describe('regroup-area inside the MathTabla board', () => {
  const geometry = getMathTablaGeometry()

  function createTablaScene() {
    return useRodScene({
      columns: geometry.config.columns,
      rows: geometry.config.rows,
      spawnRows: Array.from({ length: 12 }, (_, row) => geometry.array.y + row),
      regions: geometry.regions,
      editable: () => true,
      allowOrientation: true,
      allowFactors: true,
      allowAreaRegroup: true,
    })
  }

  function createWhole() {
    const scene = createTablaScene()

    const result = scene.replace([
      {
        id: 'hd',
        anchor: { x: 2, y: 0 },
        parts: [{ value: 3, orientation: 'horizontal', offset: { x: 0, y: 0 } }],
      },
      {
        id: 'vd',
        anchor: { x: 0, y: 2 },
        parts: [{ value: 5, orientation: 'vertical', offset: { x: 0, y: 0 } }],
      },
      {
        id: 'area',
        anchor: { x: 2, y: 2 },
        parts: areaGroupParts({ offset: { x: 0, y: 0 }, width: 3, depth: 5 }, 'rows')!,
      },
    ])

    if (!result.allowed) throw new Error(result.reason)
    scene.select(['area'])
    return scene
  }

  it('leaves the whole, the references and the coverage unchanged', () => {
    const scene = createWhole()
    const before = getMathTablaReadouts(scene.trains.value, geometry)

    expect(before).toMatchObject({
      horizontal: { numerator: 0, denominator: 3 },
      vertical: { numerator: 0, denominator: 5 },
      guide: { x: 2, y: 2, width: 3, depth: 5 },
      guideCells: 15,
      occupiedCells: 15,
    })

    const references = JSON.stringify(
      scene.trains.value.filter(train => train.id !== 'area'),
    )

    expect(scene.apply(['area'], { type: 'regroup-area', grouping: 'columns' }).allowed).toBe(true)

    expect(getMathTablaReadouts(scene.trains.value, geometry)).toEqual(before)
    expect(JSON.stringify(scene.trains.value.filter(train => train.id !== 'area'))).toBe(references)
    expect([...scene.selection.value]).toEqual(['area'])

    expect(scene.trains.value.find(train => train.id === 'area')!.parts).toEqual([
      { value: 5, orientation: 'vertical', offset: { x: 0, y: 0 } },
      { value: 5, orientation: 'vertical', offset: { x: 1, y: 0 } },
      { value: 5, orientation: 'vertical', offset: { x: 2, y: 0 } },
    ])
  })

  it('refuses a grouping a reference track cannot hold', () => {
    const scene = createWhole()
    scene.select(['hd'])
    const before = JSON.stringify(scene.trains.value)

    // The horizontal D track accepts horizontal rods only.
    const result = scene.check(['hd'], { type: 'regroup-area', grouping: 'columns' })
    expect(result.allowed).toBe(false)
    if (result.allowed) throw new Error('Expected a rejection')
    expect(result.reason).toContain('Cannot regroup this area.')

    expect(scene.apply(['hd'], { type: 'regroup-area', grouping: 'columns' }).allowed).toBe(false)
    expect(JSON.stringify(scene.trains.value)).toBe(before)

    // Its existing single-row reading is still a valid no-op.
    expect(scene.check(['hd'], { type: 'regroup-area', grouping: 'rows' })).toEqual({ allowed: true })
  })

  it('offers both groupings for a rectangle filling part of a larger whole', () => {
    const scene = createTablaScene()

    const result = scene.replace([
      {
        id: 'hd',
        anchor: { x: 2, y: 0 },
        parts: [{ value: 4, orientation: 'horizontal', offset: { x: 0, y: 0 } }],
      },
      {
        id: 'vd',
        anchor: { x: 0, y: 2 },
        parts: [{ value: 6, orientation: 'vertical', offset: { x: 0, y: 0 } }],
      },
      {
        id: 'area',
        anchor: { x: 2, y: 2 },
        parts: areaGroupParts({ offset: { x: 0, y: 0 }, width: 3, depth: 5 }, 'rows')!,
      },
    ])

    if (!result.allowed) throw new Error(result.reason)
    scene.select(['area'])

    const before = getMathTablaReadouts(scene.trains.value, geometry)
    expect(before).toMatchObject({ guideCells: 24, occupiedCells: 15 })

    // Derived from the selected rectangle, not from the 4 × 6 denominator.
    expect(scene.getAreaGroupingChoices('area').map(choice => choice.reading.label))
      .toEqual(['3 groups of 5', '5 groups of 3'])

    expect(scene.apply(['area'], { type: 'regroup-area', grouping: 'columns' }).allowed).toBe(true)
    expect(getMathTablaReadouts(scene.trains.value, geometry)).toEqual(before)
  })
})
