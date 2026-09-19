import type { AlgebraTileDefinitionResponse, AlgebraTileSide, AlgebraTileSign, AlgebraTileTerm } from '#shared/types/algebra-tiles'

export type { AlgebraTileSign, AlgebraTileTerm } from '#shared/types/algebra-tiles'
export type AlgebraTileAppearance = { fill: string; ink: string }
type Definition = Omit<AlgebraTileDefinitionResponse, 'term' | 'sign' | 'coefficient'>
export const algebraTileCatalog = {
  one: { shape: 'square', dimensions: { width: 'one', height: 'one' } },
  x: { shape: 'rectangle', dimensions: { width: 'x', height: 'one' } },
  y: { shape: 'rectangle', dimensions: { width: 'y', height: 'one' } },
  xSquared: { shape: 'square', dimensions: { width: 'x', height: 'x' } },
  ySquared: { shape: 'square', dimensions: { width: 'y', height: 'y' } },
  xy: { shape: 'rectangle', dimensions: { width: 'x', height: 'y' } },
} as const satisfies Record<AlgebraTileTerm, Definition>

export const algebraTileTerms = Object.keys(algebraTileCatalog) as AlgebraTileTerm[]
export const algebraTileSigns = ['positive', 'negative'] as const
export const algebraTileLabels: Record<AlgebraTileTerm, string> = {
  one: '1', x: 'x', y: 'y', xSquared: 'x²', ySquared: 'y²', xy: 'xy',
}
const positiveFills: Record<AlgebraTileTerm, string> = {
  one: '#ffe15a', x: '#4ba74f', y: '#ff992d', xSquared: '#248fea', ySquared: '#a849bd', xy: '#79564d',
}
export function algebraTileAppearance(tile: Pick<AlgebraTile, 'term' | 'sign'>): AlgebraTileAppearance {
  return { fill: tile.sign === 'negative' ? '#d93632' : positiveFills[tile.term],
    ink: tile.sign === 'positive' && (tile.term === 'one' || tile.term === 'y') ? '#211a11' : '#ffffff' }
}
export function algebraTileDefinition(term: AlgebraTileTerm, sign: AlgebraTileSign): AlgebraTileDefinitionResponse & { coefficient: 1 | -1 } {
  return { term, sign, coefficient: sign === 'positive' ? 1 : -1, ...algebraTileCatalog[term] }
}
export function algebraTileLabel(tile: Pick<AlgebraTile, 'term' | 'sign'>): string {
  return (tile.sign === 'negative' ? '−' : '') + algebraTileLabels[tile.term]
}
export type AlgebraTile = {
  id: string; term: AlgebraTileTerm; sign: AlgebraTileSign; anchor: { x: number; y: number }; rotated: boolean
}
// Drawing lengths only: these do not assign mathematical values to x or y.
export const algebraTileDrawnSides = { one: 1, x: 6, y: 4 } satisfies Record<AlgebraTileSide, number>
export function algebraTileDimensions(tile: Pick<AlgebraTile, 'term' | 'rotated'>) {
  const sides = algebraTileCatalog[tile.term].dimensions
  const width = algebraTileDrawnSides[sides.width], depth = algebraTileDrawnSides[sides.height]
  return tile.rotated ? { width: depth, depth: width } : { width, depth }
}
