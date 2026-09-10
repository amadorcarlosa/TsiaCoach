import { CuisenaireRodValues } from '../rod.types'
import type { FactorShape } from './rod.scene.types'

export function factorShapes(total: number): FactorShape[] {
  if (!Number.isSafeInteger(total) || total < 4) return []

  const shapes: FactorShape[] = []

  for (const columns of Object.values(CuisenaireRodValues)) {
    if (columns < 2 || total % columns !== 0) continue

    const rows = total / columns
    if (rows < 2) continue

    shapes.push({ rows, columns })
  }

  return shapes.sort((a, b) =>
    Math.abs(a.rows - a.columns) -
      Math.abs(b.rows - b.columns) ||
    a.rows - b.rows,
  )
}
