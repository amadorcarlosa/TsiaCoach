import type {
  GridConfig,
  GridView,
} from '~/components/grid/surface/grid.types'

export function getTablaGeometry(targetCount: number) {
  if (!Number.isInteger(targetCount) || targetCount < 1) {
    throw new RangeError('targetCount must be a positive integer')
  }

  const referenceHeight = 2
  const targetHeight = 1
  const stride = referenceHeight + targetHeight

  const config: GridConfig = {
    columns: 24,
    rows: targetCount * stride + referenceHeight,
    cellSize: 36,
  }

  const view: GridView = {
    tiltDegrees: 15,
  }

  const topInset =
      config.rows * config.cellSize *
      (1 - Math.cos(view.tiltDegrees * Math.PI / 180)) / 2

  const targets = Array.from(
      { length: targetCount },
      (_, index) => ({
        id: `target-${index}`,
        row: referenceHeight + index * stride,
      }),
      
  )
  const tiltRadians = Math.abs(view.tiltDegrees) * Math.PI / 180
  const rodHeight = config.cellSize // Current rods are one unit high.
  const labelGap = 6 // Intentional visual gap, in screen pixels.

// CSS bottom is measured before the board's rotation.
  const unitLabelBottom =
      (rodHeight * Math.sin(tiltRadians) + labelGap) /
      Math.cos(tiltRadians)

  return {
    config,
    view,
    topInset,
    targets,
    referenceHeight,
    targetHeight,
    unitLabelBottom
  }
}
