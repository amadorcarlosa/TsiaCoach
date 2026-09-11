import type { DeepReadonly } from 'vue'
import type { RodTrain } from '~/components/rod/scene/rod.scene.types'

export type FractionTarget = {
    id: string
    numeratorRow: number
    denominatorRow: number
}

export type FractionReadout = {
    pairId: string
    numerator: number
    denominator: number
    complete: boolean
}

export function fractionReadout(
    trains: readonly DeepReadonly<RodTrain>[],
    targets: readonly FractionTarget[],
): FractionReadout[] {
    const trackRows = new Set(
        targets.flatMap(target => [
            target.numeratorRow,
            target.denominatorRow,
        ]),
    )

    const totals = new Map<number, number>()

    for (const train of trains) {
        const row = train.anchor.y
        if (!trackRows.has(row)) continue

        const value = train.parts.reduce(
            (sum, part) => sum + part.value,
            0,
        )

        totals.set(row, (totals.get(row) ?? 0) + value)
    }

    return targets.map(target => {
        const numerator = totals.get(target.numeratorRow) ?? 0
        const denominator = totals.get(target.denominatorRow) ?? 0

        return {
            pairId: target.id,
            numerator,
            denominator,
            complete: denominator > 0,
        }
    })
}