import { describe, expect, it } from 'vitest'
import type { RodTrain, ScenePolicy } from '~/components/rod/scene/rod.scene.types'
import { copyScene } from '~/components/rod/scene/scene-snapshot'
import { useRodScene } from './useRodScene'

function createScene(overrides: Partial<ScenePolicy> = {}) {
  return useRodScene({
    columns: 24,
    rows: 12,
    spawnRows: [4],
    editable: () => true,
    allowOrientation: true,
    ...overrides,
  })
}

function importedScene(): RodTrain[] {
  return [
    {
      id: 'train-1',
      anchor: { x: 2, y: 2 },
      parts: [
        { value: 3, orientation: 'horizontal', offset: { x: 1, y: 0 } },
        { value: 2, orientation: 'vertical', offset: { x: 4, y: 1 } },
      ],
    },
    {
      id: 'imported-tower',
      anchor: { x: 12, y: 6 },
      parts: [{ value: 5, orientation: 'tower', offset: { x: 0, y: 0 } }],
    },
  ]
}

describe('scene replacement', () => {
  it('preserves IDs, anchors, values, orientations, and offsets and clears transient state', () => {
    const scene = createScene()
    scene.apply([], { type: 'create', value: 2 })
    scene.select(['train-1'])
    scene.apply([], { type: 'delete' })
    expect(scene.message.value).not.toBe('')

    const source = importedScene()
    expect(scene.checkReplacement(source)).toEqual({ allowed: true })
    expect(scene.replace(source)).toEqual({ allowed: true })
    expect(scene.trains.value).toEqual(source)
    expect([...scene.selection.value]).toEqual([])
    expect(scene.message.value).toBe('')
  })

  const invalid: { name: string, change: (source: RodTrain[]) => void }[] = [
    { name: 'duplicate IDs', change: s => { s[1]!.id = s[0]!.id } },
    { name: 'empty ID', change: s => { s[0]!.id = ' ' } },
    { name: 'fractional anchor', change: s => { s[0]!.anchor.x = 0.5 } },
    { name: 'empty parts', change: s => { s[0]!.parts = [] } },
    { name: 'invalid value', change: s => { s[0]!.parts[0]!.value = 11 as never } },
    { name: 'fractional offset', change: s => { s[0]!.parts[0]!.offset.x = 0.5 } },
    { name: 'unknown orientation', change: s => { s[0]!.parts[0]!.orientation = 'diagonal' as never } },
    { name: 'out of bounds', change: s => { s[0]!.anchor.x = 24 } },
    { name: 'overlap', change: s => { s[1]!.anchor = { x: 3, y: 2 } } },
  ]

  it.each(invalid)('rejects $name without changing scene, selection, message, or ID allocation', ({ change }) => {
    const scene = createScene()
    scene.apply([], { type: 'create', value: 2 })
    scene.select(['train-1'])
    scene.apply([], { type: 'delete' })
    const before = {
      trains: copyScene(scene.trains.value),
      selection: [...scene.selection.value],
      message: scene.message.value,
    }
    const source = importedScene()
    change(source)
    expect(scene.checkReplacement(source).allowed).toBe(false)
    expect(scene.replace(source).allowed).toBe(false)
    expect({
      trains: copyScene(scene.trains.value),
      selection: [...scene.selection.value],
      message: scene.message.value,
    }).toEqual(before)
    expect(scene.apply([], { type: 'create', value: 1 })).toEqual({
      allowed: true, createdIds: ['train-2'],
    })
  })

  it('checks editing and horizontal track restrictions', () => {
    expect(createScene({ editable: () => false }).replace(importedScene()).allowed).toBe(false)
    expect(createScene({ allowOrientation: false }).replace(importedScene()).allowed).toBe(false)
    const scene = createScene({ trackRows: [4], allowOrientation: false })
    const source = importedScene().slice(0, 1)
    source[0]!.anchor.y = 4
    source[0]!.parts = [{ value: 2, orientation: 'horizontal', offset: { x: 0, y: 1 } }]
    expect(scene.replace(source).allowed).toBe(false)
    source[0]!.parts[0]!.offset.y = 0
    expect(scene.replace(source).allowed).toBe(true)
  })

  it('skips imported train IDs during subsequent creation and clone allocation', () => {
    const scene = createScene()
    const source = importedScene()
    source[1]!.id = 'train-3'
    expect(scene.replace(source).allowed).toBe(true)
    expect(scene.apply([], { type: 'create', value: 1 })).toEqual({
      allowed: true, createdIds: ['train-2'],
    })
    expect(scene.apply(['train-2'], { type: 'clone' })).toEqual({
      allowed: true, createdIds: ['train-4'],
    })
    expect(new Set(scene.trains.value.map(t => t.id)).size).toBe(4)
  })

  it('treats permitted track footprints separately from the horizontal anchor-row invariant', () => {
    const source: RodTrain[] = [{
      id: 'rectangle', anchor: { x: 0, y: 4 }, parts: [
        { value: 3, orientation: 'horizontal', offset: { x: 0, y: 0 } },
        { value: 3, orientation: 'horizontal', offset: { x: 0, y: 1 } },
      ],
    }]
    expect(createScene({ trackRows: [4, 5] }).replace(source).allowed).toBe(true)
    expect(createScene({ trackRows: [4] }).replace(source)).toEqual({
      allowed: false, reason: 'Keep every part inside the board.',
    })
    // This rule must apply even when trackRows is omitted.
    const restricted = createScene({ requireHorizontalAnchorRow: true })
    expect(restricted.replace(source)).toEqual({
      allowed: false, reason: 'Keep every part horizontal and on its train’s anchor row.',
    })
  })

  it.each(['vertical', 'factors'] as const)('enforces the anchor-row rule during interactive %s actions too', kind => {
    const scene = createScene({ requireHorizontalAnchorRow: true, allowFactors: true })
    expect(scene.apply([], { type: 'create', value: 6 }).allowed).toBe(true)
    const before = copyScene(scene.trains.value)
    const action = kind === 'vertical'
      ? { type: 'set-orientation', orientation: 'vertical' } as const
      : { type: 'regroup-factors', shape: { rows: 2, columns: 3 } } as const
    const checked = scene.check(['train-1'], action)
    expect(checked).toMatchObject({ allowed: false, reason: expect.stringContaining('anchor row') })
    expect(scene.apply(['train-1'], action)).toEqual(checked)
    expect(scene.trains.value).toEqual(before)
  })

  it('owns a deep copy of supplied snapshots', () => {
    const scene = createScene()
    const source = importedScene()
    const expected = copyScene(source)
    expect(scene.replace(source).allowed).toBe(true)
    source[0]!.id = 'changed'
    source[0]!.anchor.x = 10
    source[0]!.parts[0]!.value = 9
    source[0]!.parts[0]!.orientation = 'tower'
    source[0]!.parts[0]!.offset.x = 7
    source[0]!.parts.push({ value: 1, orientation: 'horizontal', offset: { x: 0, y: 0 } })
    source.pop()
    expect(scene.trains.value).toEqual(expected)
  })
})
