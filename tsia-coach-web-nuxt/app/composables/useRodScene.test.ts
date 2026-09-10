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

function sceneSnapshot(scene: ReturnType<typeof createScene>) {
  return {
    trains: scene.trains.value.map(train => ({
      ...train,
      anchor: { ...train.anchor },
      parts: train.parts.map(part => ({
        ...part,
        offset: { ...part.offset },
      })),
    })),
    selection: [...scene.selection.value],
  }
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

describe('set-orientation', () => {
  it('rotates a joined train with minimal edge adjustment', () => {
    const scene = createScene()

    expect(scene.apply([], {
      type: 'create',
      value: 10,
    }).allowed).toBe(true)

    expect(scene.apply([], {
      type: 'create',
      value: 2,
    }).allowed).toBe(true)

    const originalIds = scene.trains.value.map(train => train.id)

    expect(scene.apply(originalIds, {
      type: 'make-train',
    }).allowed).toBe(true)

    const id = scene.trains.value[0]!.id

    expect(scene.apply([id], {
      type: 'set-orientation',
      orientation: 'vertical',
    }).allowed).toBe(true)

    let train = scene.trains.value[0]!

    expect(train.id).toBe(id)
    expect([...scene.selection.value]).toEqual([id])
    expect(train.anchor).toEqual({ x: 0, y: 0 })

    expect(train.parts.map(part => ({
      value: part.value,
      orientation: part.orientation,
      offset: part.offset,
    }))).toEqual([
      {
        value: 10,
        orientation: 'vertical',
        offset: { x: 0, y: 0 },
      },
      {
        value: 2,
        orientation: 'vertical',
        offset: { x: 0, y: 10 },
      },
    ])

    expect(scene.apply([id], {
      type: 'set-orientation',
      orientation: 'horizontal',
    }).allowed).toBe(true)

    train = scene.trains.value[0]!

    expect(train.id).toBe(id)
    expect(train.anchor).toEqual({ x: 0, y: 0 })
    expect(train.parts.map(part => part.value)).toEqual([10, 2])
    expect(train.parts.map(part => part.offset)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ])
  })

  it('rejects a value-13 train that cannot fit vertically', () => {
    const scene = createScene()

    scene.apply([], { type: 'create', value: 10 })
    scene.apply([], { type: 'create', value: 3 })
    const ids = scene.trains.value.map(train => train.id)
    scene.apply(ids, { type: 'make-train' })

    const id = scene.trains.value[0]!.id
    const before = sceneSnapshot(scene)

    expect(scene.apply([id], {
      type: 'set-orientation',
      orientation: 'vertical',
    })).toEqual({
      allowed: false,
      reason: 'A value-13 train cannot fit vertically on this 24-column, 12-row board.',
    })
    expect(sceneSnapshot(scene)).toEqual(before)
  })

  it('rejects an obstacle at the edge-adjusted destination', () => {
    const scene = createScene()

    scene.apply([], { type: 'create', value: 1 })
    const obstacle = scene.trains.value[0]!.id
    scene.apply([obstacle], {
      type: 'move',
      delta: { x: 0, y: -4 },
    })

    scene.apply([], { type: 'create', value: 10 })
    scene.apply([], { type: 'create', value: 2 })
    const parts = scene.trains.value
      .filter(train => train.id !== obstacle)
      .map(train => train.id)
    scene.apply(parts, { type: 'make-train' })

    const id = [...scene.selection.value][0]!
    const before = sceneSnapshot(scene)

    expect(scene.apply([id], {
      type: 'set-orientation',
      orientation: 'vertical',
    })).toEqual({
      allowed: false,
      reason: 'Cannot change orientation. That arrangement overlaps another part.',
    })
    expect(sceneSnapshot(scene)).toEqual(before)
  })

  it('rejects selected trains whose adjusted destinations overlap', () => {
    const scene = createScene()

    scene.apply([], { type: 'create', value: 10 })
    scene.apply([], { type: 'create', value: 2 })
    scene.apply(
      scene.trains.value.map(train => train.id),
      { type: 'make-train' },
    )

    const first = scene.trains.value[0]!.id
    scene.apply([first], {
      type: 'move',
      delta: { x: 0, y: -4 },
    })

    scene.apply([], { type: 'create', value: 10 })
    scene.apply([], { type: 'create', value: 2 })
    const secondParts = scene.trains.value
      .filter(train => train.id !== first)
      .map(train => train.id)
    scene.apply(secondParts, { type: 'make-train' })

    const second = scene.trains.value.find(train => train.id !== first)!.id
    scene.select([first, second])
    const before = sceneSnapshot(scene)

    expect(scene.apply([first, second], {
      type: 'set-orientation',
      orientation: 'vertical',
    })).toEqual({
      allowed: false,
      reason: 'Cannot change orientation. That arrangement overlaps another part.',
    })
    expect(sceneSnapshot(scene)).toEqual(before)
  })

  it('rejects Tower for a multipart train', () => {
    const scene = createScene()

    scene.apply([], { type: 'create', value: 3 })
    scene.apply([], { type: 'create', value: 5 })
    scene.apply(
      scene.trains.value.map(train => train.id),
      { type: 'make-train' },
    )

    const id = scene.trains.value[0]!.id
    const before = sceneSnapshot(scene)

    expect(scene.apply([id], {
      type: 'set-orientation',
      orientation: 'tower',
    })).toEqual({
      allowed: false,
      reason: 'Tower is available only for individual rods.',
    })
    expect(sceneSnapshot(scene)).toEqual(before)
  })

  it.each(['horizontal', 'vertical', 'tower'] as const)(
    'rejects %s orientation in Bar',
    (orientation) => {
      const scene = useRodScene({
        columns: 24,
        rows: 12,
        spawnRows: [4],
        editable: () => true,
        allowOrientation: false,
      })

      scene.apply([], { type: 'create', value: 3 })
      const id = scene.trains.value[0]!.id
      scene.select([id])
      const before = sceneSnapshot(scene)

      expect(scene.apply([id], {
        type: 'set-orientation',
        orientation,
      })).toEqual({
        allowed: false,
        reason: 'This scene does not allow orientation changes.',
      })
      expect(sceneSnapshot(scene)).toEqual(before)
    },
  )
})

describe('ungroup', () => {
  it('ungroups at the current position and selects the released rods', () => {
    const scene = createScene()

    expect(scene.apply([], {
      type: 'create',
      value: 3,
    }).allowed).toBe(true)

    expect(scene.apply([], {
      type: 'create',
      value: 5,
    }).allowed).toBe(true)

    const originalIds = scene.trains.value.map(train => train.id)

    expect(scene.apply(originalIds, {
      type: 'make-train',
    }).allowed).toBe(true)

    const combinedId = scene.trains.value[0]!.id

    // Move after composition: ungroup must preserve this location.
    expect(scene.apply([combinedId], {
      type: 'move',
      delta: { x: 2, y: 1 },
    }).allowed).toBe(true)

    expect(scene.apply([combinedId], {
      type: 'ungroup',
    })).toEqual({ allowed: true })

    const released = scene.trains.value

    expect(released).toHaveLength(2)

    expect(released.map(train => ({
      anchor: train.anchor,
      parts: train.parts,
    }))).toEqual([
      {
        anchor: { x: 2, y: 5 },
        parts: [{
          value: 3,
          orientation: 'horizontal',
          offset: { x: 0, y: 0 },
        }],
      },
      {
        anchor: { x: 5, y: 5 },
        parts: [{
          value: 5,
          orientation: 'horizontal',
          offset: { x: 0, y: 0 },
        }],
      },
    ])

    expect([...scene.selection.value]).toEqual(
      released.map(train => train.id),
    )

    const previousIds = new Set([...originalIds, combinedId])

    for (const train of released) {
      expect(previousIds.has(train.id)).toBe(false)
    }
  })

  it('rejects a single rod without changing scene or selection', () => {
    const scene = createScene()

    scene.apply([], { type: 'create', value: 3 })
    const id = scene.trains.value[0]!.id
    scene.select([id])

    const before = sceneSnapshot(scene)

    expect(scene.apply([id], { type: 'ungroup' })).toEqual({
      allowed: false,
      reason: 'Select only trains with multiple parts.',
    })

    expect(sceneSnapshot(scene)).toEqual(before)
  })

  it('rejects when the selection mixes a multipart train and a single rod', () => {
    const scene = createScene()

    scene.apply([], { type: 'create', value: 3 })
    scene.apply([], { type: 'create', value: 5 })
    const combinedIds = scene.trains.value.map(train => train.id)
    scene.apply(combinedIds, { type: 'make-train' })
    const combined = scene.trains.value[0]!.id

    scene.apply([], { type: 'create', value: 2 })
    const single = scene.trains.value.find(train => train.id !== combined)!.id

    scene.select([combined, single])
    const before = sceneSnapshot(scene)

    expect(scene.apply([combined, single], { type: 'ungroup' })).toEqual({
      allowed: false,
      reason: 'Select only trains with multiple parts.',
    })

    expect(sceneSnapshot(scene)).toEqual(before)
  })

  it('releases all parts from two multipart trains and selects them', () => {
    const scene = createScene()

    scene.apply([], { type: 'create', value: 3 })
    scene.apply([], { type: 'create', value: 2 })
    const firstIds = scene.trains.value.map(train => train.id)
    scene.apply(firstIds, { type: 'make-train' })
    const firstCombined = scene.trains.value[0]!.id

    expect(scene.apply([firstCombined], {
      type: 'move',
      delta: { x: 10, y: 2 },
    }).allowed).toBe(true)

    scene.apply([], { type: 'create', value: 4 })
    scene.apply([], { type: 'create', value: 1 })
    const secondIds = scene.trains.value
      .filter(train => train.id !== firstCombined)
      .map(train => train.id)
    scene.apply(secondIds, { type: 'make-train' })
    const secondCombined = scene.trains.value
      .find(train => train.id !== firstCombined)!.id

    expect(scene.apply([firstCombined, secondCombined], {
      type: 'ungroup',
    })).toEqual({ allowed: true })

    const released = scene.trains.value

    expect(released).toHaveLength(4)
    expect(released.every(train => train.parts.length === 1)).toBe(true)
    expect([...scene.selection.value].sort()).toEqual(
      released.map(train => train.id).sort(),
    )
  })

  it('preserves vertical orientation and absolute position when ungrouping', () => {
    const scene = createScene()

    scene.apply([], { type: 'create', value: 3 })
    scene.apply([], { type: 'create', value: 5 })
    const ids = scene.trains.value.map(train => train.id)
    scene.apply(ids, { type: 'make-train' })
    const combined = scene.trains.value[0]!.id

    expect(scene.apply([combined], {
      type: 'set-orientation',
      orientation: 'vertical',
    }).allowed).toBe(true)

    const train = scene.trains.value[0]!
    const anchorBefore = { ...train.anchor }
    const partsBefore = train.parts.map(part => ({
      value: part.value,
      orientation: part.orientation,
      offset: { ...part.offset },
    }))

    expect(scene.apply([combined], { type: 'ungroup' })).toEqual({
      allowed: true,
    })

    const released = scene.trains.value

    expect(released).toHaveLength(2)

    expect(released.map(train => ({
      anchor: train.anchor,
      parts: train.parts.map(part => ({
        value: part.value,
        orientation: part.orientation,
        offset: part.offset,
      })),
    }))).toEqual(
      partsBefore.map(part => ({
        anchor: {
          x: anchorBefore.x + part.offset.x,
          y: anchorBefore.y + part.offset.y,
        },
        parts: [{
          value: part.value,
          orientation: part.orientation,
          offset: { x: 0, y: 0 },
        }],
      })),
    )
  })

  it('preserves state and selection on check without allocating ids', () => {
    const scene = createScene()

    scene.apply([], { type: 'create', value: 3 })
    scene.apply([], { type: 'create', value: 5 })
    const ids = scene.trains.value.map(train => train.id)
    scene.apply(ids, { type: 'make-train' })
    const combined = scene.trains.value[0]!.id
    scene.select([combined])

    const beforeTrains = scene.trains.value.map(train => train.id)
    const beforeSelection = [...scene.selection.value]

    expect(scene.check([combined], { type: 'ungroup' })).toEqual({
      allowed: true,
    })

    expect(scene.trains.value.map(train => train.id)).toEqual(beforeTrains)
    expect([...scene.selection.value]).toEqual(beforeSelection)

    // check() must not have consumed any ids: apply() still allocates fresh ones.
    expect(scene.apply([combined], { type: 'ungroup' }).allowed).toBe(true)
    expect(scene.trains.value.map(train => train.id)).not.toContain(combined)
  })

  it('rejects apply without mutation when editing becomes disabled after check', () => {
    let editable = true
    const scene = useRodScene({
      columns: 24,
      rows: 12,
      spawnRows: [4],
      editable: () => editable,
      allowOrientation: true,
    })

    scene.apply([], { type: 'create', value: 3 })
    scene.apply([], { type: 'create', value: 5 })
    const ids = scene.trains.value.map(train => train.id)
    scene.apply(ids, { type: 'make-train' })
    const combined = scene.trains.value[0]!.id

    expect(scene.check([combined], { type: 'ungroup' })).toEqual({
      allowed: true,
    })

    editable = false

    const before = sceneSnapshot(scene)

    expect(scene.apply([combined], { type: 'ungroup' })).toEqual({
      allowed: false,
      reason: 'Editing is unavailable in portrait preview.',
    })

    expect(sceneSnapshot(scene)).toEqual(before)
  })
})
