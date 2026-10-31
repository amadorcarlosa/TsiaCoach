import { describe, it, expect } from 'vitest'
import { useRodScene } from './useRodScene'
import { getMathTablaGeometry } from '~/components/tabla/mathtabla.geometry'
import { getMathTablaReadouts } from '~/components/tabla/mathtabla.readouts'
import type { MaterialRole, RodTrain, ScenePolicy } from '~/components/rod/scene/rod.scene.types'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'

const geometry = getMathTablaGeometry(24, 12)

function scene(layered = true) {
  let active = layered

  const policy: ScenePolicy = {
    columns: geometry.config.columns,
    rows: geometry.config.rows,
    spawnRows: Array.from({ length: 12 }, (_, row) => geometry.array.y + row),
    regions: geometry.regions,
    editable: () => true,
    allowOrientation: true,
    allowFactors: true,
    allowAreaRegroup: true,
    layeredRoles: {
      enabled: () => active,
      regionId: 'array',
      wholeOf: trains => getMathTablaReadouts(trains, geometry).guide,
    },
  }

  return {
    rods: useRodScene(policy),
    setActive: (value: boolean) => { active = value },
  }
}

/** The 4 × 6 whole of the acceptance example, built through the scene itself. */
function withWhole(rods: ReturnType<typeof useRodScene>) {
  expect(rods.apply([], { type: 'create', value: 4, regionId: 'horizontal-d' }).allowed).toBe(true)
  expect(rods.apply([], { type: 'create', value: 6, regionId: 'vertical-d' }).allowed).toBe(true)
}

function place(
  rods: ReturnType<typeof useRodScene>,
  value: CuisenaireRodValue,
  materialRole: MaterialRole,
) {
  const result = rods.apply([], { type: 'create', value, regionId: 'array', materialRole })
  expect(result.allowed).toBe(true)
  return result.allowed ? result.createdIds[0]! : ''
}

const find = (rods: ReturnType<typeof useRodScene>, id: string) =>
  rods.trains.value.find(train => train.id === id)!

/**
 * Creation scans the whole 24-wide central region for a free cell, so a piece
 * meant for the 4-wide whole has to be moved onto its row explicitly.
 */
function placeAt(
  rods: ReturnType<typeof useRodScene>,
  value: CuisenaireRodValue,
  materialRole: MaterialRole,
  x: number,
  y: number,
) {
  const id = place(rods, value, materialRole)
  const at = find(rods, id).anchor

  if (at.x !== x || at.y !== y) {
    const moved = rods.apply([id], { type: 'move', delta: { x: x - at.x, y: y - at.y } })
    expect(moved.allowed).toBe(true)
  }

  expect(find(rods, id).anchor).toEqual({ x, y })
  return id
}

describe('material roles through scene actions', () => {
  it('records the creation role and never infers it from position', () => {
    const { rods } = scene()
    withWhole(rods)

    const tile = place(rods, 4, 'denominator')
    const rod = place(rods, 4, 'numerator')

    expect(find(rods, tile).materialRole).toBe('denominator')
    expect(find(rods, rod).materialRole).toBe('numerator')

    // Moving the tile onto the rod's row leaves it a tile.
    const moved = rods.apply([tile], { type: 'move', delta: { x: 0, y: 1 } })
    expect(moved.allowed).toBe(true)
    expect(find(rods, tile).materialRole).toBe('denominator')
  })

  it('stacks a numerator rod on a denominator tile and rejects a second rod', () => {
    const { rods } = scene()
    withWhole(rods)

    const tile = place(rods, 4, 'denominator')
    expect(find(rods, tile).anchor).toEqual({ x: 2, y: 2 })

    const rod = place(rods, 4, 'numerator')
    expect(find(rods, rod).anchor).toEqual({ x: 2, y: 2 })

    // A second numerator rod cannot take the same cells; it lands elsewhere.
    const second = place(rods, 4, 'numerator')
    expect(find(rods, second).anchor).not.toEqual({ x: 2, y: 2 })
  })

  it('leaves a rejected action without mutating the scene', () => {
    const { rods } = scene()
    withWhole(rods)

    const rod = place(rods, 4, 'numerator')
    const before = JSON.parse(JSON.stringify(rods.trains.value))

    // Four columns wide: one step right leaves the whole.
    const result = rods.apply([rod], { type: 'move', delta: { x: 1, y: 0 } })

    expect(result.allowed).toBe(false)
    expect(JSON.parse(JSON.stringify(rods.trains.value))).toEqual(before)
  })

  it('rejects a reference change that would strand numerator rods', () => {
    const { rods } = scene()
    withWhole(rods)
    place(rods, 4, 'numerator')

    const horizontal = rods.trains.value.find(train => train.anchor.y === 0)!
    // Shrinking the whole is refused while a rod depends on its width.
    const result = rods.check([horizontal.id], { type: 'delete' })

    expect(result.allowed).toBe(false)
    expect(result.allowed === false && result.reason)
      .toContain('Define the whole with both D references')
  })

  it('carries the role through clone, ungroup and area regrouping', () => {
    const { rods } = scene()
    withWhole(rods)

    const tile = place(rods, 4, 'denominator')

    const cloned = rods.apply([tile], { type: 'clone' })
    expect(cloned.allowed).toBe(true)
    const copy = cloned.allowed ? cloned.createdIds[0]! : ''
    expect(find(rods, copy).materialRole).toBe('denominator')
    expect(rods.apply([copy], { type: 'delete' }).allowed).toBe(true)

    const factored = rods.apply([tile], { type: 'regroup-factors', shape: { rows: 2, columns: 2 } })
    expect(factored.allowed).toBe(true)
    expect(find(rods, tile).materialRole).toBe('denominator')

    const regrouped = rods.apply([tile], { type: 'regroup-area', grouping: 'columns' })
    expect(regrouped.allowed).toBe(true)
    expect(find(rods, tile).materialRole).toBe('denominator')

    const released = rods.apply([tile], { type: 'ungroup' })
    expect(released.allowed).toBe(true)
    expect(released.allowed && released.createdIds.map(id => find(rods, id).materialRole))
      .toEqual(['denominator', 'denominator'])
  })

  it('refuses to move role-bearing material onto a reference track', () => {
    const { rods } = scene()
    withWhole(rods)
    const rod = placeAt(rods, 4, 'numerator', 2, 2)

    // One row up is the horizontal N track: a legal region for a 4-rod, but
    // not a legal destination for material that means a numerator quantity.
    const result = rods.check([rod], { type: 'move', delta: { x: 0, y: -1 } })

    expect(result).toEqual({
      allowed: false,
      reason: 'Denominator tiles and numerator rods belong in the central array.',
    })
    expect(rods.constrainMove([rod], { x: 0, y: -1 })).toEqual({ x: 0, y: 0 })
  })

  it('refuses to join denominator tiles and numerator rods into one train', () => {
    const { rods } = scene()
    withWhole(rods)

    const tile = place(rods, 4, 'denominator')
    const rod = place(rods, 2, 'numerator')
    // Lay them on one row so only the role difference can refuse the join.
    rods.apply([rod], { type: 'move', delta: { x: 0, y: 1 } })

    const result = rods.check([tile, rod], { type: 'make-train' })

    expect(result).toEqual({
      allowed: false,
      reason: 'Select material of one kind: denominator tiles and numerator rods cannot join one train.',
    })
  })

  it('converts a role only through the explicit action, and only in the activity', () => {
    const { rods, setActive } = scene()
    withWhole(rods)
    const tile = place(rods, 4, 'denominator')

    expect(rods.apply([tile], { type: 'set-material-role', materialRole: 'numerator' }).allowed).toBe(true)
    expect(find(rods, tile).materialRole).toBe('numerator')

    setActive(false)
    expect(rods.check([tile], { type: 'set-material-role', materialRole: 'denominator' })).toEqual({
      allowed: false,
      reason: 'Material roles are available in fraction multiplication.',
    })
  })

  it('survives a capture and restore round trip', () => {
    const { rods } = scene()
    withWhole(rods)
    place(rods, 4, 'denominator')
    place(rods, 4, 'numerator')

    const captured: RodTrain[] = JSON.parse(JSON.stringify(rods.trains.value))
    expect(rods.replace([]).allowed).toBe(true)
    expect(rods.replace(captured).allowed).toBe(true)

    expect(rods.trains.value.map(train => train.materialRole))
      .toEqual([undefined, undefined, 'denominator', 'numerator'])
  })

  it('rejects a layered snapshot once the activity is inactive', () => {
    const { rods, setActive } = scene()
    withWhole(rods)
    place(rods, 4, 'denominator')
    place(rods, 4, 'numerator')

    const layered: RodTrain[] = JSON.parse(JSON.stringify(rods.trains.value))

    setActive(false)
    const result = rods.validateSnapshot(layered)

    expect(result).toEqual({
      allowed: false,
      reason: 'That arrangement overlaps another part.',
    })
  })

  it('keeps a numerator drag preview inside the whole', () => {
    const { rods } = scene()
    withWhole(rods)
    const rod = place(rods, 4, 'numerator')

    // Asking to leave the 4-wide whole yields no horizontal movement at all.
    expect(rods.constrainMove([rod], { x: 3, y: 0 })).toEqual({ x: 0, y: 0 })
    // Down three rows is inside the 6-deep whole, so it is offered.
    expect(rods.constrainMove([rod], { x: 0, y: 3 })).toEqual({ x: 0, y: 3 })
  })
})

describe('MathTabla readouts with roles', () => {
  it('reports no selected coverage for a completely tiled whole', () => {
    const { rods } = scene()
    withWhole(rods)
    for (let row = 0; row < 6; row++) placeAt(rods, 4, 'denominator', 2, 2 + row)

    const readouts = getMathTablaReadouts(rods.trains.value, geometry, { layered: true })

    expect(readouts.guideCells).toBe(24)
    expect(readouts.denominatorCells).toBe(24)
    expect(readouts.numeratorCells).toBe(0)
  })

  it('counts unique numerator cells only, ignoring tiles beneath them', () => {
    const { rods } = scene()
    withWhole(rods)
    for (let row = 0; row < 6; row++) placeAt(rods, 4, 'denominator', 2, 2 + row)
    for (let row = 0; row < 3; row++) placeAt(rods, 4, 'numerator', 2, 2 + row)

    const readouts = getMathTablaReadouts(rods.trains.value, geometry, { layered: true })

    expect(readouts.numeratorCells).toBe(12)
    expect(readouts.denominatorCells).toBe(24)
    expect(readouts.guideCells).toBe(24)
  })

  it('counts numerator rods placed on the bare whole with no tiles', () => {
    const { rods } = scene()
    withWhole(rods)
    place(rods, 4, 'numerator')

    const readouts = getMathTablaReadouts(rods.trains.value, geometry, { layered: true })

    expect(readouts.numeratorCells).toBe(4)
    expect(readouts.denominatorCells).toBe(0)
  })

  it('leaves the ordinary occupied count unchanged when no activity is active', () => {
    const { rods } = scene(false)
    withWhole(rods)
    expect(rods.apply([], { type: 'create', value: 4, regionId: 'array' }).allowed).toBe(true)

    const readouts = getMathTablaReadouts(rods.trains.value, geometry)

    expect(readouts.occupiedCells).toBe(4)
    expect(readouts.numeratorCells).toBe(0)
    expect(readouts.denominatorCells).toBe(0)
  })
})
