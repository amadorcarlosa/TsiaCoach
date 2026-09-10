import { describe, expect, it } from 'vitest'
import type { RodTrain } from "~/components/rod/scene/rod.scene.types.ts";
import {validateScene} from "~/components/rod/scene/rod-scene.placement.ts";

const policy = {
  columns: 12,
  rows: 12,
  spawnRows: [0, 1, 2],
  editable: () => true,
  allowOrientation: true,
}

describe('domain rod scene adapter', () => {
  it('accepts single-part rods that are fully inside the board', () => {
    const train: RodTrain = {
      id: 'train-1',
      anchor: { x: 10, y: 0 },
      parts: [{ value: 2, offset: { x: 0, y: 0 }, orientation: 'horizontal' }],
    }

    expect(validateScene([train], policy)).toEqual({ allowed: true })
  })

  it('rejects horizontal rods that exceed board bounds', () => {
    const train: RodTrain = {
      id: 'train-1',
      anchor: { x: 11, y: 0 },
      parts: [{ value: 2, offset: { x: 0, y: 0 }, orientation: 'horizontal' }],
    }

    expect(validateScene([train], policy)).toEqual({
      allowed: false,
      reason: 'Keep every part inside the board.',
    })
  })

  it('uses vertical and tower footprints when validating a scene', () => {
    const vertical: RodTrain = {
      id: 'train-1',
      anchor: { x: 11, y: 11 },
      parts: [{ value: 2, offset: { x: 0, y: 0 }, orientation: 'vertical' }],
    }

    const tower: RodTrain = {
      id: 'train-2',
      anchor: { x: 11, y: 11 },
      parts: [{ value: 6, offset: { x: 0, y: 0 }, orientation: 'tower' }],
    }

    expect(validateScene([vertical], policy)).toEqual({
      allowed: false,
      reason: 'Keep every part inside the board.',
    })
    expect(validateScene([tower], policy)).toEqual({ allowed: true })
  })

  it('rejects overlapping trains', () => {
    const first: RodTrain = {
      id: 'train-1',
      anchor: { x: 0, y: 0 },
      parts: [{ value: 2, offset: { x: 0, y: 0 }, orientation: 'horizontal' }],
    }

    const second: RodTrain = {
      id: 'train-2',
      anchor: { x: 1, y: 0 },
      parts: [{ value: 2, offset: { x: 0, y: 0 }, orientation: 'horizontal' }],
    }

    expect(validateScene([first, second], policy)).toEqual({
      allowed: false,
      reason: 'That arrangement overlaps another part.',
    })
  })
})
