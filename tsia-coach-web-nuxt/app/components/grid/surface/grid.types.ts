export type GridConfig = {
    columns: number
    rows: number
    cellSize: number
}

export type GridView = {
    tiltDegrees: number
}

export type GridStyle = {
    width: string
    height: string
    '--cell-size': string
    transform: string
}

export const ariaGridView = (config: GridConfig): string =>
    `${config.columns} columns by ${config.rows} rows`

export const gridStyle = (
    config: GridConfig,
    view: GridView,
): GridStyle => ({
    width: `${config.columns * config.cellSize}px`,
    height: `${config.rows * config.cellSize}px`,
    '--cell-size': `${config.cellSize}px`,
    transform: `rotateX(${view.tiltDegrees}deg)`,
})
