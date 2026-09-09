import type { Point } from '~/components/grid/gridPointer'

import type { PlacedRod } from './rod-board.types'
import type {CuisenaireRodValue} from "~/components/rod/rod.types.ts";

export type RodBoardSpace = {
    columns: number
    rows: number
    spawnRows: readonly number[]
}

type PlacementFailure = 'outside-board' | 'occupied'

export function placementFailure(
    value: CuisenaireRodValue,
    position: Point,
    space: RodBoardSpace,
    pieces: readonly Readonly<PlacedRod>[],
    movingId?: string,
): PlacementFailure | null {
    const { x, y } = position

    // Rods occupy integer grid positions and are one cell deep.
    if (
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        x < 0 ||
        y < 0 ||
        x + value > space.columns ||
        y + 1 > space.rows
    ) {
        return 'outside-board'
    }

    const occupied = pieces.some(other => {
        if (other.id === movingId) return false

        return (
            x < other.x + other.value &&
            x + value > other.x &&
            y < other.y + 1 &&
            y + 1 > other.y
        )
    })

    return occupied ? 'occupied' : null
}

export function findFreeRodPosition(
    value: CuisenaireRodValue,
    space: RodBoardSpace,
    pieces: readonly Readonly<PlacedRod>[],
): Point | null {
    for (const y of space.spawnRows) {
        for (let x = 0; x <= space.columns - value; x++) {
            const position = { x, y }

            if (!placementFailure(value, position, space, pieces)) {
                return position
            }
        }
    }

    return null
}