import type { Point } from '~/components/grid/gridPointer'
import type { CuisenaireRodValue } from './rod.types'

export type PlacedRod = Point & {
    readonly id: string
    value: CuisenaireRodValue
}