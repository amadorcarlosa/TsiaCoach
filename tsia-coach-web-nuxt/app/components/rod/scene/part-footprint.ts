import type { Point } from '~/components/grid/gridPointer'
import type { Rectangle, TrainPart } from './rod.scene.types'

type Part = { value: number; offset: Point; orientation: TrainPart['orientation'] }
type Placed = { anchor: Point; parts: readonly Part[] }

/**
 * The board cells one part covers. A horizontal part runs along x, a
 * vertical part along y, and a tower stands on a single cell.
 * Pass no anchor for the part's position within its train.
 */
export function partFootprint(part: Part, anchor: Point = { x: 0, y: 0 }): Rectangle {
    return {
        x: anchor.x + part.offset.x,
        y: anchor.y + part.offset.y,
        width: part.orientation === 'horizontal' ? part.value : 1,
        depth: part.orientation === 'vertical' ? part.value : 1,
    }
}

/** Each part's footprint on the board. */
export function trainFootprints(train: Placed): Rectangle[] {
    return train.parts.map(part => partFootprint(part, train.anchor))
}

/** One box around every cell a train covers, starting at its anchor. */
export function trainBounds(train: Placed): Rectangle {
    let width = 0
    let depth = 0
    for (const part of train.parts) {
        const size = partFootprint(part)
        width = Math.max(width, size.x + size.width)
        depth = Math.max(depth, size.y + size.depth)
    }
    return { ...train.anchor, width, depth }
}

export function contains(outer: Rectangle, inner: Rectangle): boolean {
    return (
        inner.x >= outer.x &&
        inner.y >= outer.y &&
        inner.x + inner.width <= outer.x + outer.width &&
        inner.y + inner.depth <= outer.y + outer.depth
    )
}
