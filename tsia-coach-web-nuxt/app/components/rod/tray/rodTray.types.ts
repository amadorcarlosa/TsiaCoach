import type {CuisenaireRodType} from "~/components/rod/rod.types.ts";
import type { RodSign } from '~/components/rod/scene/rod.scene.types'




export type RodTrayProps = {
    items: CuisenaireRodType[]
    unitSize: number
    embedded?: boolean
    layout?: 'vertical' | 'wrap'
    disabled?: boolean
    /** The sign new rods will have; the samples show it before anything is created. */
    sign?: RodSign
}
export const ariaTray="Rod choices";

export const ariaRod= (itemNumber:string, sign: RodSign = 1): string =>
    `Choose ${sign === -1 ? 'negative ' : ''}${itemNumber} rod`
