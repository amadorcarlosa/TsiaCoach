import { createArrayGoalAdapter } from '~/components/playground/goals/board-goal-adapters'
import { describe, expect, it } from 'vitest'
import { getTablaGeometry } from '~/components/tabla/tabla.geometry'
import { getFractionTablaGeometry } from '~/components/tabla/fraction-tabla.geometry'
import type { RodTrain, ScenePolicy } from '~/components/rod/scene/rod.scene.types'
import { copyScene } from '~/components/rod/scene/scene-snapshot'
import { useLevelAuthoring } from './useLevelAuthoring'
import { useAuthoringControls } from './useAuthoringControls'
import { useRodScene } from './useRodScene'

const bar = getTablaGeometry(3, 36, 24)
const fraction = getFractionTablaGeometry(2, 36, 24)
const fractionRows = fraction.targets.flatMap(t => [t.numeratorRow, t.denominatorRow])
const policies = {
  Bar: {
    columns: 24, rows: bar.config.rows,
    spawnRows: bar.targets.map(t => t.row), trackRows: bar.targets.map(t => t.row),
    editable: () => true, allowOrientation: false, allowFactors: false,
    requireHorizontalAnchorRow: true,
  },
  Array: {
    columns: 24, rows: 12, spawnRows: Array.from({ length: 12 }, (_, row) => row),
    editable: () => true, allowOrientation: true, allowFactors: true,
  },
  Fraction: {
    columns: 24, rows: fraction.config.rows, spawnRows: fractionRows, trackRows: fractionRows,
    editable: () => true, allowOrientation: false, allowFactors: false,
    requireHorizontalAnchorRow: true,
  },
} satisfies Record<string, ScenePolicy>

function setup(kind: keyof typeof policies) {
  const policy = policies[kind]
  const scene = useRodScene(policy)
  const authoring = useLevelAuthoring({
    goals: createArrayGoalAdapter({ columns: 100, rows: 100 }),
    scene: {
      read: () => scene.trains.value,
      capture: () => copyScene(scene.trains.value),
      checkReplacement: scene.checkReplacement,
      replace: scene.replace,
    },
    editable: policy.editable,
  })
  const controls = useAuthoringControls(authoring, () => false)
  const create = (value: 2 | 3 | 6, row?: number) => {
    const result = scene.apply([], { type: 'create', value, row })
    expect(result.allowed).toBe(true)
    if (!result.allowed) throw new Error(result.reason)
    return result.createdIds[0]!
  }
  if (kind === 'Bar') {
    const ids = [create(2), create(3)]
    expect(scene.apply(ids, { type: 'make-train' }).allowed).toBe(true)
    expect(scene.trains.value[0]!.parts).toHaveLength(2)
  } else if (kind === 'Array') {
    const vertical = create(2)
    expect(scene.apply([vertical], { type: 'set-orientation', orientation: 'vertical' }).allowed).toBe(true)
    const rectangle = create(6)
    expect(scene.apply([rectangle], { type: 'regroup-factors', shape: { rows: 2, columns: 3 } }).allowed).toBe(true)
    expect(scene.trains.value[0]!.parts[0]!.orientation).toBe('vertical')
    expect(scene.trains.value[1]!.parts.map(p => p.offset.y)).toEqual([0, 1])
  } else {
    create(2, fractionRows[0])
    create(3, fractionRows[1])
    expect(scene.trains.value.map(t => t.anchor.y)).toEqual(fractionRows.slice(0, 2))
  }
  return { scene, authoring, controls }
}

describe('authoring reuse across playground policies', () => {
  it.each(['Bar', 'Array', 'Fraction'] as const)('%s captures, edits, restores, and isolates its complete snapshot', kind => {
    const { scene, authoring } = setup(kind)
    const original = copyScene(scene.trains.value)
    const ids = original.map(t => t.id)
    expect(authoring.captureStep()).toEqual({ allowed: true })
    expect(authoring.steps.value[0]!.trains).toEqual(original)
    expect(authoring.dirty.value).toBe(false)
    scene.select(ids)
    expect(authoring.dirty.value).toBe(false)

    expect(scene.apply(ids, { type: 'move', delta: { x: 2, y: 0 } }).allowed).toBe(true)
    expect(authoring.dirty.value).toBe(true)
    expect(authoring.steps.value[0]!.trains).toEqual(original)
    expect(scene.apply(ids, { type: 'move', delta: { x: -2, y: 0 } }).allowed).toBe(true)
    expect(authoring.dirty.value).toBe(false)
    expect(scene.apply(ids, { type: 'move', delta: { x: 2, y: 0 } }).allowed).toBe(true)
    const moved = copyScene(scene.trains.value)
    expect(authoring.captureStep()).toEqual({ allowed: true })
    expect(authoring.dirty.value).toBe(false)

    expect(authoring.selectStep('step-1')).toEqual({ allowed: true })
    expect(scene.trains.value).toEqual(original)
    expect(scene.selection.value.size).toBe(0)
    expect(authoring.dirty.value).toBe(false)
    // Mutate nested parts after restoration as well as anchors before it.
    expect(scene.apply([ids[0]!], { type: 'regroup-ones' }).allowed).toBe(true)
    expect(authoring.dirty.value).toBe(true)
    expect(authoring.steps.value.map(s => s.trains)).toEqual([original, moved])
    expect(authoring.selectStep('step-2', 'discard')).toEqual({ allowed: true })
    expect(scene.trains.value).toEqual(moved)
    expect(authoring.selectStep('step-1')).toEqual({ allowed: true })
    expect(scene.trains.value).toEqual(original)
    expect(authoring.dirty.value).toBe(false)

    // A caller-owned capture can be edited without reaching either stored copy.
    const detached = copyScene(scene.trains.value)
    detached[0]!.anchor.x = 20
    detached[0]!.parts[0]!.offset.y = 8
    detached[0]!.parts[0]!.value = 10
    expect(scene.trains.value).toEqual(original)
    expect(authoring.steps.value[0]!.trains).toEqual(original)
  })

  it('keeps steps and simultaneous pending decisions independent even with identical step IDs', () => {
    const a = setup('Bar')
    const b = setup('Array')
    a.controls.capture()
    expect(b.authoring.steps.value).toEqual([])
    for (const instance of [a, b]) {
      if (!instance.authoring.steps.value.length) instance.controls.capture()
      instance.controls.capture()
      // Removing one train also works when Array's shapes occupy adjacent cells.
      expect(instance.scene.apply([instance.scene.trains.value[0]!.id], { type: 'delete' }).allowed).toBe(true)
    }
    const bSteps = b.authoring.steps.value.map(s => copyScene(s.trains))
    a.controls.requestStep('step-1')
    expect(a.controls.pendingStepId.value).toBe('step-1')
    expect(b.controls.pendingStepId.value).toBeNull()
    expect(b.controls.message.value).toBe('')
    b.controls.requestStep('step-1')
    a.controls.resolve('save')
    expect(a.controls.pendingStepId.value).toBeNull()
    expect(b.controls.pendingStepId.value).toBe('step-1')
    expect(b.authoring.activeStepId.value).toBe('step-2')
    expect(b.authoring.dirty.value).toBe(true)
    expect(b.authoring.steps.value.map(s => s.trains)).toEqual(bSteps)
    b.controls.resolve('discard')
    expect(b.authoring.dirty.value).toBe(false)
    expect(a.authoring.steps.value[1]!.trains).toEqual([])
  })

  it('accepts Array factor rectangles while Fraction rejects the same shape atomically', () => {
    const array = setup('Array')
    const target = setup('Fraction')
    const rectangle: RodTrain[] = copyScene(array.scene.trains.value.slice(1))
    // Anchor on a real Fraction track so the explicit invariant is exercised.
    rectangle[0]!.anchor.y = fractionRows[0]!
    expect(array.scene.checkReplacement(rectangle)).toEqual({ allowed: true })
    expect(array.scene.replace(rectangle)).toEqual({ allowed: true })
    target.scene.select(target.scene.trains.value.map(t => t.id))
    target.scene.apply([], { type: 'delete' })
    const before = {
      trains: copyScene(target.scene.trains.value),
      selection: [...target.scene.selection.value], message: target.scene.message.value,
    }
    const rejection = {
      allowed: false, reason: 'Keep every part horizontal and on its train’s anchor row.',
    }
    expect(target.scene.checkReplacement(rectangle)).toEqual(rejection)
    expect(target.scene.replace(rectangle)).toEqual(rejection)
    expect({
      trains: copyScene(target.scene.trains.value),
      selection: [...target.scene.selection.value], message: target.scene.message.value,
    }).toEqual(before)
  })
})
