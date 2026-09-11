import { describe, expect, it } from 'vitest'
import { getMathTablaGeometry } from '~/components/tabla/mathtabla.geometry'
import { trainFitsRegion } from '~/components/rod/scene/scene-regions'
import { copyScene } from '~/components/rod/scene/scene-snapshot'
import type { RodTrain, ScenePolicy, TrainPart } from '~/components/rod/scene/rod.scene.types'
import { useRodScene } from './useRodScene'

const board = getMathTablaGeometry()
const policy: ScenePolicy = {
  columns: 26, rows: 14, spawnRows: Array.from({ length: 12 }, (_, i) => i + 2),
  regions: board.regions, editable: () => true, allowOrientation: true, allowFactors: true,
}
function rod(id: string, x: number, y: number, orientation: TrainPart['orientation'] = 'horizontal'): RodTrain {
  return { id, anchor: { x, y }, parts: [{ value: 3, offset: { x: 0, y: 0 }, orientation }] }
}

describe('region placement and previews', () => {
  it.each(board.regions)('creates directly in $id using its preferred orientation', region => {
    const scene = useRodScene(policy)
    const result = scene.apply([], { type: 'create', value: 3, regionId: region.id })
    expect(result).toEqual({ allowed: true, createdIds: ['train-1'] })
    expect(scene.trains.value).toEqual([rod('train-1', region.x, region.y, region.orientations[0])])
    expect(scene.apply([], { type: 'create', value: 3, regionId: region.id }).allowed).toBe(true)
    expect(scene.trains.value[1]!.anchor).toEqual({
      x: region.x + (region.orientations[0] === 'horizontal' ? 3 : 0),
      y: region.y + (region.orientations[0] === 'vertical' ? 3 : 0),
    })
  })

  it('rejects ambiguous, unknown, empty, and full destinations without spilling into other regions', () => {
    const scene = useRodScene(policy)
    expect(scene.apply([], { type: 'create', value: 3, row: 2, regionId: 'array' }))
      .toEqual({ allowed: false, reason: 'Choose a region or a row, not both.' })
    expect(scene.apply([], { type: 'create', value: 3, regionId: 'missing' }).allowed).toBe(false)
    const empty = useRodScene({ ...policy, regions: [{ ...board.array, orientations: [] }] })
    expect(empty.apply([], { type: 'create', value: 3, regionId: 'array' }))
      .toEqual({ allowed: false, reason: 'This region does not accept rods.' })
    for (let i = 0; i < 4; i++) expect(scene.apply([], { type: 'create', value: 3, regionId: 'vertical-d' }).allowed).toBe(true)
    const before = copyScene(scene.trains.value)
    expect(scene.apply([], { type: 'create', value: 1, regionId: 'vertical-d' }))
      .toEqual({ allowed: false, reason: 'No room for a 1-rod in this region.' })
    expect(scene.trains.value).toEqual(before)
    expect(scene.apply([], { type: 'create', value: 3 }).allowed).toBe(true)
    expect(scene.trains.value.at(-1)!.anchor).toEqual({ x: 2, y: 2 })
  })

  it.each([
    rod('corner', 0, 0), rod('h-track', 2, 0, 'vertical'),
    rod('v-track', 0, 2), rod('tower', 2, 2, 'tower'),
    rod('edge', 25, 2),
  ])('rejects invalid placement $id without changing the scene', invalid => {
    const scene = useRodScene(policy)
    expect(scene.replace([rod('existing', 5, 5)]).allowed).toBe(true)
    const before = copyScene(scene.trains.value)
    expect(scene.checkReplacement([invalid]).allowed).toBe(false)
    expect(scene.replace([invalid]).allowed).toBe(false)
    expect(scene.trains.value).toEqual(before)
  })

  it('requires all parts of one train to share a region, while independent trains may span regions', () => {
    const scene = useRodScene(policy)
    const bridge = rod('bridge', 2, 1)
    bridge.parts.push({ value: 3, orientation: 'horizontal', offset: { x: 0, y: 1 } })
    expect(scene.replace([bridge])).toEqual({ allowed: false, reason: 'Keep each train entirely within one compatible region.' })
    expect(trainFitsRegion({ ...bridge, parts: [] }, board.array)).toBe(false)
    expect(scene.replace([rod('reference', 2, 1), rod('interior', 2, 2)]).allowed).toBe(true)
    expect(scene.check(['reference'], { type: 'set-orientation', orientation: 'vertical' }).allowed).toBe(false)
    expect(scene.check(['interior'], { type: 'set-orientation', orientation: 'vertical' }).allowed).toBe(true)
  })

  it('constrains the whole selection to one nearest displacement and keeps collisions atomic', () => {
    const scene = useRodScene(policy)
    const initial = [rod('h', 2, 0), rod('v', 0, 2, 'vertical'), rod('obstacle', 3, 3)]
    expect(scene.replace(initial).allowed).toBe(true)
    scene.select(['h', 'v'])
    // Both rods stay in compatible regions; collision avoidance belongs to commit.
    const delta = scene.constrainMove(['h', 'v'], { x: 2, y: 3 })
    expect(delta).toEqual({ x: 2, y: 3 })
    const before = copyScene(scene.trains.value)
    expect(scene.apply(['h', 'v'], { type: 'move', delta }).allowed).toBe(false)
    expect(scene.trains.value).toEqual(before)
    expect([...scene.selection.value]).toEqual(['h', 'v'])
    expect(scene.apply(['obstacle'], { type: 'delete' }).allowed).toBe(true)
    expect(scene.apply(['h', 'v'], { type: 'move', delta }).allowed).toBe(true)
    expect(scene.trains.value.map(train => train.anchor)).toEqual([{ x: 4, y: 3 }, { x: 2, y: 5 }])
    expect(scene.trains.value.map(train => train.parts[0]!.orientation)).toEqual(['horizontal', 'vertical'])
  })

  it('snaps previews away from the corner and resolves ties with the least travel', () => {
    const scene = useRodScene(policy)
    scene.replace([rod('h', 2, 0), rod('v', 0, 2, 'vertical')])
    expect(scene.constrainMove(['h'], { x: -2, y: 0 })).toEqual({ x: 0, y: 0 })
    expect(scene.constrainMove(['v'], { x: 0, y: -2 })).toEqual({ x: 0, y: 0 })
    expect(scene.constrainMove(['h'], { x: 0, y: 0.5 })).toEqual({ x: 0, y: 0 })
    for (const delta of [{ x: -20, y: -20 }, { x: 30, y: 30 }, { x: 0.5, y: 1.2 }]) {
      const constrained = scene.constrainMove(['h', 'v'], delta)
      for (const train of scene.trains.value) {
        const proposed = { ...train, anchor: { x: train.anchor.x + constrained.x, y: train.anchor.y + constrained.y } }
        expect(board.regions.some(region => trainFitsRegion(proposed, region))).toBe(true)
      }
    }
  })
})
