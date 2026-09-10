import { describe, expect, it } from 'vitest'
import { useRodScene } from './useRodScene'
import { useSceneInteraction } from './useSceneInteraction'

function setup() {
  const scene = useRodScene({
    columns: 24, rows: 11, spawnRows: [2, 5, 8], trackRows: [2, 5, 8],
    editable: () => true, allowOrientation: false,
  })
  scene.apply([], { type: 'create', value: 5 })
  const id = scene.trains.value[0]!.id
  const interaction = useSceneInteraction({ scene, blocked: () => false })
  interaction.beginMove(id)
  return { scene, id, interaction }
}

describe('track placement', () => {
  it.each([
    ['horizontal', 19, 11],
    ['vertical', 23, 7],
    ['tower', 23, 11],
  ] as const)('snaps and bounds array rods with %s orientation', (orientation, maxX, maxY) => {
    const scene = useRodScene({ columns: 24, rows: 12, spawnRows: [0], editable: () => true, allowOrientation: true })
    scene.apply([], { type: 'create', value: 5 })
    const id = scene.trains.value[0]!.id
    scene.apply([id], { type: 'set-orientation', orientation })
    const interaction = useSceneInteraction({ scene, blocked: () => false })
    interaction.beginMove(id)
    expect(interaction.constrainPosition(id, { x: 2.7, y: 3.2 })).toEqual({ x: 3, y: 3 })
    expect(interaction.constrainPosition(id, { x: -10, y: -10 })).toEqual({ x: 0, y: 0 })
    const destination = interaction.constrainPosition(id, { x: 40, y: 40 })
    expect(destination).toEqual({ x: maxX, y: maxY })
    interaction.settleMove(id, destination)
    expect(scene.trains.value[0]!.anchor).toEqual(destination)
  })

  it('snaps the preview to slots and tracks and clamps both ends before committing', () => {
    const { scene, id, interaction } = setup()
    expect(interaction.constrainPosition(id, { x: 5.3, y: 4.7 })).toEqual({ x: 5, y: 5 })
    expect(interaction.constrainPosition(id, { x: -8, y: -9 })).toEqual({ x: 0, y: 2 })
    const destination = interaction.constrainPosition(id, { x: 28, y: 15 })
    expect(destination).toEqual({ x: 19, y: 8 })
    interaction.settleMove(id, destination)
    expect(scene.trains.value[0]!.anchor).toEqual(destination)
  })

  it('moves keyboard input to the next track', () => {
    const { id, interaction } = setup()
    expect(interaction.constrainPosition(id, { x: 0, y: 3 }, { x: 0, y: 1 }))
      .toEqual({ x: 0, y: 5 })
    expect(interaction.constrainPosition(id, { x: 0, y: 1 }, { x: 0, y: -1 }))
      .toEqual({ x: 0, y: 2 })
  })

  it('rejects reference rows and occupied drops without moving existing rods', () => {
    const { scene, id, interaction } = setup()
    interaction.endMove(id)
    expect(scene.apply([id], { type: 'move', delta: { x: 0, y: 1 } }).allowed).toBe(false)
    scene.apply([], { type: 'create', value: 5 })
    interaction.beginMove(id)
    interaction.settleMove(id, interaction.constrainPosition(id, { x: 5, y: 2 }))
    expect(scene.trains.value[0]!.anchor).toEqual({ x: 0, y: 2 })
    expect(scene.message.value).toMatch(/overlaps/)
  })

  it('clamps a selected group using its entire footprint', () => {
    const { scene, id, interaction } = setup()
    interaction.endMove(id)
    scene.apply([], { type: 'create', value: 10 })
    scene.select(scene.trains.value.map(train => train.id))
    interaction.beginMove(id)
    const destination = interaction.constrainPosition(id, { x: 99, y: 5 })
    expect(destination).toEqual({ x: 9, y: 5 })
    interaction.previewMove(id, destination)
    expect(interaction.previewFor(scene.trains.value[1]!.id)).toEqual({ x: 9, y: 3 })
    interaction.settleMove(id, destination)
    expect(scene.trains.value.map(train => train.anchor)).toEqual([{ x: 9, y: 5 }, { x: 14, y: 5 }])
  })

  it('leaves a new rod in the palette when the tracks are full', () => {
    const scene = useRodScene({ columns: 5, rows: 3, spawnRows: [2], trackRows: [2], editable: () => true, allowOrientation: false })
    expect(scene.apply([], { type: 'create', value: 5 }).allowed).toBe(true)
    expect(scene.apply([], { type: 'create', value: 1 }).allowed).toBe(false)
    expect(scene.trains.value).toHaveLength(1)
  })
})
