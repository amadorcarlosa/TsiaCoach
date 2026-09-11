import { describe, expect, it } from 'vitest'
import { getFractionTablaGeometry } from './fraction-tabla.geometry'

describe('getFractionTablaGeometry', () => {
  it('builds two fraction pairs with six rows and numerator/denominator tracks', () => {
    const geometry = getFractionTablaGeometry(2, 36, 24)

    expect(geometry.config.rows).toBe(6)
    expect(geometry.targets.flatMap(target => [
      target.numeratorRow,
      target.denominatorRow,
    ])).toEqual([1, 2, 4, 5])
  })

  it.each([
    () => getFractionTablaGeometry(0),
    () => getFractionTablaGeometry(1.5),
    () => getFractionTablaGeometry(1, 0),
    () => getFractionTablaGeometry(1, Number.NaN),
    () => getFractionTablaGeometry(1, 36, 0),
    () => getFractionTablaGeometry(1, 36, 1.5),
  ])('rejects invalid arguments', build => {
    expect(build).toThrow(RangeError)
  })
})
