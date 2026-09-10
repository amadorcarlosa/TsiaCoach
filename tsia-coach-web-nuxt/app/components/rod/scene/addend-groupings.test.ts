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
    expect(addendPairs(12)).toEqual([
      [2, 10],
      [3, 9],
      [4, 8],
      [5, 7],
      [6, 6],
      [7, 5],
      [8, 4],
      [9, 3],
      [10, 2],
    ])
  })

  it('returns no pairs below the smallest achievable sum', () => {
    expect(addendPairs(1)).toEqual([])
  })

  it('returns no pairs above the largest achievable sum', () => {
    expect(addendPairs(21)).toEqual([])
  })
})
