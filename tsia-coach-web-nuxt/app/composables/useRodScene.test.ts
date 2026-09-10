import { describe, expect, it } from 'vitest'
import { useRodScene } from '~/composables/useRodScene'

function createScene() {
  return useRodScene({
    columns: 24,
    rows: 12,
    spawnRows: [4],
    editable: () => true,
    allowOrientation: true,
  })
}

describe('make-train', () => {
  it('packs in board order and selects the resulting train', () => {
    const scene = createScene()

    scene.apply([], { type: 'create', value: 3 })
    const a = scene.trains.value[0]!.id
    scene.apply([], { type: 'create', value: 5 })
    const b = scene.trains.value[1]!.id

    // Initially A is at x=0 and B at x=3.
    scene.apply([b], {
      type: 'move',
      delta: { x: 5, y: 0 },
    })

    scene.apply([a], {
      type: 'move',
      delta: { x: 2, y: 0 },
    })

    // Reverse selection order must not affect board ordering.
    scene.select([b, a])
    expect(scene.apply([b, a], {
      type: 'make-train',
    })).toEqual({ allowed: true })

    expect(scene.trains.value).toHaveLength(1)

    const train = scene.trains.value[0]!

    expect(train.anchor).toEqual({ x: 2, y: 4 })
    expect(train.parts.map(part => ({
      value: part.value,
      offset: part.offset,
    }))).toEqual([
      { value: 3, offset: { x: 0, y: 0 } },
      { value: 5, offset: { x: 3, y: 0 } },
    ])

    expect([...scene.selection.value]).toEqual([train.id])
    expect([a, b]).not.toContain(train.id)
  })

  it('rejects with one selected train', () => {
    const scene = createScene()
    scene.apply([], { type: 'create', value: 3 })
    const first = scene.trains.value[0]!.id

    const beforeTrains = scene.trains.value.map(train => ({ ...train }))
    const beforeSelection = new Set(scene.selection.value)

    expect(scene.apply([first], { type: 'make-train' })).toEqual({
      allowed: false,
      reason: 'Select at least two trains.',
    })

    expect(scene.trains.value).toEqual(beforeTrains)
    expect(scene.selection.value).toEqual(beforeSelection)
  })

  it('rejects vertical or tower rods without mutation', () => {
    const scene = createScene()

    scene.apply([], { type: 'create', value: 3 })
    scene.apply([], { type: 'create', value: 4 })

    const [vertical, tower] = scene.trains.value.map(train => train.id)

    scene.apply([vertical], {
      type: 'set-orientation',
      orientation: 'vertical',
    })

    const beforeVertical = scene.trains.value.map(train => ({
      ...train,
      parts: train.parts.map(part => ({ ...part })),
    }))

    expect(scene.apply([vertical, tower], {
      type: 'make-train',
    })).toEqual({
      allowed: false,
      reason: 'Lay all selected rods horizontally first.',
    })
    expect(scene.trains.value).toEqual(beforeVertical)

    scene.apply([tower], {
      type: 'set-orientation',
      orientation: 'tower',
    })
    const beforeTower = scene.trains.value.map(train => ({
      ...train,
      parts: train.parts.map(part => ({ ...part })),
    }))

    expect(scene.apply([vertical, tower], {
      type: 'make-train',
    })).toEqual({
      allowed: false,
      reason: 'Lay all selected rods horizontally first.',
    })

    expect(scene.trains.value).toEqual(beforeTower)
  })

  it('rejects packing into an unselected obstacle', () => {
    const scene = createScene()

    scene.apply([], { type: 'create', value: 3 })
    scene.apply([], { type: 'create', value: 5 })
    expect(
      scene.apply([scene.trains.value[1]!.id], {
        type: 'move',
        delta: { x: 1, y: 0 },
      }),
    ).toEqual({ allowed: true })

    scene.apply([], { type: 'create', value: 1 })

    const [first, second, _obstacle] = scene.trains.value.map(train => train.id)

    // The obstacle sits in the gap that opening the selected pair creates:
    // current selected rods are at x=0 and x=4, leaving x=3 unused.

    const before = scene.trains.value.map(train => ({
      ...train,
      parts: train.parts.map(part => ({ ...part })),
    }))

    expect(scene.apply([first, second], {
      type: 'make-train',
    })).toEqual({
      allowed: false,
      reason: 'That arrangement overlaps another part.',
    })

    expect(scene.trains.value).toEqual(before)
  })

  it('rejects packing beyond the board without relocation', () => {
    const scene = createScene()

    scene.apply([], { type: 'create', value: 10 })
    const first = scene.trains.value[0]!.id
    scene.apply([], { type: 'create', value: 5 })
    const second = scene.trains.value[1]!.id

    expect(
      scene.apply([second], {
        type: 'move',
        delta: { x: 0, y: 1 },
      }),
    ).toEqual({ allowed: true })

    expect(scene.apply([], { type: 'create', value: 10 })).toEqual({
      allowed: true,
    })
    const obstacle = scene.trains.value[2]!.id

    expect(scene.apply([first, obstacle], { type: 'make-train' })).toEqual({
      allowed: true,
    })

    const combined = scene.trains.value.find(
      train => ![first, second, obstacle].includes(train.id),
    )!.id

    const before = scene.trains.value.map(train => ({
      ...train,
      parts: train.parts.map(part => ({ ...part })),
    }))

    expect(scene.apply([combined, second], {
      type: 'make-train',
    })).toEqual({
      allowed: false,
      reason: 'Keep every part inside the board.',
    })

    expect(scene.trains.value).toEqual(before)
  })

  it('flattens an existing horizontal multi-part train plus another train', () => {
    const scene = createScene()

    scene.apply([], { type: 'create', value: 3 })
    scene.apply([], { type: 'create', value: 5 })

    const [first, second] = scene.trains.value.map(train => train.id)
    expect(scene.apply([first, second], { type: 'make-train' })).toEqual({ allowed: true })

    const combined = scene.trains.value.find(train => ![first, second].includes(train.id))!
    scene.apply([], { type: 'create', value: 2 })
    const third = scene.trains.value.find(train => train.id !== combined.id)!.id

    expect(scene.apply([combined.id, third], { type: 'make-train' })).toEqual({ allowed: true })

    expect(scene.trains.value).toHaveLength(1)
    const final = scene.trains.value[0]!

    expect(final.parts.map(part => ({
      value: part.value,
      offset: part.offset,
    }))).toEqual([
      { value: 3, offset: { x: 0, y: 0 } },
      { value: 5, offset: { x: 3, y: 0 } },
      { value: 2, offset: { x: 8, y: 0 } },
    ])
  })

  it('preserves state and selection on check without allocating ids', () => {
    const scene = createScene()

    scene.apply([], { type: 'create', value: 3 })
    scene.apply([], { type: 'create', value: 5 })

    const beforeTrains = scene.trains.value.map(train => train.id)
    scene.select(scene.trains.value.map(train => train.id))

    const beforeSelection = [...scene.selection.value]

    expect(scene.check([...beforeSelection], {
      type: 'make-train',
    })).toEqual({ allowed: true })

    expect(scene.trains.value.map(train => train.id)).toEqual(beforeTrains)
    expect([...scene.selection.value]).toEqual(beforeSelection)
  })
})
