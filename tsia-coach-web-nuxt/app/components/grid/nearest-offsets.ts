import type { Point } from './gridPointer'

export type OffsetRange = { minX: number; maxX: number; minY: number; maxY: number }

/**
 * Every nonzero offset in the range, nearest first by grid steps (|x| + |y|).
 * Ties prefer the larger x, then the larger y. Offsets are generated lazily,
 * so a search that stops at the first fit never builds the whole board.
 */
export function* offsetsByDistance(range: OffsetRange): Generator<Point> {
    const { minX, maxX, minY, maxY } = range
    if (minX > maxX || minY > maxY) return

    const reach = Math.max(-minX, maxX, 0) + Math.max(-minY, maxY, 0)

    for (let distance = 1; distance <= reach; distance++) {
        for (let x = Math.min(distance, maxX); x >= Math.max(-distance, minX); x--) {
            const rest = distance - Math.abs(x)
            for (const y of rest === 0 ? [0] : [rest, -rest]) {
                if (y >= minY && y <= maxY) yield { x, y }
            }
        }
    }
}

/** Offsets that keep every box inside a `columns` × `rows` board. */
export function onBoardRange(
    boxes: readonly { x: number; y: number; width: number; depth: number }[],
    columns: number,
    rows: number,
): OffsetRange {
    return {
        minX: -Math.min(...boxes.map(box => box.x)),
        maxX: columns - Math.max(...boxes.map(box => box.x + box.width)),
        minY: -Math.min(...boxes.map(box => box.y)),
        maxY: rows - Math.max(...boxes.map(box => box.y + box.depth)),
    }
}
