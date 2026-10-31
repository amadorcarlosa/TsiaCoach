import { describe, expect, it } from 'vitest'
import { useRodScene } from '~/composables/useRodScene'
import { copyScene } from './scene-snapshot'
import { trainSchema } from '~/components/playground/files/level-document.schema'
import type { RodTrain } from './rod.scene.types'

const policy = { columns: 48, rows: 48, spawnRows: [0], editable: () => true, allowOrientation: true, allowFactors: true }
const source: RodTrain = { id: 'train', anchor: { x: 0, y: 0 }, parts: [
  { value: 10, orientation: 'horizontal', offset: { x: 0, y: 0 } },
  { value: 10, orientation: 'horizontal', offset: { x: 10, y: 0 } },
  { value: 4, orientation: 'horizontal', offset: { x: 20, y: 0 } },
] }

describe('multi-rod addend groups', () => {
  it.each(Array.from({ length: 23 }, (_, i) => i + 1))('preserves both addends for %i + its complement', a => {
    const scene = useRodScene(policy)
    scene.replace([source])
    expect(scene.apply(['train'], { type: 'regroup-addends', pair: [a, 24 - a] }).allowed).toBe(true)
    const trains = scene.trains.value
    expect(trains).toHaveLength(2)
    expect(trains.map(train => train.parts.reduce((sum, part) => sum + part.value, 0))).toEqual([a, 24 - a])
    expect(trains[1]!.anchor).toEqual({ x: a, y: 0 })
    for (const train of trains) {
      expect(train.parts.every(part => part.value >= 1 && part.value <= 10)).toBe(true)
      expect(train.parts.map(part => part.offset.x)).toEqual(train.parts.map((_, i) => train.parts.slice(0, i).reduce((sum, part) => sum + part.value, 0)))
    }
  })

  it('moves, factors and saves each addend independently', () => {
    const scene = useRodScene(policy)
    scene.replace([source])
    const result = scene.apply(['train'], { type: 'regroup-addends', pair: [14, 10] })
    expect(result.allowed && result.createdIds).toHaveLength(2)
    const [first, second] = copyScene(scene.trains.value)
    expect(first!.parts.map(part => part.value)).toEqual([10, 4])
    expect(second!.parts.map(part => part.value)).toEqual([10])
    expect(scene.apply([first!.id], { type: 'move', delta: { x: 0, y: 2 } }).allowed).toBe(true)
    expect(copyScene(scene.trains.value)[1]).toEqual(second)
    expect(scene.apply([first!.id], { type: 'regroup-factors', shape: { rows: 2, columns: 7 } }).allowed).toBe(true)
    expect(scene.trains.value[0]!.parts.map(part => part.value)).toEqual([7, 7])
    expect(copyScene(scene.trains.value)[1]).toEqual(second)
    const saved = copyScene(scene.trains.value).map(train => trainSchema.parse(JSON.parse(JSON.stringify(train))))
    expect(scene.replace(saved).allowed).toBe(true)
    expect(copyScene(scene.trains.value)).toEqual(saved)
    expect(scene.apply([first!.id], { type: 'ungroup' }).allowed).toBe(true)
    expect(scene.trains.value).toHaveLength(3)
  })

  it('creates two 12 trains with local offsets, and rotates one independently', () => {
    const scene = useRodScene(policy)
    scene.replace([source])
    scene.apply(['train'], { type: 'regroup-addends', pair: [12, 12] })
    const [first, second] = copyScene(scene.trains.value)
    expect(first!.parts.map(part => part.value)).toEqual([10, 2])
    expect(second!.parts.map(part => part.value)).toEqual([10, 2])
    expect(second!.parts.map(part => part.offset.x)).toEqual([0, 10])
    expect(scene.apply([first!.id], { type: 'set-orientation', orientation: 'vertical' }).allowed).toBe(true)
    expect(copyScene(scene.trains.value)[1]).toEqual(second)
  })

  it('rejects incomplete saved groups and invalid pairs without changing the scene', () => {
    const scene = useRodScene(policy)
    scene.replace([source])
    expect(scene.replace([{ ...source, parts: source.parts.map(part => ({ ...part, addendGroup: 0 as const })) }]).allowed).toBe(false)
    for (const pair of [[0, 24], [-1, 25], [12.5, 11.5], [12, 13]] as const) {
      expect(scene.apply(['train'], { type: 'regroup-addends', pair }).allowed).toBe(false)
    }
    expect(copyScene(scene.trains.value)).toEqual([source])
  })
})
