import { beforeAll, describe, expect, it } from 'vitest'
import { AlgebraTileDefinitionSchema, type AlgebraTileDefinition } from '#server/schemas/algebra-tile-definition'
import { algebraTileDefinition, algebraTileSigns, algebraTileTerms } from '../algebra-tile.types'

describe('frontend algebra tile catalog agrees with the C# domain', () => {
  let catalog: AlgebraTileDefinition[]
  beforeAll(async () => {
    const apiUrl = process.env.ALGEBRA_TILE_API_URL ?? process.env.NUXT_API_URL
    if (!apiUrl) throw new Error('Set NUXT_API_URL (or ALGEBRA_TILE_API_URL) to the running C# API origin.')
    const url = new URL('/api/algebra-tiles', apiUrl)
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) })
    if (!response.ok) throw new Error(`C# algebra tile catalog returned HTTP ${response.status} at ${url}.`)
    catalog = AlgebraTileDefinitionSchema.array().parse(await response.json())
  })
  it('matches every signed definition exactly, without missing or duplicate tiles', () => {
    const expected = algebraTileTerms.flatMap(term => algebraTileSigns.map(sign => algebraTileDefinition(term, sign)))
    const sort = (items: AlgebraTileDefinition[]) => [...items].sort((a, b) => (a.term + a.sign).localeCompare(b.term + b.sign))
    expect(sort(catalog)).toEqual(sort(expected))
  })
})
