import type { UnitDimensions } from '#shared/types/rods'
import type { Point } from '~/components/grid/gridPointer'
import type {CuisenaireRodValue} from "~/components/rod/rod.types.ts";


export type ArrayRodOrientation =
    | 'horizontal'
    | 'vertical'
    | 'tower'

export type ArrayRod = Point & {
    readonly id: string
    value: CuisenaireRodValue
    orientation: ArrayRodOrientation
}

export const arrayRodOrientations: ArrayRodOrientation[] = [
    'horizontal',
    'vertical',
    'tower',
]

export function arrayRodDimensions(
    value: CuisenaireRodValue,
    orientation: ArrayRodOrientation,
): UnitDimensions {
    switch (orientation) {
        case 'horizontal':
            return { width: value, depth: 1, height: 1 }
        case 'vertical':
            return { width: 1, depth: value, height: 1 }
        case 'tower':
            return { width: 1, depth: 1, height: value }
    }
}