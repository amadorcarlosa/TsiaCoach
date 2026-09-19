import { describe, expect, it } from 'vitest'
import { baseTenCatalog, baseTenDimensions, playableDenominations, type PlayableDenomination } from '~/components/basetenblocks/base10.types'
import { useBaseTenScene } from './useBaseTenScene'

function setup(columns = 120, rows = 120) {
  const scene = useBaseTenScene({ editable: () => true, columns, rows })
  function add(denomination: PlayableDenomination) {
    expect(scene.apply([], { type: 'create', denomination })).toEqual({ allowed: true })
    return [...scene.selection.value][0]!
  }
  return { scene, add }
}
describe('base-ten scene', () => {
  it('creates large denominations as towers and prevents laying them flat', () => {
    const { scene, add } = setup()
    for (const denomination of ['tenThousands', 'hundredThousands'] as const) {
      const id = add(denomination)
      const block = scene.blocks.value.find(block => block.id === id)!
      expect(block.pose).toBe('tower')
      expect(baseTenDimensions(block)).toEqual({ width: denomination === 'tenThousands' ? 10 : 100, depth: 10, height: 100 })
      expect(scene.apply([id], { type: 'set-pose', pose: 'standard' }).allowed).toBe(false)
    }
  })
  it('stands hundreds on edge, turns them, and clones the pose', () => {
    const { scene, add } = setup()
    const id = add('hundreds')
    expect(scene.blocks.value[0]!.pose).toBe('standard')
    expect(scene.apply([id], { type: 'set-pose', pose: 'tower' }).allowed).toBe(true)
    expect(baseTenDimensions(scene.blocks.value[0]!)).toEqual({ width: 10, depth: 1, height: 10 })
    scene.apply([id], { type: 'rotate' })
    expect(baseTenDimensions(scene.blocks.value[0]!)).toEqual({ width: 1, depth: 10, height: 10 })
    scene.apply([id], { type: 'clone' })
    expect(scene.blocks.value[1]).toMatchObject({ pose: 'tower', rotated: true })
    scene.apply([...scene.selection.value], { type: 'delete' })
    expect(scene.apply([id], { type: 'set-pose', pose: 'standard' }).allowed).toBe(true)
    expect(baseTenDimensions(scene.blocks.value[0]!)).toEqual({ width: 10, depth: 10, height: 1 })
  })
  it('rejects an overlapping flat pose and mixed selections atomically', () => {
    const { scene, add } = setup()
    const hundred = add('hundreds')
    scene.apply([hundred], { type: 'set-pose', pose: 'tower' })
    const one = add('ones')
    scene.apply([one], { type: 'move', delta: { x: -10, y: 1 } })
    const before = JSON.stringify(scene.blocks.value)
    expect(scene.apply([hundred], { type: 'set-pose', pose: 'standard' }).allowed).toBe(false)
    expect(scene.apply([hundred, one], { type: 'set-pose', pose: 'tower' }).allowed).toBe(false)
    expect(JSON.stringify(scene.blocks.value)).toBe(before)
  })
  it('catalog volumes match values, with floor rotation retaining height', () => {
    for (const block of Object.values(baseTenCatalog)) expect(block.dimensions.width * block.dimensions.depth * block.dimensions.height).toBe(block.value)
    expect(baseTenDimensions({ denomination: 'tenThousands', rotated: true, pose: 'tower' })).toEqual({ width: 10, depth: 10, height: 100 })
  })
  for (const [index, denomination] of playableDenominations.entries()) {
    if (!index) continue
    it(`exchanges ${denomination} down and back up preserving value`, () => {
      const { scene, add } = setup()
      const id = add(denomination)
      const value = scene.total.value
      expect(scene.apply([id], { type: 'exchange-down' }).allowed).toBe(true)
      expect(scene.blocks.value).toHaveLength(10)
      expect(scene.selection.value.size).toBe(10)
      expect(scene.blocks.value.every(block => block.denomination === playableDenominations[index - 1])).toBe(true)
      expect(scene.total.value).toBe(value)
      expect(scene.apply([...scene.selection.value], { type: 'exchange-up' }).allowed).toBe(true)
      expect(scene.blocks.value).toHaveLength(1)
      expect(scene.total.value).toBe(value)
      expect(scene.blocks.value[0]!.denomination).toBe(denomination)
    })
  }
  it('rejects exchanges atomically when decomposed blocks cannot fit', () => {
    const { scene, add } = setup(10, 10)
    const id = add('thousands')
    const before = JSON.stringify(scene.blocks.value)
    expect(scene.apply([id], { type: 'exchange-down' }).allowed).toBe(false)
    expect(JSON.stringify(scene.blocks.value)).toBe(before)
    expect([...scene.selection.value]).toEqual([id])
  })
  it('requires exactly ten equal blocks and rejects denomination endpoints', () => {
    const { scene, add } = setup()
    const one = add('ones')
    expect(scene.check([one], { type: 'exchange-down' }).allowed).toBe(false)
    const ids = [one, ...Array.from({ length: 8 }, () => add('ones'))]
    expect(scene.check(ids, { type: 'exchange-up' }).allowed).toBe(false)
    ids.push(add('tens'))
    expect(scene.check(ids, { type: 'exchange-up' }).allowed).toBe(false)
    const large = setup()
    const largeIds = Array.from({ length: 10 }, () => large.add('hundredThousands'))
    expect(large.scene.check(largeIds, { type: 'exchange-up' }).allowed).toBe(false)
  })
  it('rejects collisions, noninteger moves and out-of-bounds rotations without changing state', () => {
    const { scene, add } = setup(20, 2)
    const first = add('tens'), second = add('tens')
    const before = JSON.stringify(scene.blocks.value)
    expect(scene.apply([second], { type: 'move', delta: { x: -1, y: 0 } }).allowed).toBe(false)
    expect(scene.apply([first], { type: 'move', delta: { x: .5, y: 0 } }).allowed).toBe(false)
    expect(scene.apply([first], { type: 'rotate' }).allowed).toBe(false)
    expect(JSON.stringify(scene.blocks.value)).toBe(before)
  })
  it('checks without mutation, clones relative offsets, moves together, and clears deleted selection', () => {
    const { scene, add } = setup()
    const a = add('ones'), b = add('tens')
    scene.select([a, b])
    const before = JSON.stringify(scene.blocks.value)
    expect(scene.check([a, b], { type: 'clone' }).allowed).toBe(true)
    expect(JSON.stringify(scene.blocks.value)).toBe(before)
    scene.apply([a, b], { type: 'clone' })
    const copies = scene.blocks.value.filter(block => scene.selection.value.has(block.id))
    expect(copies[1]!.anchor.x - copies[0]!.anchor.x).toBe(1)
    expect(copies[1]!.anchor.y - copies[0]!.anchor.y).toBe(0)
    expect(scene.apply([...scene.selection.value], { type: 'move', delta: { x: 0, y: 10 } }).allowed).toBe(true)
    scene.apply([...scene.selection.value], { type: 'delete' })
    expect(scene.selection.value.size).toBe(0)
    expect(scene.blocks.value).toHaveLength(2)
  })
  it('constrains the entire selection to board bounds', () => {
    const { scene, add } = setup()
    const id = add('tenThousands')
    expect(scene.constrainMove([id], { x: 999, y: -10 })).toEqual({ x: 110, y: -0 })
  })
  it('rejects editing while inactive', () => {
    const scene = useBaseTenScene({ editable: () => false })
    expect(scene.apply([], { type: 'create', denomination: 'ones' }).allowed).toBe(false)
    expect(scene.blocks.value).toHaveLength(0)
  })
})
