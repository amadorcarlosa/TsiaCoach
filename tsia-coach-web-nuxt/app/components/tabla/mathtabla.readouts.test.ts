import { describe, expect, it } from 'vitest'
import type { RodTrain, TrainPart } from '~/components/rod/scene/rod.scene.types'
import { getMathTablaGeometry } from './mathtabla.geometry'
import { getMathTablaReadouts } from './mathtabla.readouts'

const geometry = getMathTablaGeometry()
function rod(id: string, x: number, y: number, value: TrainPart['value'], orientation: TrainPart['orientation'] = 'horizontal'): RodTrain {
  return { id, anchor: { x, y }, parts: [{ value, orientation, offset: { x: 0, y: 0 } }] }
}
const references = [rod('hd', 2, 0, 4), rod('hn', 2, 1, 3), rod('vd', 0, 2, 3, 'vertical'), rod('vn', 1, 2, 2, 'vertical')]

describe('MathTabla reference readouts and occupied area', () => {
  it('derives a guide from D totals but counts the actual central arrangement', () => {
    const first = rod('first', 2, 2, 3)
    const second = rod('second', 5, 2, 3)
    const beside = getMathTablaReadouts([...references, first, second], geometry)
    expect(beside).toEqual({
      horizontal: { numerator: 3, denominator: 4 }, vertical: { numerator: 2, denominator: 3 },
      state: 'ready', guide: { x: 2, y: 2, width: 4, depth: 3 }, guideCells: 12, occupiedCells: 4,
    })
    second.anchor = { x: 2, y: 3 }
    const rectangle = getMathTablaReadouts([...references, first, second], geometry)
    expect(rectangle).toEqual({ ...beside, occupiedCells: 6 })
    expect(getMathTablaReadouts(references, geometry)).toEqual({ ...beside, occupiedCells: 0 })
  })

  it('clips vertical and multipart central footprints and ignores rods outside the guide', () => {
    const multipart = rod('parts', 2, 4, 3)
    multipart.parts.push({ value: 3, orientation: 'horizontal', offset: { x: 0, y: 1 } })
    const trains = [...references, multipart, rod('vertical', 5, 3, 3, 'vertical'), rod('outside', 10, 10, 3)]
    expect(getMathTablaReadouts(trains, geometry).occupiedCells).toBe(5)
  })

  it('sums all reference parts without interpreting their positions as lengths', () => {
    const hd = rod('hd', 4, 0, 2)
    hd.parts.push({ value: 2, orientation: 'horizontal', offset: { x: 2, y: 0 } })
    const result = getMathTablaReadouts([hd, ...references.slice(1), rod('extra-n', 9, 1, 1)], geometry)
    expect(result.horizontal).toEqual({ numerator: 4, denominator: 4 })
    expect(result.guide).toEqual({ x: 2, y: 2, width: 4, depth: 3 })
    expect(result.occupiedCells).toBe(0)
  })

  it('has no guide until both denominator directions contain rods', () => {
    for (const trains of [[], references.slice(1), references.filter(train => train.id !== 'vd')]) {
      expect(getMathTablaReadouts(trains, geometry)).toMatchObject({
        state: 'incomplete', guide: null, guideCells: 0, occupiedCells: 0,
      })
    }
  })

  it('leaves the whole unchanged when numerator tracks change', () => {
    const base = getMathTablaReadouts(references, geometry)
    const extra = [...references, rod('hn2', 6, 1, 5), rod('vn2', 1, 5, 4, 'vertical')]
    const changed = getMathTablaReadouts(extra, geometry)
    expect(changed.horizontal.numerator).toBe(8)
    expect(changed.vertical.numerator).toBe(6)
    expect(changed.guide).toEqual(base.guide)
    expect(changed.guideCells).toBe(base.guideCells)
  })

  it('reports an explicit bounds state instead of clipping an oversized whole', () => {
    const small = getMathTablaGeometry(4, 3)
    // Totals are summed, so overlapping references can describe a whole larger
    // than the central grid even though the scene would not place them that way.
    const wide = [rod('hd', 2, 0, 3), rod('hd2', 2, 0, 3), rod('vd', 0, 2, 3, 'vertical'), rod('central', 2, 2, 3)]
    expect(getMathTablaReadouts(wide, small)).toMatchObject({
      state: 'exceeds-board', guide: null, guideCells: 0, occupiedCells: 0,
    })
    const tall = [rod('hd', 2, 0, 4), rod('vd', 0, 2, 2, 'vertical'), rod('vd2', 0, 2, 3, 'vertical')]
    expect(getMathTablaReadouts(tall, small)).toMatchObject({ state: 'exceeds-board', guide: null })
    const exact = [rod('hd', 2, 0, 4), rod('vd', 0, 2, 3, 'vertical')]
    expect(getMathTablaReadouts(exact, small)).toMatchObject({
      state: 'ready', guide: { x: 2, y: 2, width: 4, depth: 3 }, guideCells: 12,
    })
  })
})
