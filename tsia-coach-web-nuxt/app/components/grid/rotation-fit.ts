import type { Point } from './gridPointer'

export type Box = { x: number; y: number; width: number; depth: number }

/**
 * The smallest shift that brings a turned piece back inside its bounds.
 * Null when the piece is larger than the bounds in either direction.
 * Obstacles are not avoided: a blocked destination is refused, not moved.
 */
export function edgeShift(piece: Box, bounds: Box): Point | null {
    if (piece.width > bounds.width || piece.depth > bounds.depth) return null

    const axis = (start: number, size: number, min: number, limit: number) =>
        start < min ? min - start
            : start + size > min + limit ? min + limit - (start + size)
                : 0

    return {
        x: axis(piece.x, piece.width, bounds.x, bounds.width),
        y: axis(piece.y, piece.depth, bounds.y, bounds.depth),
    }
}

/** One piece already turned about its anchor, with its candidate shifts. */
export type TurnedPiece = { id: string; edge: Point; back: Point | null }

/**
 * Picks where the turned pieces land. Turning straight back first tries to
 * undo the last slide, so a round trip ends where it began; otherwise each
 * piece takes its edge shift. `attempt` validates one set of shifts.
 */
export function settleTurn<R extends { allowed: boolean }>(
    turned: readonly TurnedPiece[],
    attempt: (shifts: ReadonlyMap<string, Point>) => R,
): { result: R; shifts: Map<string, Point> } {
    if (turned.some(turn => turn.back)) {
        const shifts = new Map(turned.map(turn => [turn.id, turn.back ?? turn.edge]))
        const result = attempt(shifts)
        if (result.allowed) return { result, shifts }
    }
    const shifts = new Map(turned.map(turn => [turn.id, turn.edge]))
    return { result: attempt(shifts), shifts }
}

export const shifted = (anchor: Point, shift: Point | undefined): Point =>
    shift ? { x: anchor.x + shift.x, y: anchor.y + shift.y } : anchor

type Turn = { state: string; inverse: string; shift: Point }

/**
 * Remembers the edge shift of each piece's last turn, so turning it straight
 * back returns it to where it started instead of leaving it shifted.
 * A memory only applies while the piece is exactly as that turn left it.
 */
export function createTurnMemory() {
    const turns = new Map<string, Turn>()

    return {
        /** The shift that undoes the last turn, if `request` reverses it. */
        returnShift(id: string, state: string, request: string): Point | null {
            const turn = turns.get(id)
            if (!turn || turn.state !== state || turn.inverse !== request) return null
            // `|| 0` keeps -0 out of anchors.
            return { x: -turn.shift.x || 0, y: -turn.shift.y || 0 }
        },
        remember(id: string, turn: Turn): void {
            turns.set(id, turn)
        },
        /** Drop memories for pieces that no longer exist. */
        keep(ids: Iterable<string>): void {
            const live = new Set(ids)
            for (const id of turns.keys()) if (!live.has(id)) turns.delete(id)
        },
    }
}
