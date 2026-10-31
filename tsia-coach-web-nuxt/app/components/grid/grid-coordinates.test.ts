import { describe, expect, it } from 'vitest'
import { clientPointToGrid, gridPointToClient } from './grid-coordinates'

describe('projected grid coordinates', () => {
  it.each([0.25, 0.5, 1, 2])('round-trips scrolled and tilted coordinates at scale %s', zoom => {
    const frame = { origin: { x: -200, y: -100 }, axisX: { x: 36 * zoom, y: 0 }, axisY: { x: 0, y: 30 * zoom } }
    const point = { x: 75.5, y: 83.25 }
    expect(clientPointToGrid(gridPointToClient(point, frame), frame)).toEqual(point)
  })
  it('rejects a collapsed projection', () => {
    expect(clientPointToGrid({ x: 1, y: 1 }, { origin: { x: 0, y: 0 }, axisX: { x: 0, y: 0 }, axisY: { x: 0, y: 1 } })).toBeNull()
  })
})
