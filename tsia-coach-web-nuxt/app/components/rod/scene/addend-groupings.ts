import type { AddendPair } from './rod.scene.types'

/** All ordered splits into two positive whole-number addends. */
export function addendPairs(total: number): AddendPair[] {
  if (!Number.isSafeInteger(total) || total < 2) return []
  return Array.from({ length: total - 1 }, (_, index) =>
    [index + 1, total - index - 1] as const,
  )
}
