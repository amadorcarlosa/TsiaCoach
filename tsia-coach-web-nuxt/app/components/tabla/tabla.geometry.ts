import type {
  GridConfig,
  GridView,
} from '~/components/grid/surface/grid.types'

export function getTablaGeometry(targetCount: number) {
  if (!Number.isInteger(targetCount) || targetCount < 1) {
    throw new RangeError('targetCount must be a positive integer')
  }

  const config: GridConfig = {
    columns: 24,
    rows: targetCount * 2 + 1,
    cellSize: 36,
  }

  const view: GridView = {
    tiltDegrees: 35,
  }

  const topInset =
      config.rows * config.cellSize *
      (1 - Math.cos(view.tiltDegrees * Math.PI / 180)) / 2

  const targets = Array.from(
      { length: targetCount },
      (_, index) => ({
        id: `target-${index}`,
        row: index * 2 + 1,
      }),
  )

  return { config, view, topInset, targets }
}
