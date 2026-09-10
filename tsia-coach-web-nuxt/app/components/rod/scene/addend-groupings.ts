import { CuisenaireRodValues } from '../rod.types'
import type { AddendPair } from './rod.scene.types'

const values = Object.values(CuisenaireRodValues)
  .sort((a, b) => a - b)

export function addendPairs(total: number): AddendPair[] {
  const pairs: AddendPair[] = []

  for (const a of values) {
    for (const b of values) {
      if (a + b === total) {
        pairs.push([a, b])
      }
    }
  }

  return pairs
}
