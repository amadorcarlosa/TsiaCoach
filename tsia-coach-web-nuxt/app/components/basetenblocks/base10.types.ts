import type {UnitDimensions} from "#shared/types/rods.ts";
import type {RodAppearance} from "~/components/rod/rod.types.ts";

export type BaseTenBlockAppearance = {
    name: string
    fill: string
    ink: string
}
export type BaseTenProps={
    dimensions: UnitDimensions
    unitSize: number
    appearance: RodAppearance
    label: string
}
export const BaseTenNumbers = {
    One: 'one',
    Ten: 'ten',
    hundred: 'hundred',
    thousand: 'thousand',
    tenThousand: 'tenThousand',
    hundredThousand: 'hundredThousand',
    million:'million',
    
    
}as const

export type BaseTenNumber = typeof BaseTenNumbers[keyof typeof BaseTenNumbers]

export const BaseTenValues = {
    One: 1,
    Ten: 10,
    hundred: 100,
    thousand: 1_000,
    tenThousand: 10_000,
    hundredThousand: 100_000,
    million: 1_000_000
    
}

export type BaseTenValue = typeof BaseTenValues[keyof typeof BaseTenValues]
export const baseBlocksPalette:BaseTenBlockAppearance[]=[
    { name: 'DarkOrange', fill: '#d97e24', ink: '#1f1200' },
    { name: 'LightOrange', fill: '#ecbe91', ink: '#1f1200' },
]