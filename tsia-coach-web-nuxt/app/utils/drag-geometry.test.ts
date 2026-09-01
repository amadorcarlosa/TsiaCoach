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
})
