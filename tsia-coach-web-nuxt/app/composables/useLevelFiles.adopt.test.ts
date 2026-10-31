import { describe, expect, it, vi } from 'vitest'
import { useLevelFiles, type BoardAdoption } from './useLevelFiles'
import { useLevelAuthoring } from './useLevelAuthoring'
import { useRodScene } from './useRodScene'
import { copyScene } from '~/components/rod/scene/scene-snapshot'
import { validateSnapshot } from '~/components/rod/scene/validate-snapshot'
import { createArrayGoalAdapter } from '~/components/playground/goals/board-goal-adapters'
import type { LevelDocumentAdapter, LevelDocumentV1 } from '~/components/playground/files/level-document'
import type { ScenePolicy } from '~/components/rod/scene/rod.scene.types'

/** An array playground whose size can change, like ArrayRodPlayground. */
function setup(adopt = true) {
  const size = { columns: 24, rows: 12 }
  const policy: ScenePolicy = {
    get columns() { return size.columns }, get rows() { return size.rows },
    spawnRows: [0], allowOrientation: true, editable: () => true,
  }
  const scene = useRodScene(policy)
  const goals = {
    get regions() { return createArrayGoalAdapter(size).regions },
    get pairs() { return createArrayGoalAdapter(size).pairs },
    get supportedTypes() { return createArrayGoalAdapter(size).supportedTypes },
    parse: (input: unknown) => createArrayGoalAdapter(size).parse(input),
    evaluate: (...args: Parameters<ReturnType<typeof createArrayGoalAdapter>['evaluate']>) => createArrayGoalAdapter(size).evaluate(...args),
  }
  const replace = vi.fn(scene.replace)
  const authoring = useLevelAuthoring({ goals, editable: () => true, beforeChange: () => true, scene: { read: () => scene.trains.value, capture: () => copyScene(scene.trains.value), checkReplacement: scene.checkReplacement, replace } })
  const adapterFor = (columns: number, rows: number): LevelDocumentAdapter => ({
    board: { kind: 'array', config: { columns, rows } },
    goals: createArrayGoalAdapter({ columns, rows }),
    validateSnapshot: snapshot => validateSnapshot(snapshot, { ...policy, columns, rows }),
  })
  const adoption: BoardAdoption = {
    adapterFor: board => board.kind === 'array' && board.config.columns <= 500 && board.config.rows <= 500
      ? adapterFor(board.config.columns, board.config.rows) : null,
    apply: vi.fn(board => {
      const before = { ...size }
      if (board.kind === 'array') Object.assign(size, board.config)
      return () => Object.assign(size, before)
    }),
  }
  const files = useLevelFiles({
    adapter: { get board() { return { kind: 'array' as const, config: { ...size } } }, goals, validateSnapshot: scene.validateSnapshot },
    authoring, editable: () => true, hasWorkingRods: () => false, resolveDrafts: () => true, onImported: () => {},
    ...(adopt ? { adoptBoard: adoption } : {}),
  })
  const document = (columns: number, rows: number): LevelDocumentV1 => ({
    version: 1, board: { kind: 'array', config: { columns, rows } },
    steps: [{ id: 'far', title: 'Far corner', prompt: '', goal: null, trains: [{ id: 'train-1', anchor: { x: columns - 3, y: rows - 1 }, parts: [{ value: 3, offset: { x: 0, y: 0 }, orientation: 'horizontal' }] }] }],
  })
  return { size, scene, authoring, files, replace, adoption, document }
}

describe('importing a level of another size', () => {
  it('validates against the file size and switches the board on confirm', () => {
    const s = setup()
    const preview = s.files.prepareImport(s.document(100, 100))
    expect(preview).toMatchObject({ allowed: true, value: { resizesBoard: true } })
    expect(s.size).toEqual({ columns: 24, rows: 12 })

    expect(s.files.confirmImport().allowed).toBe(true)
    expect(s.size).toEqual({ columns: 100, rows: 100 })
    expect(s.scene.trains.value[0]!.anchor).toEqual({ x: 97, y: 99 })
  })

  it('does not resize for a file of the current size', () => {
    const s = setup()
    expect(s.files.prepareImport(s.document(24, 12))).toMatchObject({ value: { resizesBoard: false } })
    expect(s.files.confirmImport().allowed).toBe(true)
    expect(s.adoption.apply).not.toHaveBeenCalled()
  })

  it('switches the size back when the import then fails', () => {
    const s = setup()
    s.files.prepareImport(s.document(100, 100))
    s.replace.mockReturnValueOnce({ allowed: false, reason: 'Replacement rejected.' })
    expect(s.files.confirmImport().allowed).toBe(false)
    expect(s.size).toEqual({ columns: 24, rows: 12 })
    expect(s.authoring.steps.value).toEqual([])
  })

  it('names both sizes when the board cannot be adopted', () => {
    expect(setup(false).files.prepareImport(setup(false).document(100, 100))).toEqual({
      allowed: false,
      reason: 'This level was made for an array board (100 columns, 100 rows), but this playground is an array board (24 columns, 12 rows).',
    })
    expect(setup().files.prepareImport(setup().document(600, 600)).allowed).toBe(false)
  })
})
