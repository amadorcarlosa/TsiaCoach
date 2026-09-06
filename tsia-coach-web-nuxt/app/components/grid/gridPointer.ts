export interface Point { x: number, y: number }

/** Invert the two projected one-cell axes. Works for rotated/scaled flat CSS boards. */
export function screenDeltaToGrid(delta: Point, axisX: Point, axisY: Point): Point | null {
  const determinant = axisX.x * axisY.y - axisX.y * axisY.x
  if (Math.abs(determinant) < 0.001) return null
  return {
    x: (delta.x * axisY.y - delta.y * axisY.x) / determinant,
    y: (axisX.x * delta.y - axisX.y * delta.x) / determinant,
  }
}
