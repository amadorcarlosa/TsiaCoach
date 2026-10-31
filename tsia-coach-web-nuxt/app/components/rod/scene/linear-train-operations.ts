import type { DeepReadonly } from 'vue'
import type { CuisenaireRodValue } from '../rod.types'
import { signedAddendPairs } from './addend-groupings'
import type {
  AddendPair,
  RodTrain,
  TrainPart,
} from './rod.scene.types'
import {
  MIXED_SIGN_REGROUP_REASON,
  formatSigned,
  signField,
  trainMagnitude,
  trainSignedTotal,
  trainUniformSign,
} from './rod-arithmetic'
import { trainShape } from './train-shape'
import { partFootprint } from './part-footprint'

type OperationResult<T> =
  | { allowed: true, value: T }
  | { allowed: false, reason: string }

type LinearLayout =
  | {
      allowed: true
      orientation: TrainPart['orientation']
      vertical: boolean
      start: { x: number, y: number }
      /** Physical length in cells. The arithmetic total is trainSignedTotal. */
      span: number
    }
  | { allowed: false, reason: string }

function allow<T>(value: T): OperationResult<T> {
  return { allowed: true, value }
}

function reject(reason: string): OperationResult<never> {
  return { allowed: false, reason }
}

function copyTrain(
  train: DeepReadonly<RodTrain>,
  parts: TrainPart[],
): RodTrain {
  return {
    id: train.id,
    anchor: { ...train.anchor },
    parts,
  }
}

export function linearLayout(
  train: DeepReadonly<RodTrain>,
): LinearLayout {
  const first = train.parts[0]

  if (!first) {
    return { allowed: false, reason: 'This train has no parts.' }
  }

  const orientation = first.orientation

  if (train.parts.some(part => part.orientation === 'tower')) {
    return {
      allowed: false,
      reason: 'Lay the tower horizontally or vertically before decomposing.',
    }
  }

  if (train.parts.some(part => part.orientation !== orientation)) {
    return {
      allowed: false,
      reason: 'Arrange each selected train horizontally or vertically first.',
    }
  }

  const vertical = orientation === 'vertical'
  const ordered = [...train.parts].sort((a, b) =>
    vertical
      ? a.offset.y - b.offset.y
      : a.offset.x - b.offset.x,
  )
  const start = { ...ordered[0]!.offset }
  let span = 0

  for (const part of ordered) {
    const expectedX = start.x + (vertical ? 0 : span)
    const expectedY = start.y + (vertical ? span : 0)

    if (
      part.offset.x !== expectedX ||
      part.offset.y !== expectedY
    ) {
      return {
        allowed: false,
        reason: 'Arrange each selected train in one continuous line first.',
      }
    }

    span += part.value
  }

  return {
    allowed: true,
    orientation,
    vertical,
    start,
    span,
  }
}

export function makeLinearTrain(
  selected: readonly DeepReadonly<RodTrain>[],
): OperationResult<RodTrain> {
  if (selected.length < 2) {
    return reject('Select at least two trains.')
  }

  const allFlatAndHorizontal = selected.every(train => {
    const first = train.parts[0]
    if (!first) return false

    return train.parts.every(part =>
      part.orientation === 'horizontal' &&
      part.offset.y === first.offset.y,
    )
  })

  if (!allFlatAndHorizontal) {
    return reject('Lay all selected rods horizontally first.')
  }

  const ordered = [...selected].sort((a, b) =>
    a.anchor.y - b.anchor.y ||
    a.anchor.x - b.anchor.x ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
  const parts: TrainPart[] = []
  let cursor = 0

  for (const train of ordered) {
    const orderedParts = train.parts
      .map((part, index) => ({ part, index }))
      .sort((a, b) =>
        a.part.offset.x - b.part.offset.x ||
        a.index - b.index,
      )

    for (const { part } of orderedParts) {
      // Joining keeps every rod's own sign; mixed material is allowed.
      parts.push({
        value: part.value,
        ...(part.sign !== undefined ? { sign: part.sign } : {}),
        orientation: part.orientation,
        offset: { x: cursor, y: 0 },
      })
      cursor += part.value
    }
  }

  return allow({
    id: '',
    anchor: { ...ordered[0]!.anchor },
    parts,
  })
}

export function orientTrain(
  train: DeepReadonly<RodTrain>,
  orientation: TrainPart['orientation'],
  bounds: { columns: number, rows: number },
): OperationResult<RodTrain> {
  if (train.parts.length === 1) {
    return allow(copyTrain(train, [{
      ...train.parts[0]!,
      offset: { ...train.parts[0]!.offset },
      orientation,
    }]))
  }

  if (orientation === 'tower') {
    return reject('Tower is available only for individual rods.')
  }

  if (trainShape(train) !== 'linear') {
    return reject(
      'Choose another factor arrangement to change this rectangle.',
    )
  }

  const span = trainMagnitude(train)
  // A straight train covers the same cells as one rod of its physical length.
  const { width, depth } = partFootprint({ value: span, offset: { x: 0, y: 0 }, orientation })

  if (width > bounds.columns || depth > bounds.rows) {
    return reject(
      `A length-${span} train cannot fit ${orientation}ly ` +
      `on this ${bounds.columns}-column, ${bounds.rows}-row board.`,
    )
  }

  let cursor = 0
  const parts = train.parts.map((part): TrainPart => {
    const transformed = {
      ...part,
      orientation,
      offset: orientation === 'horizontal'
        ? { x: cursor, y: 0 }
        : { x: 0, y: cursor },
    }

    cursor += part.value
    return transformed
  })

  // Turns about the anchor cell. The scene slides the result back inside
  // its region, so single rods and trains share one edge rule.
  return allow({
    id: train.id,
    anchor: { ...train.anchor },
    parts,
  })
}

export function regroupTrainToOnes(
  train: DeepReadonly<RodTrain>,
): OperationResult<RodTrain> {
  const layout = linearLayout(train)
  if (!layout.allowed) return layout

  const sign = trainUniformSign(train)
  if (sign === undefined) return reject(MIXED_SIGN_REGROUP_REASON)

  // -14 becomes fourteen negative ones: count by magnitude, keep the sign.
  return allow(copyTrain(
    train,
    Array.from(
      { length: layout.span },
      (_, index): TrainPart => ({
        value: 1,
        ...signField(sign),
        orientation: layout.orientation,
        offset: {
          x: layout.start.x + (layout.vertical ? 0 : index),
          y: layout.start.y + (layout.vertical ? index : 0),
        },
      }),
    ),
  ))
}

export function regroupTrainToAddends(
  train: DeepReadonly<RodTrain>,
  requested?: AddendPair,
): OperationResult<RodTrain[]> {
  const layout = linearLayout(train)
  if (!layout.allowed) return layout

  const sign = trainUniformSign(train)
  if (sign === undefined) return reject(MIXED_SIGN_REGROUP_REASON)

  const total = trainSignedTotal(train)
  const candidates = signedAddendPairs(total)
  const pair = requested
    ? candidates.find(candidate =>
        candidate[0] === requested[0] &&
        candidate[1] === requested[1],
      )
    : candidates[0]

  if (!pair) {
    return reject(
      requested
        ? 'Choose two rods valued 1–10 that add to this object’s value.'
        : `Value ${formatSigned(total)} has no two-addend arrangement using rods valued 1–10.`,
    )
  }

  let cursor = 0
  const addends = pair.map((addend): RodTrain => {
    const anchor = {
      x: train.anchor.x + layout.start.x + (layout.vertical ? 0 : cursor),
      y: train.anchor.y + layout.start.y + (layout.vertical ? cursor : 0),
    }
    // Build from the magnitude, then apply the sign: lengths, counts and
    // palette keys are never negative.
    const magnitude = Math.abs(addend)
    let remaining = magnitude
    let offset = 0
    const parts: TrainPart[] = []
    while (remaining > 0) {
      const value = Math.min(10, remaining) as CuisenaireRodValue
      parts.push({
        value,
        ...signField(sign),
        orientation: layout.orientation,
        offset: { x: layout.vertical ? 0 : offset, y: layout.vertical ? offset : 0 },
      })
      remaining -= value
      offset += value
    }
    cursor += magnitude
    return {
      id: '', anchor, parts,
      ...(train.materialRole ? { materialRole: train.materialRole } : {}),
    }
  })

  return allow(addends)
}

export function releaseTrain(
  train: DeepReadonly<RodTrain>,
): OperationResult<RodTrain[]> {
  if (train.parts.length < 2) {
    return reject('Select only trains with multiple parts.')
  }

  return allow(train.parts.map(part => ({
    id: '',
    anchor: {
      x: train.anchor.x + part.offset.x,
      y: train.anchor.y + part.offset.y,
    },
    parts: [{
      value: part.value,
      ...(part.sign !== undefined ? { sign: part.sign } : {}),
      orientation: part.orientation,
      offset: { x: 0, y: 0 },
    }],
  })))
}
