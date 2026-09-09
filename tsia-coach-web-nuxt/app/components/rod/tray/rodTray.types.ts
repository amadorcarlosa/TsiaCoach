import type {CuisenaireRodType} from "~/components/rod/rod.types.ts";




export type RodTrayProps = {
    items: CuisenaireRodType[]
    unitSize: number
    embedded?: boolean
    layout?: 'vertical' | 'wrap'
    disabled?: boolean
}
export const ariaTray="Rod choices";

export const ariaRod= (itemNumber:string ): string =>`Choose ${itemNumber} rod`
