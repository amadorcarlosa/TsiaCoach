import { expect, it } from 'vitest'
import { rodSizeStyle } from './rodStyle'
import { footprint } from './rodGeometry'

it('converts supplied domain ratios using one cell size', () => {
  expect(rodSizeStyle({ width: 1, depth: 1, height: 10 }, 20)).toEqual({ '--w': '20px', '--d': '20px', '--h': '200px' })
  expect(rodSizeStyle({ width: 1, depth: 1, height: 10 }, 40)).toEqual({ '--w': '40px', '--d': '40px', '--h': '400px' })
})

it('uses domain footprint dimensions when present', () => {
  expect(footprint({ length: 10, x: 2, y: 3, vertical: false, dimensions: { width: 1, depth: 1, height: 10 } }))
    .toEqual({ x: 2, y: 3, width: 1, height: 1 })
})
