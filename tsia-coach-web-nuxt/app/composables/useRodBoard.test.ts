import { describe, expect, it } from 'vitest'
import { useRodBoard } from './useRodBoard'

// A fresh composable instance per test: no shared rods, IDs, or selection.
function createBoard() {
  return useRodBoard({ columns: 24, rows: 11, spawnRows: [2, 5, 8] })
}

function snapshot(board: ReturnType<typeof createBoard>) {
  return board.placedRods.value.map(piece => ({ ...piece }))
}

describe('useRodBoard', () => {
  it('creates independent rods with unique IDs and consecutive free positions', () => {
    const board = createBoard()
    const first = board.addRod(8)
    const second = board.addRod(8)
    expect(first).not.toBeNull()
    expect(second).not.toBe(first)
    expect(snapshot(board)).toEqual([
      { id: first, value: 8, x: 0, y: 2 },
      { id: second, value: 8, x: 8, y: 2 },
    ])
  })

  it('keeps different board instances independent', () => {
    const first = createBoard()
    const second = createBoard()
    const id = first.addRod(6)!
    first.selectRod(id)
    expect(second.placedRods.value).toEqual([])
    expect(second.selectedRodId.value).toBeNull()
  })

  it.each([
    { position: { x: 3, y: 2 }, message: /occupied/i },
    { position: { x: 19, y: 2 }, message: /inside the board/i },
    { position: { x: 0, y: -1 }, message: /inside the board/i },
  ])('rejects $position without changing rods or selection', ({ position, message }) => {
    const board = createBoard()
    const id = board.addRod(6)!
    board.addRod(8)
    board.selectRod(id)
    const before = snapshot(board)
    expect(board.moveRod(id, position)).toBe(false)
    expect(snapshot(board)).toEqual(before)
    expect(board.selectedRodId.value).toBe(id)
    expect(board.placementMessage.value).toMatch(message)
  })

  it('moves only the requested rod and clears previous rejection feedback', () => {
    const board = createBoard()
    const id = board.addRod(6)!
    board.addRod(8)
    const other = { ...board.placedRods.value[1]! }
    board.moveRod(id, { x: -1, y: 2 })
    expect(board.moveRod(id, { x: 18, y: 10 })).toBe(true)
    expect(board.placedRods.value[0]).toMatchObject({ x: 18, y: 10 })
    expect(board.placedRods.value[1]).toEqual(other)
    expect(board.placementMessage.value).toBe('')
  })

  it('accepts a rod remaining in its own position', () => {
    const board = createBoard()
    const id = board.addRod(6)!
    expect(board.moveRod(id, { x: 0, y: 2 })).toBe(true)
  })

  it('reproduces the 17-rod board and refuses another rod without mutation', () => {
    const board = createBoard()
    for (let i = 0; i < 3; i++) expect(board.addRod(8)).not.toBeNull()
    for (let i = 0; i < 6; i++) expect(board.addRod(4)).not.toBeNull()
    for (let i = 0; i < 8; i++) expect(board.addRod(3)).not.toBeNull()
    const before = snapshot(board)
    expect(before).toHaveLength(17)
    expect(before.map(piece => [piece.x, piece.y])).toEqual([
      [0, 2], [8, 2], [16, 2],
      [0, 5], [4, 5], [8, 5], [12, 5], [16, 5], [20, 5],
      [0, 8], [3, 8], [6, 8], [9, 8], [12, 8], [15, 8], [18, 8], [21, 8],
    ])
    expect(board.addRod(3)).toBeNull()
    expect(snapshot(board)).toEqual(before)
    expect(board.placementMessage.value).toMatch(/no free target space/i)
  })

  it('reuses removed space with a new ID and clears selected removal', () => {
    const board = createBoard()
    const removed = board.addRod(8)!
    const survivor = board.addRod(8)!
    board.selectRod(removed)
    board.removeRod(removed)
    expect(board.selectedRodId.value).toBeNull()
    const replacement = board.addRod(8)
    expect(replacement).not.toBe(removed)
    expect(snapshot(board)).toEqual([
      { id: survivor, value: 8, x: 8, y: 2 },
      { id: replacement, value: 8, x: 0, y: 2 },
    ])
  })

  it('preserves selection when another rod is removed and supports clearing it', () => {
    const board = createBoard()
    const selected = board.addRod(6)!
    const other = board.addRod(6)!
    board.selectRod(selected)
    board.removeRod(other)
    expect(board.selectedRodId.value).toBe(selected)
    board.clearSelection()
    expect(board.selectedRodId.value).toBeNull()
  })

  it('ignores stale IDs without modifying the board or selection', () => {
    const board = createBoard()
    const id = board.addRod(6)!
    board.selectRod(id)
    const before = snapshot(board)
    board.selectRod('missing')
    board.removeRod('missing')
    expect(board.moveRod('missing', { x: 0, y: 5 })).toBe(false)
    expect(snapshot(board)).toEqual(before)
    expect(board.selectedRodId.value).toBe(id)
  })
})
