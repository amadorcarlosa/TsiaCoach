

export const RowKinds = {
    Unit: 'unit-grid',
    Ten: 'ten-grid',
    Target: 'target',
} as const

export type RowKind =
    (typeof RowKinds)[keyof typeof RowKinds]

export type TablaRow = {
    id: string
    kind: RowKind
    row: number
    label?: string
}

