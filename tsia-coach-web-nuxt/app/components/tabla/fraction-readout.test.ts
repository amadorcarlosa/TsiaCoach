import { describe, expect, it } from 'vitest'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import type { RodTrain } from '~/components/rod/scene/rod.scene.types'
import { fractionReadout } from './fraction-readout'
import { getFractionTablaGeometry } from './fraction-tabla.geometry'

// Two pairs: numerator/denominator tracks on rows 1/2 and 4/5.
const targets = getFractionTablaGeometry(2, 36, 24).targets

let next = 0
function train(row: number, x: number, ...values: CuisenaireRodValue[]): RodTrain {
  let offset = 0
  return {
    id: `t${next++}`,
    anchor: { x, y: row },
    parts: values.map(value => {
      const part = { value, offset: { x: offset, y: 0 }, orientation: 'horizontal' as const }
      offset += value
      return part
    }),
  }
}

describe('fractionReadout', () => {
  it('reports every pair as incomplete on an empty board', () => {
    expect(fractionReadout([], targets)).toEqual([
      { pairId: targets[0]!.id, numerator: 0, denominator: 0, complete: false },
      { pairId: targets[1]!.id, numerator: 0, denominator: 0, complete: false },
    ])
  })

  it('totals every rod and train on a track, wherever it sits along the row', () => {
    const [first] = fractionReadout([
      train(1, 0, 2),
      train(1, 10, 1),
      train(2, 0, 3, 4),
    ], targets)

    expect(first).toEqual({ pairId: targets[0]!.id, numerator: 3, denominator: 7, complete: true })
  })

  it('needs only a denominator to be complete; a zero numerator is a valid fraction', () => {
    const [first] = fractionReadout([train(2, 0, 5)], targets)
    expect(first).toMatchObject({ numerator: 0, denominator: 5, complete: true })
  })

  it('keeps a numerator without a denominator incomplete', () => {
    const [first] = fractionReadout([train(1, 0, 5)], targets)
    expect(first).toMatchObject({ numerator: 5, denominator: 0, complete: false })
  })

  it('keeps the pairs independent', () => {
    const [first, second] = fractionReadout([train(1, 0, 1), train(2, 0, 2), train(5, 0, 9)], targets)

    expect(first).toMatchObject({ numerator: 1, denominator: 2, complete: true })
    expect(second).toMatchObject({ numerator: 0, denominator: 9, complete: true })
  })

  it('ignores rods anchored off the tracks', () => {
    // Row 0 is the label row and row 3 the gap between pairs.
    expect(fractionReadout([train(0, 0, 4), train(3, 0, 6)], targets)
      .every(readout => readout.numerator === 0 && readout.denominator === 0)).toBe(true)
  })
})
