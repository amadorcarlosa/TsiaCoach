import type {UnitDimensions} from "#shared/types/rods.ts";





export type RodAppearance = {
    fill: string
    ink: string
}

export type RodProps = {
    dimensions: UnitDimensions
    unitSize: number
    appearance: RodAppearance
    label: string
}

export type DragProps = {
    id: string
    value: CuisenaireRodValue
    x: number
    y: number
    cellSize: number
    snapToGrid?: boolean
    disabled?: boolean
    selected?: boolean
    dimensions?: UnitDimensions
    beginMove?: () => boolean
    previewDelta?: Point
}


export const CuisenaireRodNumbers = {
    One: 'one',
    Two: 'two',
    Three: 'three',
    Four: 'four',
    Five: 'five',
    Six: 'six',
    Seven: 'seven',
    Eight: 'eight',
    Nine: 'nine',
    Ten: 'ten',
} as const;

export type CuisenaireRodNumber = typeof CuisenaireRodNumbers[keyof typeof CuisenaireRodNumbers];

export const CuisenaireRodValues = {
    One: 1,
    Two: 2,
    Three: 3,
    Four: 4,
    Five: 5,
    Six: 6,
    Seven: 7,
    Eight: 8,
    Nine: 9,
    Ten: 10,
} as const;

export type CuisenaireRodValue = typeof CuisenaireRodValues[keyof typeof CuisenaireRodValues];

export const CuisenaireRodColors = {
    white: 'white' as const,
    red: 'red' as const,
    lightGreen: 'lightGreen' as const,
    purple: 'purple' as const,
    yellow: 'yellow' as const,
    darkGreen: 'darkGreen' as const,
    black: 'black' as const,
    brown: 'brown' as const,
    blue: 'blue' as const,
    orange: 'orange' as const,
} as const;

export type CuisenaireRodColor = typeof CuisenaireRodColors[keyof typeof CuisenaireRodColors];

// Map number names to their numeric values
export const RodNumberToValue = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
} as const;

// Map numeric values to colors
export const RodValueToColor = {
    1: 'white',
    2: 'red',
    3: 'lightGreen',
    4: 'purple',
    5: 'yellow',
    6: 'darkGreen',
    7: 'black',
    8: 'brown',
    9: 'blue',
    10: 'orange',
} as const satisfies Record<string, CuisenaireRodColor>;

export type CuisenaireRodType = {
    number: CuisenaireRodNumber;
    value: CuisenaireRodValue;
    color: CuisenaireRodColor;
};

// Helper to get a rod's full definition
export const getRodDefinition = (value: CuisenaireRodValue): CuisenaireRodType => {
    const numberKey = Object.entries(CuisenaireRodValues).find(([, v]) => v === value)?.[0];
    const number = CuisenaireRodNumbers[numberKey as keyof typeof CuisenaireRodNumbers];
    const color = RodValueToColor[value as keyof typeof RodValueToColor];

    return { number, value, color };
};



export function rodStyle(size: UnitDimensions, cellSize: number) {
    return { '--w': `${size.width * cellSize}px`, '--d': `${size.depth * cellSize}px`, '--h': `${size.height * cellSize}px` }
}
export const cusisenaireRodPalette = {
    1: { name: 'White', fill: '#f4f4ef', ink: '#1c1c1c' },
    2: { name: 'Red', fill: '#d63c3c', ink: '#ffffff' },
    3: { name: 'Light green', fill: '#7bc95a', ink: '#10240c' },
    4: { name: 'Purple', fill: '#8e4fbf', ink: '#ffffff' },
    5: { name: 'Yellow', fill: '#f2c94c', ink: '#2a2200' },
    6: { name: 'Dark green', fill: '#2e8b57', ink: '#ffffff' },
    7: { name: 'Black', fill: '#242424', ink: '#ffffff' },
    8: { name: 'Brown', fill: '#8b5a2b', ink: '#ffffff' },
    9: { name: 'Blue', fill: '#2f6fd6', ink: '#ffffff' },
    10: { name: 'Orange', fill: '#f28c28', ink: '#1f1200' },
} satisfies Record<
    CuisenaireRodValue,
    RodAppearance & { name: string }
>