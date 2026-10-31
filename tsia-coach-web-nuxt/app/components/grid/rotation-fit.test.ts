import { describe, expect, it } from 'vitest'
import { createTurnMemory, edgeShift, settleTurn } from './rotation-fit'

const board = { x: 0, y: 0, width: 10, depth: 8 }

describe('edgeShift', () => {
  it('leaves a piece that already fits where it is', () => {
    expect(edgeShift({ x: 2, y: 2, width: 3, depth: 1 }, board)).toEqual({ x: 0, y: 0 })
  })

  it('slides a piece back across the far and near edges', () => {
    expect(edgeShift({ x: 8, y: 6, width: 4, depth: 5 }, board)).toEqual({ x: -2, y: -3 })
    expect(edgeShift({ x: -1, y: -2, width: 1, depth: 1 }, board)).toEqual({ x: 1, y: 2 })
  })

  it('respects offset bounds such as a region', () => {
    expect(edgeShift({ x: 4, y: 9, width: 1, depth: 3 }, { x: 2, y: 2, width: 6, depth: 9 }))
      .toEqual({ x: 0, y: -1 })
  })

  it('refuses a piece larger than its bounds', () => {
    expect(edgeShift({ x: 0, y: 0, width: 1, depth: 9 }, board)).toBeNull()
  })
})

describe('settleTurn and turn memory', () => {
  it('prefers undoing the last slide, then falls back to the edge shift', () => {
    const turned = [{ id: 'a', edge: { x: 0, y: 0 }, back: { x: 0, y: 4 } }]
    expect(settleTurn(turned, () => ({ allowed: true })).shifts.get('a')).toEqual({ x: 0, y: 4 })
    const blocked = settleTurn(turned, shifts => ({ allowed: shifts.get('a')!.y === 0 }))
    expect(blocked.shifts.get('a')).toEqual({ x: 0, y: 0 })
  })

  it('only undoes a turn that is reversed exactly and untouched since', () => {
    const memory = createTurnMemory()
    memory.remember('a', { state: 'after', inverse: 'horizontal', shift: { x: 0, y: -4 } })
    expect(memory.returnShift('a', 'after', 'horizontal')).toEqual({ x: 0, y: 4 })
    expect(memory.returnShift('a', 'moved', 'horizontal')).toBeNull()
    expect(memory.returnShift('a', 'after', 'tower')).toBeNull()
    memory.keep([])
    expect(memory.returnShift('a', 'after', 'horizontal')).toBeNull()
  })
})
