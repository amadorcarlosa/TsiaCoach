import { raisedPieceHeightLean } from '~/components/grid/raised-piece'
import type { UnitDimensions } from '#shared/types/rods'

// Visual projection only: the floor footprint and catalog dimensions are unchanged.
export const baseTenTiltDegrees = 15
export const baseTenHeightLean = raisedPieceHeightLean
export const baseTenProjectedHeight = Math.sin(baseTenTiltDegrees * Math.PI / 180)
  - baseTenHeightLean.y * Math.cos(baseTenTiltDegrees * Math.PI / 180)

export function isUprightHundred({ width, depth, height }: UnitDimensions): boolean {
  return height === 10 && width * depth === 10
}

export function baseTenProjectionExtent(size: UnitDimensions) {
  // Upright hundreds retain their square front; reserve the full rise for that pose.
  return {
    rise: isUprightHundred(size) ? size.height : size.height * baseTenProjectedHeight,
    side: isUprightHundred(size) ? 1 : size.height * Math.abs(baseTenHeightLean.x),
  }
}
