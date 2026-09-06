import { expect, it } from 'vitest'
import { screenDeltaToGrid } from './gridPointer'

it('recovers grid movement after rotation, tilt, and scaling', () => {
  const x = { x: 20, y: -6 }, y = { x: 9, y: 13 }
  const delta = { x: 3 * x.x - 2 * y.x, y: 3 * x.y - 2 * y.y }
  expect(screenDeltaToGrid(delta, x, y)).toEqual({ x: 3, y: -2 })
})

it('does not produce invalid coordinates for an edge-on board', () => {
  expect(screenDeltaToGrid({ x: 5, y: 5 }, { x: 20, y: 0 }, { x: 10, y: 0 })).toBeNull()
})
