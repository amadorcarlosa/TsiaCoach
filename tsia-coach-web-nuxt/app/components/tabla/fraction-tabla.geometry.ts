import type {
    GridConfig,
    GridView,
} from '~/components/grid/surface/grid.types'
import type { FractionTarget } from './fraction-readout'

export function getFractionTablaGeometry(
    pairCount: number,
    cellSize = 36,
    columns = 24,
) {
    if (!Number.isInteger(pairCount) || pairCount < 1) {
        throw new RangeError('pairCount must be a positive integer')
    }

    if (!Number.isFinite(cellSize) || cellSize <= 0) {
        throw new RangeError('cellSize must be positive')
    }

    if (!Number.isInteger(columns) || columns < 1) {
        throw new RangeError('columns must be a positive integer')
    }

    // One reference row, then numerator + denominator + gap.
    // The final pair needs no trailing gap.
    const targets: FractionTarget[] = Array.from(
        { length: pairCount },
        (_, index) => ({
            id: `pair-${index}`,
            numeratorRow: 1 + index * 3,
            denominatorRow: 2 + index * 3,
        }),
    )

    const config: GridConfig = {
        columns,
        rows: pairCount * 3,
        cellSize,
    }

    const view: GridView = { tiltDegrees: 15 }

    const topInset =
        config.rows * cellSize *
        (1 - Math.cos(view.tiltDegrees * Math.PI / 180)) / 2

    return { config, view, topInset, targets }
}