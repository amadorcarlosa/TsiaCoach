import { describe, expect, it } from 'vitest'
import { closestZone, hitZone, snapPointForZone, type ZoneRect } from './drag-geometry'

const zones: ZoneRect[] = [
  { id: 'a', x: 0, y: 0, width: 100, height: 80 },
  { id: 'b', x: 220, y: 120, width: 120, height: 100 }
]

describe('drag geometry', () => {
  it('selects the closest zone by center distance', () => {
    expect(closestZone({ x: 235, y: 135 }, zones)).toEqual({
      id: 'b',
      distance: Math.hypot(45, 35)
    })
  })

  it('returns a point that centers a piece inside a zone', () => {
    expect(snapPointForZone(zones[1]!, { width: 40, height: 20 })).toEqual({ x: 260, y: 160 })
  })

  it('chooses the largest overlap that meets the ratio', () => {
    const piece = { x: 70, y: 10, width: 80, height: 60 }
    const overlappingZones: ZoneRect[] = [
      { id: 'small', x: 0, y: 0, width: 100, height: 80 },
      { id: 'large', x: 100, y: 0, width: 120, height: 80 }
    ]

    expect(hitZone(piece, overlappingZones, 0.5)).toBe('large')
  })

  it('uses input order to break equal-overlap ties', () => {
    const piece = { x: 75, y: 0, width: 50, height: 100 }
    const tieZones: ZoneRect[] = [
      { id: 'first', x: 0, y: 0, width: 100, height: 100 },
      { id: 'second', x: 100, y: 0, width: 100, height: 100 }
    ]

    expect(hitZone(piece, tieZones, 0.5)).toBe('first')
  })

  it('returns no hit when overlap is absent or below the threshold', () => {
    expect(hitZone({ x: 400, y: 400, width: 20, height: 20 }, zones, 0.5)).toBeNull()
    expect(hitZone({ x: 90, y: 10, width: 40, height: 60 }, zones, 0.5)).toBeNull()
  })

  it('cannot reach the threshold against a zone shorter than half the piece', () => {
    // Regression: the join scene registered the content-hugging `.joined-train`
    // as its drop zone. While empty the train measures ~20px tall against a
    // ~52px piece, so even a perfectly centred piece tops out below 0.5 and no
    // pointer drop could ever join the first part. Registering the Sum lane —
    // which holds a min-height taller than a piece — makes the first drop
    // reachable.
    const piece = { x: 0, y: 0, width: 206, height: 52 }
    const emptyTrain: ZoneRect = { id: 'train', x: 0, y: 16, width: 774, height: 20 }
    const sumLane: ZoneRect = { id: 'lane', x: 0, y: 0, width: 774, height: 83 }

    expect(hitZone(piece, [emptyTrain], 0.5)).toBeNull()
    expect(hitZone(piece, [sumLane], 0.5)).toBe('lane')
  })

  it('rejects a zone whose center is nearby but whose overlap is below the threshold', () => {
    // Piece sits just outside zone 'a' — close by center distance (a plausible
    // inertia-snap candidate), but it clears less than 50% overlap, so a snap
    // decision keyed off hitZone must refuse it rather than snap in and then
    // get rejected on release.
    const piece = { x: 95, y: 60, width: 50, height: 50 }
    expect(closestZone({ x: 120, y: 85 }, zones)).toEqual({
      id: 'a',
      distance: Math.hypot(70, 45)
    })
    expect(hitZone(piece, zones, 0.5)).toBeNull()
  })
})
