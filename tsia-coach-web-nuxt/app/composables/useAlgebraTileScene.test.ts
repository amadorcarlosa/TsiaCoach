import { describe, expect, it } from 'vitest'
import { useAlgebraTileScene } from './useAlgebraTileScene'
import { algebraTileDimensions, type AlgebraTileSign, type AlgebraTileTerm } from '~/components/algebratiles/algebra-tile.types'

const setup = (columns = 120, rows = 120) => {
  const scene = useAlgebraTileScene({ editable: () => true, columns, rows })
  const create = (term: AlgebraTileTerm, sign: AlgebraTileSign = 'positive') => {
    expect(scene.apply([], { type: 'create', term, sign }).allowed).toBe(true)
    return scene.tiles.value.at(-1)!.id
  }
  return { scene, create }
}

describe('algebra tile scene', () => {
  it('combines symbolic terms without treating drawing lengths as values', () => {
    const { scene, create } = setup()
    create('x'); create('x'); create('x', 'negative')
    create('xy', 'negative'); create('ySquared'); create('one', 'negative')
    expect(scene.expression.value).toBe('−xy + y² + x − 1')
    expect(scene.coefficients.value).toEqual({ one: -1, x: 1, y: 0, xSquared: 0, ySquared: 1, xy: -1 })
  })

  it('removes matching zero pairs only from the selection, preserving the expression', () => {
    const { scene, create } = setup()
    const positive = create('x'), negative = create('x', 'negative'), extra = create('x')
    const y = create('y', 'negative')
    const before = scene.expression.value
    expect(scene.apply([positive, y], { type: 'remove-zero-pairs' }).allowed).toBe(false)
    expect(scene.tiles.value).toHaveLength(4)
    scene.select([positive, negative, y])
    expect(scene.apply([...scene.selection.value], { type: 'remove-zero-pairs' }).allowed).toBe(true)
    expect(scene.tiles.value.map(tile => tile.id)).toEqual([extra, y])
    expect([...scene.selection.value]).toEqual([y])
    expect(scene.expression.value).toBe(before)
  })

  it('changes signs without moving tiles and clones the signed term', () => {
    const { scene, create } = setup()
    const id = create('xy')
    const anchor = { ...scene.tiles.value[0]!.anchor }
    expect(scene.check([id], { type: 'flip-sign' }).allowed).toBe(true)
    expect(scene.expression.value).toBe('xy')
    scene.apply([id], { type: 'flip-sign' })
    expect(scene.expression.value).toBe('−xy')
    expect(scene.tiles.value[0]!.anchor).toEqual(anchor)
    scene.apply([id], { type: 'clone' })
    expect(scene.expression.value).toBe('−2xy')
    expect(new Set(scene.tiles.value.map(tile => tile.id)).size).toBe(2)
  })

  it('rotates symbolic rectangles, and rejects collisions and out-of-bounds changes atomically', () => {
    const { scene, create } = setup(8, 8)
    const id = create('x')
    scene.apply([id], { type: 'rotate' })
    expect(algebraTileDimensions(scene.tiles.value[0]!)).toEqual({ width: 1, depth: 6 })
    const other = create('one')
    const before = JSON.stringify(scene.tiles.value)
    expect(scene.apply([id], { type: 'move', delta: { x: 1, y: 0 } }).allowed).toBe(false)
    expect(scene.apply([id], { type: 'move', delta: { x: 0, y: 3 } }).allowed).toBe(false)
    expect(scene.apply([other], { type: 'move', delta: { x: .5, y: 0 } }).allowed).toBe(false)
    expect(JSON.stringify(scene.tiles.value)).toBe(before)
  })

  it('rejects editing while inactive and keeps checks free of mutation', () => {
    const scene = useAlgebraTileScene({ editable: () => false })
    expect(scene.apply([], { type: 'create', term: 'one', sign: 'positive' }).allowed).toBe(false)
    expect(scene.tiles.value).toEqual([])
    const { scene: active } = setup()
    expect(active.check([], { type: 'create', term: 'x', sign: 'negative' }).allowed).toBe(true)
    expect(active.tiles.value).toEqual([])
    expect(active.apply([], { type: 'create', term: 'x', sign: 'negative' }).allowed).toBe(true)
    expect(active.tiles.value[0]!.id).toBe('algebra-tile-1')
  })
})
