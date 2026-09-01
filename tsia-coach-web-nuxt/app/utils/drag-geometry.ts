export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface ZoneRect extends Rect {
  id: string
}

export interface Point {
  x: number
  y: number
}

function centerOf(rect: Rect): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  }
}

/** Return the zone whose center is closest to the supplied point. */
export function closestZone(point: Point, zones: ZoneRect[]): { id: string, distance: number } | null {
  let closest: { id: string, distance: number } | null = null

  for (const zone of zones) {
    const center = centerOf(zone)
    const distance = Math.hypot(center.x - point.x, center.y - point.y)

    if (!closest || distance < closest.distance) {
      closest = { id: zone.id, distance }
    }
  }

  return closest
}

/** Return the top-left point that centers a piece inside a zone. */
export function snapPointForZone(zone: ZoneRect, piece: Pick<Rect, 'width' | 'height'>): Point {
  return {
    x: zone.x + (zone.width - piece.width) / 2,
    y: zone.y + (zone.height - piece.height) / 2
  }
}

function intersectionArea(a: Rect, b: Rect): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return width * height
}

/**
 * Return the largest-overlap zone when enough of the piece is inside it.
 * Input order is the deterministic tie-breaker when overlap areas match.
 */
export function hitZone(pieceRect: Rect, zones: ZoneRect[], minOverlapRatio: number): string | null {
  const pieceArea = pieceRect.width * pieceRect.height

  if (pieceArea <= 0 || zones.length === 0) {
    return null
  }

  let bestId: string | null = null
  let bestArea = 0

  for (const zone of zones) {
    const area = intersectionArea(pieceRect, zone)
    const ratio = area / pieceArea

    if (area > 0 && ratio >= minOverlapRatio && area > bestArea) {
      bestArea = area
      bestId = zone.id
    }
  }

  return bestId
}
