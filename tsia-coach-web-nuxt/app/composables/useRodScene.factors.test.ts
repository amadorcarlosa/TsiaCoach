import { describe, expect, it } from 'vitest'
import { useRodScene } from './useRodScene'
import { useFactorMenuChoice } from './useFactorMenuChoice'
import { factorShapes } from '~/components/rod/scene/factor-groupings'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import type { SceneAction } from '~/components/rod/scene/rod.scene.types'

function createFactorScene() {
  return useRodScene({
    columns: 24,
    rows: 12,
    spawnRows: [0],
    editable: () => true,
    allowOrientation: true,
    allowFactors: true,
  })
}

function add(
  scene: ReturnType<typeof createFactorScene>,
  value: CuisenaireRodValue,
): string {
  const result = scene.apply([], { type: 'create', value })
  if (!result.allowed) throw new Error(result.reason)
  return result.createdIds[0]!
}

function snapshot(scene: ReturnType<typeof createFactorScene>) {
  return JSON.stringify({
    trains: scene.trains.value,
    selection: [...scene.selection.value],
  })
}

it('offers 12 rows of 2 and validates its full depth', () => {
  expect(factorShapes(24)).toContainEqual({
    rows: 12,
    columns: 2,
  })

  expect(factorShapes(24).some(
    shape => Number(shape.columns) === 12,
  )).toBe(false)

  const scene = createFactorScene()
  const ids = [add(scene, 10), add(scene, 10), add(scene, 4)]

  expect(scene.apply(ids, {
    type: 'make-train',
  }).allowed).toBe(true)

  const id = [...scene.selection.value][0]!
  const action = {
    type: 'regroup-factors',
    shape: { rows: 12, columns: 2 },
  } as const

  expect(scene.check([id], action).allowed).toBe(true)

  // Move the horizontal line down one row before regrouping.
  expect(scene.apply([id], {
    type: 'move',
    delta: { x: 0, y: 1 },
  }).allowed).toBe(true)

  const before = snapshot(scene)

  expect(scene.check([id], action).allowed).toBe(false)
  expect(scene.apply([id], action).allowed).toBe(false)
  expect(snapshot(scene)).toBe(before)

  expect(scene.apply([id], {
    type: 'move',
    delta: { x: 0, y: -1 },
  }).allowed).toBe(true)

  expect(scene.apply([id], action).allowed).toBe(true)
  expect(scene.trains.value[0]!.parts).toHaveLength(12)
  expect(scene.trains.value[0]!.parts.reduce(
    (sum, part) => sum + part.value,
    0,
  )).toBe(24)
})

it('enables the picker while rejecting a blocked batch default', () => {
  const scene = createFactorScene()
  const first = add(scene, 6) // (0, 0)
  const obstacle = add(scene, 1) // (6, 0)

  expect(scene.apply([obstacle], {
    type: 'move',
    delta: { x: -4, y: 1 }, // obstacle at (2, 1)
  }).allowed).toBe(true)

  scene.select([first])

  // Default: 2 rows of 3 overlaps the obstacle.
  expect(scene.check([first], {
    type: 'regroup-factors',
  }).allowed).toBe(false)

  // Alternative: 3 rows of 2 ends exactly before the obstacle.
  expect(scene.check([first], {
    type: 'regroup-factors',
    shape: { rows: 3, columns: 2 },
  }).allowed).toBe(true)

  const picker = useFactorMenuChoice(scene)
  expect(picker.value.kind).toBe('submenu')

  if (picker.value.kind !== 'submenu') {
    throw new Error('Expected a factor submenu')
  }

  expect(picker.value.disabledReason).toBeUndefined()

  const second = add(scene, 6)
  scene.select([first, second])

  // The second rod alone is arrangeable, so a partial commit would
  // be observable if the batch were not atomic.
  expect(scene.check([second], {
    type: 'regroup-factors',
  }).allowed).toBe(true)

  const before = snapshot(scene)

  expect(scene.apply([first, second], {
    type: 'regroup-factors',
  }).allowed).toBe(false)

  expect(snapshot(scene)).toBe(before)
})

it('protects the rectangle and permits another factor shape', () => {
  const scene = createFactorScene()
  const id = add(scene, 6)
  scene.select([id])

  expect(scene.apply([id], {
    type: 'regroup-factors',
    shape: { rows: 2, columns: 3 },
  }).allowed).toBe(true)

  const forbidden: SceneAction[] = [
    { type: 'set-orientation', orientation: 'horizontal' },
    { type: 'set-orientation', orientation: 'vertical' },
    { type: 'regroup-ones' },
    { type: 'regroup-addends', pair: [1, 5] },
  ]

  const before = snapshot(scene)

  for (const action of forbidden) {
    expect(scene.check([id], action).allowed).toBe(false)
    expect(scene.apply([id], action).allowed).toBe(false)
    expect(snapshot(scene)).toBe(before)
  }

  const anchor = { ...scene.trains.value[0]!.anchor }

  expect(scene.apply([id], {
    type: 'regroup-factors',
    shape: { rows: 3, columns: 2 },
  }).allowed).toBe(true)

  const train = scene.trains.value[0]!

  expect(train.id).toBe(id)
  expect(train.anchor).toEqual(anchor)
  expect([...scene.selection.value]).toEqual([id])

  expect(train.parts).toEqual([
    { value: 2, orientation: 'horizontal', offset: { x: 0, y: 0 } },
    { value: 2, orientation: 'horizontal', offset: { x: 0, y: 1 } },
    { value: 2, orientation: 'horizontal', offset: { x: 0, y: 2 } },
  ])
})

it('regroups a six-rod into 2 rows of 3 without changing identity', () => {
  const scene = createFactorScene()
  const id = add(scene, 6)
  scene.select([id])

  const anchor = { ...scene.trains.value[0]!.anchor }

  expect(scene.apply([id], {
    type: 'regroup-factors',
    shape: { rows: 2, columns: 3 },
  })).toEqual({
    allowed: true,
    createdIds: [],
  })

  expect(scene.trains.value).toHaveLength(1)

  const train = scene.trains.value[0]!

  expect(train.id).toBe(id)
  expect(train.anchor).toEqual(anchor)
  expect([...scene.selection.value]).toEqual([id])

  expect(train.parts).toEqual([
    {
      value: 3,
      orientation: 'horizontal',
      offset: { x: 0, y: 0 },
    },
    {
      value: 3,
      orientation: 'horizontal',
      offset: { x: 0, y: 1 },
    },
  ])
})

describe('regroup-factors restrictions', () => {
  it('rejects in a scene that does not allow factors (Bar)', () => {
    const scene = useRodScene({
      columns: 24,
      rows: 12,
      spawnRows: [0],
      editable: () => true,
      allowOrientation: false,
      allowFactors: false,
    })

    const id = add(scene, 6)
    scene.select([id])

    const before = snapshot(scene)

    expect(scene.check([id], { type: 'regroup-factors' })).toEqual({
      allowed: false,
      reason: 'Factor arrangements are available in Array.',
    })

    expect(scene.apply([id], {
      type: 'regroup-factors',
      shape: { rows: 2, columns: 3 },
    }).allowed).toBe(false)

    expect(snapshot(scene)).toBe(before)
  })

  it.each([2, 3, 5, 7] as const)(
    'rejects a prime value %i with no factor arrangement',
    (value) => {
      expect(factorShapes(value)).toEqual([])

      const scene = createFactorScene()
      const id = add(scene, value)
      scene.select([id])

      const before = snapshot(scene)
      const result = scene.apply([id], { type: 'regroup-factors' })

      expect(result.allowed).toBe(false)
      if (result.allowed) throw new Error('Expected rejection')
      expect(result.reason).toContain('no supported factor arrangement')

      expect(snapshot(scene)).toBe(before)
      expect(scene.getFactorChoices(id)).toEqual([])

      const picker = useFactorMenuChoice(scene)
      expect(picker.value).toMatchObject({
        kind: 'submenu',
        children: [],
        disabledReason: result.reason,
      })
    },
  )

  it('rejects a tower without mutation', () => {
    const scene = createFactorScene()
    const id = add(scene, 6)
    scene.select([id])

    expect(scene.apply([id], {
      type: 'set-orientation',
      orientation: 'tower',
    }).allowed).toBe(true)

    const before = snapshot(scene)

    expect(scene.check([id], { type: 'regroup-factors' })).toEqual({
      allowed: false,
      reason: 'Lay the tower horizontally or vertically before decomposing.',
    })

    expect(scene.apply([id], {
      type: 'regroup-factors',
      shape: { rows: 2, columns: 3 },
    }).allowed).toBe(false)

    expect(snapshot(scene)).toBe(before)
  })

  it('rejects a requested shape whose product is not the value', () => {
    const scene = createFactorScene()
    const id = add(scene, 6)
    scene.select([id])

    const before = snapshot(scene)

    const wrong = [
      { rows: 2, columns: 4 },
      { rows: 4, columns: 2 },
      { rows: 1, columns: 6 },
      { rows: 6, columns: 1 },
    ] as const

    for (const shape of wrong) {
      expect(scene.check([id], {
        type: 'regroup-factors',
        shape,
      })).toEqual({
        allowed: false,
        reason: 'Choose a supported factor arrangement for this value.',
      })

      expect(scene.apply([id], {
        type: 'regroup-factors',
        shape,
      }).allowed).toBe(false)

      expect(snapshot(scene)).toBe(before)
    }
  })

  it('preserves state and selection on check without allocating ids', () => {
    const scene = createFactorScene()
    const id = add(scene, 6)
    scene.select([id])

    const before = snapshot(scene)

    expect(scene.check([id], { type: 'regroup-factors' })).toEqual({
      allowed: true,
    })

    expect(snapshot(scene)).toBe(before)

    expect(scene.apply([id], { type: 'regroup-factors' })).toEqual({
      allowed: true,
      createdIds: [],
    })

    expect(scene.trains.value[0]!.id).toBe(id)
  })

  it('allocates no ids on check or rejected apply', () => {
    const scene = createFactorScene()
    const id = add(scene, 6)
    expect(id).toBe('train-1')

    expect(scene.check([id], { type: 'regroup-factors' }).allowed).toBe(true)

    const wrong = { rows: 2, columns: 4 } as const
    expect(scene.check([id], {
      type: 'regroup-factors',
      shape: wrong,
    }).allowed).toBe(false)

    expect(scene.apply([id], {
      type: 'regroup-factors',
      shape: wrong,
    }).allowed).toBe(false)

    // The next allocated id is contiguous, so neither check nor the
    // rejected apply consumed one.
    expect(add(scene, 4)).toBe('train-2')

    expect(scene.apply([id], { type: 'regroup-factors' })).toEqual({
      allowed: true,
      createdIds: [],
    })

    expect(add(scene, 4)).toBe('train-3')
  })
})

describe('undo train on a factor rectangle', () => {
  it('releases each row in place and selects the released rods', () => {
    const scene = createFactorScene()
    const id = add(scene, 6)
    scene.select([id])

    expect(scene.apply([id], {
      type: 'regroup-factors',
      shape: { rows: 2, columns: 3 },
    }).allowed).toBe(true)

    // Move the rectangle first so the released rows must follow it.
    expect(scene.apply([id], {
      type: 'move',
      delta: { x: 4, y: 3 },
    }).allowed).toBe(true)

    const result = scene.apply([id], { type: 'ungroup' })
    expect(result.allowed).toBe(true)
    if (!result.allowed) throw new Error('Expected ungroup to succeed')

    expect(result.createdIds).toHaveLength(2)
    expect([...scene.selection.value]).toEqual(result.createdIds)
    expect(scene.trains.value.map(train => train.id)).toEqual(result.createdIds)

    expect(scene.trains.value.map(train => ({
      anchor: train.anchor,
      parts: train.parts,
    }))).toEqual([
      {
        anchor: { x: 4, y: 3 },
        parts: [{ value: 3, orientation: 'horizontal', offset: { x: 0, y: 0 } }],
      },
      {
        anchor: { x: 4, y: 4 },
        parts: [{ value: 3, orientation: 'horizontal', offset: { x: 0, y: 0 } }],
      },
    ])
  })
})
