import { CuisenaireRodValues } from '../rod.types'
import type { FactorShape, TrainPart } from './rod.scene.types'

export function factorShapes(total: number, includeLinear = false): FactorShape[] {
  if (!Number.isSafeInteger(total) || total < (includeLinear ? 1 : 4)) return []

  const shapes: FactorShape[] = []

  if (includeLinear) {
    for (let divisor = 1; divisor * divisor <= total; divisor++) {
      if (total % divisor !== 0) continue
      shapes.push({ rows: divisor, columns: total / divisor })
      if (divisor * divisor !== total) shapes.push({ rows: total / divisor, columns: divisor })
    }
  } else {
    for (const columns of Object.values(CuisenaireRodValues)) {
      if (columns < 2 || total % columns !== 0) continue
      const rows = total / columns
      if (rows >= 2) shapes.push({ rows, columns })
    }
  }

  return shapes.sort((a, b) =>
    Math.abs(a.rows - a.columns) -
      Math.abs(b.rows - b.columns) ||
    a.rows - b.rows,
  )
}

/** Wide rows are trains of catalog rods, never unsupported rod lengths. */
export function factorParts(shape: FactorShape): TrainPart[] {
  const parts: TrainPart[] = []
  const values = Object.values(CuisenaireRodValues).sort((a, b) => b - a)
  for (let row = 0; row < shape.rows; row++) {
    let remaining = shape.columns
    let x = 0
    for (const value of values) {
      while (remaining >= value) {
        parts.push({ value, orientation: 'horizontal', offset: { x, y: row } })
        remaining -= value
        x += value
      }
    }
  }
  return parts
}
