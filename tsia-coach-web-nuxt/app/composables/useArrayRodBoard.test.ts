import { describe, expect, it } from 'vitest'
import { useArrayRodBoard } from './useArrayRodBoard'
import { arrayRodDimensions } from '~/components/rod/array/array-rod.types'

const createBoard = () => useArrayRodBoard({ columns: 24, rows: 12 })

describe('array rod editing', () => {
  it.each([
    ['horizontal', { width: 6, depth: 1, height: 1 }],
    ['vertical', { width: 1, depth: 6, height: 1 }],
    ['tower', { width: 1, depth: 1, height: 6 }],
  ] as const)('derives %s dimensions from one orientation', (pose, expected) => {
    expect(arrayRodDimensions(6, pose)).toEqual(expected)
  })

  it('orients only the selected instance without changing its anchor', () => {
    const board = createBoard()
    const first = board.addRod(6)!
    const second = board.addRod(6)!
    board.selectRod(first)
    expect(board.orientRod(first, 'vertical')).toBe(true)
    expect(board.pieces.value).toEqual([
      { id: first, value: 6, x: 0, y: 0, orientation: 'vertical' },
      { id: second, value: 6, x: 6, y: 0, orientation: 'horizontal' },
    ])
    expect(board.selectedRodId.value).toBe(first)
  })

  it('rejects orientation through another rod without mutating either piece', () => {
    const board = createBoard()
    const first = board.addRod(6)!
    const second = board.addRod(6)!
    board.moveRod(first, { x: 0, y: 1 })
    board.moveRod(second, { x: 0, y: 0 })
    const before = board.pieces.value.map(piece => ({ ...piece }))
    expect(board.orientRod(second, 'vertical')).toBe(false)
    expect(board.pieces.value).toEqual(before)
    expect(board.message.value).toMatch(/overlap/)
  })

  it('rejects vertical extent outside the board, but accepts a tower there', () => {
    const board = createBoard()
    const id = board.addRod(6)!
    expect(board.moveRod(id, { x: 18, y: 11 })).toBe(true)
    expect(board.orientRod(id, 'vertical')).toBe(false)
    expect(board.orientRod(id, 'tower')).toBe(true)
    expect(board.moveRod(id, { x: 23, y: 11 })).toBe(true)
    expect(board.orientRod(id, 'horizontal')).toBe(false)
    expect(board.pieces.value[0]).toMatchObject({ x: 23, y: 11, orientation: 'tower' })
  })

  it('uses a vertical footprint for movement collision and accepts touching edges', () => {
    const board = createBoard()
    const vertical = board.addRod(6)!
    const horizontal = board.addRod(6)!
    board.orientRod(vertical, 'vertical')
    expect(board.moveRod(horizontal, { x: 0, y: 5 })).toBe(false)
    expect(board.moveRod(horizontal, { x: 1, y: 5 })).toBe(true)
    expect(board.moveRod(horizontal, { x: 0, y: 6 })).toBe(true)
  })

  it('removes a selected instance and reuses the freed space with a fresh ID', () => {
    const board = createBoard()
    const id = board.addRod(6)!
    board.removeRod(id)
    expect(board.selectedRodId.value).toBeNull()
    const replacement = board.addRod(6)!
    expect(replacement).not.toBe(id)
    expect(board.pieces.value[0]).toMatchObject({ x: 0, y: 0 })
  })
})
