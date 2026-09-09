import type { Point } from '~/components/grid/gridPointer'
import type {CuisenaireRodValue} from "~/components/rod/rod.types.ts";


export type PlacedRod = Point & {
    readonly id: string
    value: CuisenaireRodValue
}