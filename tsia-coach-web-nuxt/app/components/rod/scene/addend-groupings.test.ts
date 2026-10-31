import { describe, expect, it } from 'vitest'
import { addendPairs } from './addend-groupings'

describe('addendPairs', () => {
  it('orders candidates by ascending first addend, including both orders of a pair', () => {
    expect(addendPairs(5)).toEqual([
      [1, 4],
      [2, 3],
      [3, 2],
      [4, 1],
    ])
  })

  it('includes the symmetric pair once, in the middle', () => {
    expect(addendPairs(12)).toHaveLength(11)
    expect(addendPairs(12)[5]).toEqual([6, 6])
  })

  it('returns no pairs below the smallest achievable sum', () => {
    expect(addendPairs(1)).toEqual([])
  })

  it('supports multi-rod addends', () => {
    expect(addendPairs(24)).toHaveLength(23)
    expect(addendPairs(24)).toContainEqual([12, 12])
  })
})
