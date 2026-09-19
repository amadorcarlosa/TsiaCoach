// Shared projection of height above the board; logical footprints stay unchanged.
export const raisedPieceHeightLean = { x: 0.1, y: -0.1 } as const
export const raisedPieceStyle = {
  '--raised-piece-x': raisedPieceHeightLean.x,
  '--raised-piece-y': raisedPieceHeightLean.y,
}
