import type {UnitDimensions} from "#shared/types/rods.ts";

export type BaseTenBlockAppearance = {
    name: string
    fill: string
    ink: string
}
export type BaseTenProps={
    dimensions: UnitDimensions
    unitSize: number
    appearance: BaseTenBlockAppearance
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
} as const

export type BaseTenValue = typeof BaseTenValues[keyof typeof BaseTenValues]
export const baseBlocksPalette:BaseTenBlockAppearance[]=[
    { name: 'DarkOrange', fill: '#d97e24', ink: '#1f1200' },
    { name: 'LightOrange', fill: '#ecbe91', ink: '#1f1200' },
]

export const baseTenCatalog = {
    ones: { number: BaseTenNumbers.One, value: BaseTenValues.One, shape: 'cube', dimensions: { width: 1, depth: 1, height: 1 }, appearance: baseBlocksPalette[0]! },
    tens: { number: BaseTenNumbers.Ten, value: BaseTenValues.Ten, shape: 'long', dimensions: { width: 10, depth: 1, height: 1 }, appearance: baseBlocksPalette[0]! },
    hundreds: { number: BaseTenNumbers.hundred, value: BaseTenValues.hundred, shape: 'flat', dimensions: { width: 10, depth: 10, height: 1 }, appearance: baseBlocksPalette[0]! },
    thousands: { number: BaseTenNumbers.thousand, value: BaseTenValues.thousand, shape: 'cube', dimensions: { width: 10, depth: 10, height: 10 }, appearance: baseBlocksPalette[1]! },
    tenThousands: { number: BaseTenNumbers.tenThousand, value: BaseTenValues.tenThousand, shape: 'long', dimensions: { width: 100, depth: 10, height: 10 }, appearance: baseBlocksPalette[1]! },
    hundredThousands: { number: BaseTenNumbers.hundredThousand, value: BaseTenValues.hundredThousand, shape: 'flat', dimensions: { width: 100, depth: 100, height: 10 }, appearance: baseBlocksPalette[1]! },
    millions: { number: BaseTenNumbers.million, value: BaseTenValues.million, shape: 'cube', dimensions: { width: 100, depth: 100, height: 100 }, appearance: baseBlocksPalette[1]! },
} as const

export type BaseTenDenomination = keyof typeof baseTenCatalog
export const playableDenominations = ['ones', 'tens', 'hundreds', 'thousands', 'tenThousands', 'hundredThousands'] as const
export type PlayableDenomination = typeof playableDenominations[number]
export type BaseTenPose = 'standard' | 'tower'
export function defaultBaseTenPose(denomination: PlayableDenomination): BaseTenPose {
    return denomination === 'tenThousands' || denomination === 'hundredThousands' ? 'tower' : 'standard'
}
export function supportedBaseTenPoses(denomination: PlayableDenomination): readonly BaseTenPose[] {
    return denomination === 'hundreds' ? ['standard', 'tower'] : [defaultBaseTenPose(denomination)]
}
export type BaseTenBlock = { id: string; denomination: PlayableDenomination; anchor: { x: number; y: number }; rotated: boolean; pose: BaseTenPose }
export function baseTenDimensions(block: Pick<BaseTenBlock, 'denomination' | 'rotated' | 'pose'>): UnitDimensions {
    const canonical = baseTenCatalog[block.denomination].dimensions
    const dimensions = block.pose === 'tower'
        ? block.denomination === 'tenThousands'
            ? { width: canonical.depth, depth: canonical.height, height: canonical.width }
            : { width: canonical.width, depth: canonical.height, height: canonical.depth }
        : canonical
    return block.rotated
        ? { width: dimensions.depth, depth: dimensions.width, height: dimensions.height }
        : { ...dimensions }
}
