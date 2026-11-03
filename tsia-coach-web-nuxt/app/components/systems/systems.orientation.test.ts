import { describe, expect, it } from 'vitest'
import { useRodScene } from '~/composables/useRodScene'
import type { RodTrain, SceneAction } from '~/components/rod/scene/rod.scene.types'
import { trainFitsRegion } from '~/components/rod/scene/scene-regions'
import { systemsFixtures } from './systems.fixtures'
import { systemsGeometry } from './systems.geometry'
import { evaluateSystem } from './systems.evaluate'
import { substituteSystem } from './systems.substitution'
import { equationCorrectness } from './systems.feedback'

const config = systemsFixtures.development.config
const geometry = systemsGeometry(config)
const x = geometry.variableRegions[0]!
const y = geometry.variableRegions[1]!
function rod(id: string, column = x.x, row = x.y): RodTrain {
  return {
    id, anchor: { x: column, y: row },
    parts: [{ value: 3, orientation: 'horizontal', offset: { x: 0, y: 0 } }],
  }
}
function setup(trains: RodTrain[]) {
  const scene = useRodScene({
    columns: geometry.columns, rows: geometry.rows, regions: geometry.regions,
    spawnRows: [x.y], editable: () => true, allowOrientation: true, regionBoundEdits: true,
  })
  expect(scene.replace(trains).allowed).toBe(true)
  return scene
}
const turn = { type: 'set-orientation', orientation: 'vertical' } as const

describe('systems orientation prototyping', () => {
  it('turns an individual rod vertically in its region and counts all its cells', () => {
    const scene = setup([rod('a')])
    expect(scene.check(['a'], turn).allowed).toBe(true)
    expect(scene.apply(['a'], turn).allowed).toBe(true)
    expect(trainFitsRegion(scene.trains.value[0]!, x)).toBe(true)
    const evaluation = evaluateSystem(config, scene.trains.value)
    if (!evaluation.valid) throw new Error(evaluation.reason)
    expect(evaluation.equations[0].groups.x).toMatchObject({
      occupiedArea: 3, rowWidths: [1, 1, 1], status: 'incomplete', length: null,
    })
    expect(equationCorrectness(evaluation.equations[0])).toBe('neutral')
    expect(substituteSystem(config, scene.trains.value).suggestions).toHaveLength(0)
    expect(scene.apply(['a'], { type: 'set-orientation', orientation: 'horizontal' }).allowed).toBe(true)
  })

  it('slides a lower-row rod inside the region and restores its original position on reversal', () => {
    const scene = setup([rod('a', y.x, y.y + 4)])
    const before = JSON.stringify(scene.trains.value)
    expect(scene.apply(['a'], turn).allowed).toBe(true)
    expect(scene.trains.value[0]!.anchor.y).toBe(y.y + 2)
    expect(scene.apply(['a'], { type: 'set-orientation', orientation: 'horizontal' }).allowed).toBe(true)
    expect(JSON.stringify(scene.trains.value)).toBe(before)
  })

  it('rejects blocked, too-tall and tower destinations without changing source material', () => {
    const a = rod('a')
    const obstacle = rod('blocker', x.x, x.y + 1)
    const scene = setup([a, obstacle])
    const before = JSON.stringify(scene.trains.value)
    expect(scene.apply(['a'], turn).allowed).toBe(false)
    expect(JSON.stringify(scene.trains.value)).toBe(before)
    const tall = rod('tall')
    tall.parts[0]!.value = 5
    const other = setup([tall])
    for (const action of [turn, { type: 'set-orientation', orientation: 'tower' }] satisfies SceneAction[]) {
      expect(other.apply(['tall'], action).allowed).toBe(false)
    }
    expect(other.trains.value[0]).toEqual(tall)
  })

  it('removes propagation when a completed source is turned and does not overlay vertical target material', () => {
    const sources = [rod('a'), rod('b', x.x, x.y + 1), rod('c', x.x, x.y + 2)]
    const scene = setup(sources)
    expect(substituteSystem(config, scene.trains.value).suggestions).toHaveLength(4)
    expect(scene.apply(['a'], { type: 'move', delta: { x: 5, y: 0 } }).allowed).toBe(true)
    expect(scene.apply(['a'], turn).allowed).toBe(true)
    expect(substituteSystem(config, scene.trains.value).suggestions).toHaveLength(0)
    const target = geometry.variableRegions[2]!
    const vertical = rod('vertical', target.x, target.y)
    vertical.parts[0]!.orientation = 'vertical'
    const result = substituteSystem(config, [...sources, vertical])
    expect(result.suggestions).toHaveLength(0)
    expect(result.lines.join(' ')).toContain('Nothing there was replaced')
  })
})
