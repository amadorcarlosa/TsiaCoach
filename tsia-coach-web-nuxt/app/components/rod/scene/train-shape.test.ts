import { describe, expect, it } from 'vitest'
import type { RodTrain, TrainPart } from './rod.scene.types'
import { trainShape } from './train-shape'

const part = (
  value: TrainPart['value'],
  x: number,
  y: number,
  orientation: TrainPart['orientation'] = 'horizontal',
): TrainPart => ({
  value,
  orientation,
  offset: { x, y },
})

const train = (...parts: TrainPart[]): RodTrain => ({
  id: 'train',
  anchor: { x: 0, y: 0 },
  parts,
})

describe('trainShape', () => {
  it('distinguishes single, linear, rectangular, and irregular objects', () => {
    expect(trainShape(train(part(5, 0, 0)))).toBe('single')

    expect(trainShape(train(
      part(2, 0, 0),
      part(3, 2, 0),
    ))).toBe('linear')

    expect(trainShape(train(
      part(3, 0, 0),
      part(3, 0, 1),
    ))).toBe('rectangle')

    expect(trainShape(train(
      part(2, 0, 0),
      part(2, 3, 0),
    ))).toBe('irregular')
  })
})
