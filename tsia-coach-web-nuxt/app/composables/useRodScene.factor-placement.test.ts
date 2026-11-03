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

  it('distinguishes a region too small from blocked space and never crosses to another equation', () => {
    const small = { ...region, depth: 3 }
    const scene = setup([rod('selected', 2, 4)], small)
    const before = JSON.stringify(scene.trains.value)
    const result = scene.apply(['selected'], square)
    expect(result.allowed).toBe(false)
    if (result.allowed) throw new Error('Expected too-small rejection')
    expect(result.reason).toContain('at least 5 columns wide and 5 rows high')
    expect(scene.message.value).toBe(result.reason)
    expect(JSON.stringify(scene.trains.value)).toBe(before)
  })

  it('rejects fully blocked placements and rechecks against newly added obstacles', () => {
    const scene = setup([rod('selected', 2, 6)])
    expect(scene.check(['selected'], square).allowed).toBe(true)
    expect(scene.replace([rod('selected', 2, 6), rod('blocker', 2, 2)]).allowed).toBe(true)
    scene.select(['selected'])
    const before = JSON.stringify(scene.trains.value)
    const result = scene.apply(['selected'], square)
    expect(result.allowed).toBe(false)
    if (result.allowed) throw new Error('Expected blocked rejection')
    expect(result.reason).toContain('existing rods block every valid 5 by 5 placement')
    expect(scene.getFactorChoices('selected')).toContainEqual({ shape: square.shape, result })
    expect(useFactorMenuChoice(scene).value).toMatchObject({ disabledReason: undefined })
    expect(JSON.stringify(scene.trains.value)).toBe(before)
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
    const home = { ...region, width: 6, depth: 2 }
    const scene = setup([
      rod('a', 2, 2, [4]), rod('b', 2, 3, [6]), rod('blocker', 6, 2, [2]),
    ], home)
    scene.select(['a', 'b'])
    const before = JSON.stringify(scene.trains.value)
    expect(scene.apply(['a', 'b'], { type: 'regroup-factors' }).allowed).toBe(false)
    expect(JSON.stringify(scene.trains.value)).toBe(before)
    expect([...scene.selection.value]).toEqual(['a', 'b'])
  })
})
