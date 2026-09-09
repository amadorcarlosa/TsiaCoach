import {
    arrayRodDimensions,
    type ArrayRod,
} from './array-rod.types'

export type ArrayBoardSpace = {
    columns: number
    rows: number
}

export function canPlaceArrayRod(
    candidate: Readonly<ArrayRod>,
    pieces: readonly Readonly<ArrayRod>[],
    space: ArrayBoardSpace,
): boolean {
    const a = arrayRodDimensions(
        candidate.value,
        candidate.orientation,
    )

    if (
        !Number.isInteger(candidate.x) ||
        !Number.isInteger(candidate.y) ||
        candidate.x < 0 ||
        candidate.y < 0 ||
        candidate.x + a.width > space.columns ||
        candidate.y + a.depth > space.rows
    ) {
        return false
    }

    return !pieces.some(other => {
        if (other.id === candidate.id) return false

        const b = arrayRodDimensions(other.value, other.orientation)

        return (
            candidate.x < other.x + b.width &&
            candidate.x + a.width > other.x &&
            candidate.y < other.y + b.depth &&
            candidate.y + a.depth > other.y
        )
    })
}