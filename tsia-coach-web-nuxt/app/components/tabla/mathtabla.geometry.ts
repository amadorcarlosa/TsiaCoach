import type { SceneRegion } from '~/components/rod/scene/rod.scene.types'

export function getMathTablaGeometry(columns = 24, rows = 12, cellSize = 36) {
  if (
    !Number.isInteger(columns) || columns < 1 ||
    !Number.isInteger(rows) || rows < 1 ||
    !Number.isFinite(cellSize) || cellSize <= 0
  ) {
    throw new RangeError('Invalid MathTabla dimensions.')
  }

  const regions = [
    { id: 'horizontal-d', x: 2, y: 0, width: columns, depth: 1, orientations: ['horizontal'] },
    { id: 'horizontal-n', x: 2, y: 1, width: columns, depth: 1, orientations: ['horizontal'] },
    { id: 'vertical-d', x: 0, y: 2, width: 1, depth: rows, orientations: ['vertical'] },
    { id: 'vertical-n', x: 1, y: 2, width: 1, depth: rows, orientations: ['vertical'] },
    { id: 'array', x: 2, y: 2, width: columns, depth: rows, orientations: ['horizontal', 'vertical'] },
  ] as const satisfies readonly SceneRegion[]

  return {
    config: { columns: columns + 2, rows: rows + 2, cellSize },
    view: { tiltDegrees: 15 },
    regions,
    array: regions[4],
  }
}
