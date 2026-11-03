import { describe, expect, it } from 'vitest'
import { useRodScene } from './useRodScene'
import { useFactorMenuChoice } from './useFactorMenuChoice'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import type { RodTrain, SceneRegion } from '~/components/rod/scene/rod.scene.types'
import { trainFitsRegion } from '~/components/rod/scene/scene-regions'
import { trainMagnitude } from '~/components/rod/scene/rod-arithmetic'

const region: SceneRegion = {
  id: 'equation-1:y', x: 2, y: 2, width: 25, depth: 5, orientations: ['horizontal'],
}
const square = { type: 'regroup-factors', shape: { rows: 5, columns: 5 } } as const

function rod(id: string, x: number, y: number, values: CuisenaireRodValue[] = [10, 10, 5]): RodTrain {
  let offset = 0
  return {
    id, anchor: { x, y },
    parts: values.map(value => {
      const part = { value, orientation: 'horizontal' as const, offset: { x: offset, y: 0 } }
      offset += value
      return part
    }),
  }
}

function setup(trains: RodTrain[], home = region) {
  const scene = useRodScene({
    columns: 40, rows: 16, spawnRows: [12], editable: () => true,
    allowOrientation: true, allowFactors: true, regionBoundEdits: true,
    regions: [
      home,
      { id: 'equation-2:y', x: 2, y: 8, width: 25, depth: 5, orientations: ['horizontal'] },
    ],
  })
  expect(scene.replace(trains)).toEqual({ allowed: true })
  scene.select(trains.map(train => train.id))
  return scene
}

describe('region-bound factor placement', () => {
  it('moves a 25-cell train upward into the nearest 5 by 5 placement', () => {
    const scene = setup([rod('selected', 2, 6)])
    const before = JSON.stringify(scene.trains.value)
    expect(scene.check(['selected'], square)).toEqual({ allowed: true })
    expect(scene.getFactorChoices('selected')).toContainEqual({ shape: square.shape, result: { allowed: true } })
    expect(useFactorMenuChoice(scene).value).toMatchObject({ kind: 'submenu', disabledReason: undefined })
    expect(JSON.stringify(scene.trains.value)).toBe(before)

    expect(scene.apply(['selected'], square)).toEqual({ allowed: true, createdIds: [] })
    const result = scene.trains.value[0]!
    expect(result.anchor).toEqual({ x: 2, y: 2 })
    expect(result.parts).toHaveLength(5)
    expect(trainMagnitude(result)).toBe(25)
    expect(trainFitsRegion(result, region)).toBe(true)
    expect([...scene.selection.value]).toEqual(['selected'])
  })

  it('prefers the existing anchor when it already fits', () => {
    const scene = setup([rod('selected', 2, 2)])
    expect(scene.apply(['selected'], square).allowed).toBe(true)
    expect(scene.trains.value[0]!.anchor).toEqual({ x: 2, y: 2 })
  })

  it('searches past obstacles without moving them and uses a deterministic nearest fit', () => {
    const obstacle = rod('obstacle', 2, 2, [1])
    const scene = setup([rod('selected', 2, 6), obstacle])
    scene.select(['selected'])
    expect(scene.apply(['selected'], square).allowed).toBe(true)
    expect(scene.trains.value[0]!.anchor).toEqual({ x: 3, y: 2 })
    expect(scene.trains.value[1]).toEqual(obstacle)
  })

  it('distributes factors when the region is too shallow for a rectangle', () => {
    const small = { ...region, depth: 3 }
    const scene = setup([rod('selected', 2, 4)], small)
    const result = scene.apply(['selected'], square)
    expect(result.allowed).toBe(true)
    expect(scene.trains.value[0]!.parts).toHaveLength(5)
    expect(trainFitsRegion(scene.trains.value[0]!, small)).toBe(true)
    expect(trainMagnitude(scene.trains.value[0]!)).toBe(25)
  })

  it('distributes groups around obstacles that block every complete rectangle', () => {
    const scene = setup([rod('selected', 2, 6)])
    expect(scene.check(['selected'], square).allowed).toBe(true)
    expect(scene.replace([rod('selected', 2, 6), rod('blocker', 2, 2)]).allowed).toBe(true)
    scene.select(['selected'])
    const result = scene.apply(['selected'], square)
    expect(result.allowed).toBe(true)
    expect(scene.getFactorChoices('selected')).toContainEqual({ shape: square.shape, result: { allowed: true } })
    expect(useFactorMenuChoice(scene).value).toMatchObject({ disabledReason: undefined })
    expect(scene.trains.value[1]).toEqual(rod('blocker', 2, 2))
    expect(trainFitsRegion(scene.trains.value[0]!, region)).toBe(true)
    expect([...scene.selection.value]).toEqual(['selected'])
  })

  it.each([{ rows: 2, columns: 6 }, { rows: 3, columns: 4 }] as const)(
    'searches independently for the supported factor pair %j',
    shape => {
      const scene = setup([rod('selected', 2, 6, [10, 2])])
      expect(scene.apply(['selected'], { type: 'regroup-factors', shape }).allowed).toBe(true)
      const result = scene.trains.value[0]!
      expect(result.anchor).toEqual({ x: 2, y: 7 - shape.rows })
      expect(trainMagnitude(result)).toBe(12)
      expect(trainFitsRegion(result, region)).toBe(true)
    },
  )

  it.each([{ rows: 1, columns: 25 }, { rows: 25, columns: 1 }])(
    'supports the linear factor arrangement %j using only catalog rods',
    shape => {
      const home = { ...region, depth: 25 }
      const scene = useRodScene({
        columns: 40, rows: 30, spawnRows: [2], editable: () => true,
        allowOrientation: true, allowFactors: true, regionBoundEdits: true, regions: [home],
      })
      expect(scene.replace([rod('selected', 2, 6)]).allowed).toBe(true)
      expect(scene.apply(['selected'], { type: 'regroup-factors', shape }).allowed).toBe(true)
      const result = scene.trains.value[0]!
      expect(trainFitsRegion(result, home)).toBe(true)
      expect(trainMagnitude(result)).toBe(25)
      expect(result.parts.every(part => part.value >= 1 && part.value <= 10)).toBe(true)
      expect(new Set(result.parts.map(part => part.offset.y)).size).toBe(shape.rows)
    },
  )

  it('excludes all selected sources and commits their non-overlapping replacements together', () => {
    const home = { ...region, width: 12, depth: 2 }
    const scene = setup([rod('a', 2, 3, [6]), rod('b', 8, 3, [6])], home)
    expect(scene.apply(['a', 'b'], { type: 'regroup-factors' }).allowed).toBe(true)
    expect(scene.trains.value.map(train => train.anchor)).toEqual([{ x: 2, y: 2 }, { x: 8, y: 2 }])
    expect(scene.trains.value.map(trainMagnitude)).toEqual([6, 6])
  })

  it('preserves every source when the selected replacements cannot all fit', () => {
    const home = { ...region, width: 4, depth: 3 }
    const source = rod('a', 2, 2, [3])
    source.parts.push({ value: 3, orientation: 'horizontal', offset: { x: 0, y: 1 } })
    const scene = setup([
      source, rod('blocker-1', 5, 2, [1]), rod('blocker-2', 5, 3, [1]), rod('blocker-3', 2, 4, [4]),
    ], home)
    scene.select(['a'])
    const before = JSON.stringify(scene.trains.value)
    const result = scene.apply(['a'], { type: 'regroup-factors', shape: { rows: 3, columns: 2 } })
    expect(result.allowed).toBe(false)
    if (result.allowed) throw new Error('Expected insufficient contiguous space')
    expect(result.reason).toContain('No collision-free placement')
    expect(JSON.stringify(scene.trains.value)).toBe(before)
    expect([...scene.selection.value]).toEqual(['a'])
  })

  it('breaks 24 into twelve twos without requiring twelve coefficient rows', () => {
    const scene = setup([rod('selected', 2, 2, [10, 10, 4])], { ...region, depth: 2 })
    const action = { type: 'regroup-factors', shape: { rows: 12, columns: 2 } } as const
    const before = JSON.stringify(scene.trains.value)
    expect(scene.check(['selected'], action).allowed).toBe(true)
    expect(JSON.stringify(scene.trains.value)).toBe(before)
    expect(scene.apply(['selected'], action).allowed).toBe(true)
    const result = scene.trains.value[0]!
    expect(result.parts).toHaveLength(12)
    expect(result.parts.every(part => part.value === 2)).toBe(true)
    expect(trainMagnitude(result)).toBe(24)
    expect(trainFitsRegion(result, { ...region, depth: 2 })).toBe(true)
    expect(result.id).toBe('selected')
  })
})
