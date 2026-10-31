import type { AddendPair } from './rod.scene.types'

/** All ordered splits into two positive whole-number addends. */
export function addendPairs(total: number): AddendPair[] {
  if (!Number.isSafeInteger(total) || total < 2) return []
  return Array.from({ length: total - 1 }, (_, index) =>
    [index + 1, total - index - 1] as const,
  )
}

/**
 * Same-sign splits only. Unrestricted signed addends are infinite
 * (6 = 7 + (-1) = 8 + (-2) ...), so a negative total splits into negative
 * addends mirroring the positive list: -24 offers -1 + -23 through -23 + -1.
 */
export function signedAddendPairs(total: number): AddendPair[] {
  if (total >= 0) return addendPairs(total)
  return addendPairs(-total).map(([a, b]) => [-a, -b] as const)
}
