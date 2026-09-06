import type { UnitDimensions } from './rodCatalog'
export type RodPlacement = { length: number, x: number, y: number, vertical: boolean, tower?: boolean, dimensions?: UnitDimensions }

export function footprint(rod: RodPlacement) {
  if (rod.dimensions) return { x: rod.x, y: rod.y, width: rod.dimensions.width, height: rod.dimensions.depth }
  if (rod.tower) return { x: rod.x, y: rod.y, width: 1, height: 1 }
  return { x: rod.x, y: rod.y, width: rod.vertical ? 1 : rod.length, height: rod.vertical ? rod.length : 1 }
}

export function canPlaceRod(candidate: RodPlacement, others: RodPlacement[], cols: number, rows: number) {
  const a = footprint(candidate)
  if (a.x < 0 || a.y < 0 || a.x + a.width > cols || a.y + a.height > rows) return false
  return !others.some(rod => {
    const b = footprint(rod)
    return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  })
}
