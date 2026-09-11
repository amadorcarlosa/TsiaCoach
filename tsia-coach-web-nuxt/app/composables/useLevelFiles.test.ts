import { describe, expect, it, vi } from 'vitest'
import { useLevelFiles } from './useLevelFiles'
import { useLevelAuthoring } from './useLevelAuthoring'
import { useRodScene } from './useRodScene'
import { copyScene } from '~/components/rod/scene/scene-snapshot'
import { createArrayGoalAdapter } from '~/components/playground/goals/board-goal-adapters'
import type { LevelDocumentV1 } from '~/components/playground/files/level-document'
import { MAX_LEVEL_FILE_BYTES } from '~/components/playground/files/level-file-io'
function setup() {
  let editable = true
  const scene = useRodScene({ columns: 24, rows: 12, spawnRows: [0], allowOrientation: true, editable: () => editable })
  const goals = createArrayGoalAdapter({ columns: 24, rows: 12 })
  const capture = vi.fn(() => copyScene(scene.trains.value))
  const replace = vi.fn(scene.replace)
  const drafts = vi.fn(() => true)
  const authoring = useLevelAuthoring({ goals, editable: () => editable, beforeChange: drafts, scene: { read: () => scene.trains.value, capture, checkReplacement: scene.checkReplacement, replace } })
  const download = vi.fn(), onImported = vi.fn()
  const validate = vi.fn(scene.validateSnapshot)
  const files = useLevelFiles({ adapter: { board: { kind: 'array', config: { columns: 24, rows: 12 } }, goals, validateSnapshot: validate }, authoring, editable: () => editable, hasWorkingRods: () => scene.trains.value.length > 0, resolveDrafts: drafts, onImported, download })
  const add = () => scene.apply([], { type: 'create', value: 2 })
  const state = () => JSON.stringify({ steps: authoring.steps.value, active: authoring.activeStepId.value, dirty: authoring.dirty.value, scene: scene.trains.value, selection: [...scene.selection.value], message: scene.message.value })
  const document = (): LevelDocumentV1 => ({ version: 1, board: { kind: 'array', config: { columns: 24, rows: 12 } }, steps: [{ id: 'step-1', title: 'Imported', prompt: 'Arrange rods.', trains: [{ id: 'train-1', anchor: { x: 3, y: 3 }, parts: [{ value: 3, offset: { x: 0, y: 0 }, orientation: 'horizontal' }] }], goal: { type: 'all', conditions: [{ type: 'occupied-area', regionId: 'array', cells: 3 }] } }] })
  return { scene, authoring, files, add, state, document, capture, replace, download, drafts, onImported, validate, lock: () => { editable = false } }
}
describe('level files preparation and commit', () => {
  it('preparation, rejection and cancellation leave board, selection, IDs and authoring untouched', () => {
    const s = setup(); s.add(); s.authoring.captureStep(); s.add()
    const before = s.state()
    expect(s.files.prepareImport(s.document()).allowed).toBe(true)
    expect(s.state()).toBe(before)
    s.files.cancelImport()
    expect(s.state()).toBe(before)
    expect(s.files.confirmImport().allowed).toBe(false)
    const bad = s.document(); bad.steps.push({ ...structuredClone(bad.steps[0]!), id: 'later', trains: [{ ...bad.steps[0]!.trains[0]!, anchor: { x: 99, y: 0 } }] })
    expect(s.files.prepareImport(bad).allowed).toBe(false)
    expect(s.state()).toBe(before)
    expect(s.replace).not.toHaveBeenCalled()
  })
  it('keeps prepared data private and isolates snapshots/goals from imported input and preview', () => {
    const s = setup(), input = s.document()
    const prepared = s.files.prepareImport(input)
    input.steps[0]!.title = 'Mutated'; input.steps[0]!.trains[0]!.anchor.x = 99; input.steps[0]!.goal!.conditions = []
    if (prepared.allowed && prepared.value.board.kind === 'array') prepared.value.board.config.columns = 1
    expect(s.files.confirmImport().allowed).toBe(true)
    expect(s.authoring.steps.value[0]).toMatchObject({ title: 'Imported', trains: [{ anchor: { x: 3 } }], goal: { conditions: [{ cells: 3 }] } })
    s.add()
    expect(s.authoring.steps.value[0]!.trains).toHaveLength(1)
    expect(s.onImported).toHaveBeenCalledOnce()
    expect(s.files.preview.value).toBeNull()
  })
  it('rechecks editability and pure scene validation at confirmation; replacement failure is atomic', () => {
    const s = setup(); s.add(); s.authoring.captureStep()
    const before = s.state()
    s.files.prepareImport(s.document())
    s.replace.mockReturnValueOnce({ allowed: false, reason: 'Replacement rejected.' })
    expect(s.files.confirmImport().allowed).toBe(false)
    expect(s.state()).toBe(before)
    expect(s.files.preview.value).not.toBeNull()
    expect(s.onImported).not.toHaveBeenCalled()
    s.lock()
    expect(s.files.confirmImport().allowed).toBe(false)
    expect(s.state()).toBe(before)
    expect(s.files.prepareImport(s.document()).allowed).toBe(true)
  })
  it('resolves drafts before confirmation and clears the scene on empty import', () => {
    const s = setup(); s.add(); s.authoring.captureStep(); s.files.prepareImport({ ...s.document(), steps: [] })
    const before = s.state(); s.drafts.mockReturnValueOnce(false)
    expect(s.files.confirmImport().allowed).toBe(false)
    expect(s.state()).toBe(before)
    expect(s.files.confirmImport().allowed).toBe(true)
    expect(s.scene.trains.value).toEqual([])
    expect(s.authoring.steps.value).toEqual([])
    expect(s.authoring.activeStepId.value).toBeNull()
  })
  it('avoids imported step and train IDs on future captures and rod creation', () => {
    const s = setup(); const doc = s.document()
    doc.steps.push({ ...structuredClone(doc.steps[0]!), id: 'step-3' })
    s.files.prepareImport(doc); s.files.confirmImport(); s.add(); s.authoring.captureStep(); s.authoring.captureStep()
    expect(s.authoring.steps.value.map(step => step.id)).toEqual(['step-1', 'step-3', 'step-2', 'step-4'])
    expect(new Set(s.scene.trains.value.map(train => train.id)).size).toBe(2)
  })
  it('catches syntax/read errors and rejects oversized files before reading', async () => {
    const s = setup(); s.add(); const before = s.state()
    expect((await s.files.selectFile(new File(['{bad'], 'bad.json'))).allowed).toBe(false)
    const large = new File(['x'.repeat(MAX_LEVEL_FILE_BYTES + 1)], 'large.json')
    const read = vi.spyOn(large, 'text')
    expect((await s.files.selectFile(large)).allowed).toBe(false)
    expect(read).not.toHaveBeenCalled()
    const broken = new File([], 'broken.json'); vi.spyOn(broken, 'text').mockRejectedValue(new Error('Read failed'))
    expect((await s.files.selectFile(broken)).allowed).toBe(false)
    expect(s.state()).toBe(before)
  })
  it('ignores a file read completed after cancellation', async () => {
    const s = setup(), file = new File([], 'slow.json')
    let finish!: (text: string) => void
    vi.spyOn(file, 'text').mockReturnValue(new Promise(resolve => { finish = resolve }))
    const reading = s.files.selectFile(file); s.files.cancelImport(); finish(JSON.stringify(s.document()))
    await reading
    expect(s.files.preview.value).toBeNull()
  })
})
describe('explicit export choices', () => {
  it.each(['cancel', 'saved-only', 'update'] as const)('%s handles dirty state explicitly', decision => {
    const s = setup(); s.add(); s.authoring.captureStep(); s.add()
    s.capture.mockClear(); const before = s.state()
    expect(s.files.requestExport().allowed).toBe(false)
    expect(s.download).not.toHaveBeenCalled()
    expect(s.files.exportQuestion.value).toBe('dirty')
    expect(s.files.requestExport(decision).allowed).toBe(true)
    if (decision !== 'update') { expect(s.state()).toBe(before); expect(s.capture).not.toHaveBeenCalled(); expect(s.replace).not.toHaveBeenCalled() }
    if (decision === 'cancel') expect(s.download).not.toHaveBeenCalled()
    else {
      expect(s.download).toHaveBeenCalledOnce()
      expect(s.download.mock.calls[0]![0].steps[0].trains).toHaveLength(decision === 'update' ? 2 : 1)
    }
    if (decision === 'update') { expect(s.capture).toHaveBeenCalledOnce(); expect(s.authoring.dirty.value).toBe(false) }
  })
  it('offers Capture first for uncaptured rods and resolves drafts before export', () => {
    const s = setup(); s.add()
    s.files.requestExport(); expect(s.files.exportQuestion.value).toBe('uncaptured'); expect(s.download).not.toHaveBeenCalled()
    s.drafts.mockReturnValueOnce(false); expect(s.files.captureFirst().allowed).toBe(false)
    expect(s.authoring.steps.value).toHaveLength(0)
    expect(s.files.captureFirst().allowed).toBe(true); expect(s.download).toHaveBeenCalledOnce()
    s.drafts.mockReturnValueOnce(false); expect(s.files.requestExport().allowed).toBe(false); expect(s.download).toHaveBeenCalledOnce()
  })
  it('exports an empty level, and saved snapshots in portrait, while rejecting dirty update when locked', () => {
    const s = setup(); expect(s.files.requestExport().allowed).toBe(true)
    s.add(); s.authoring.captureStep(); s.add(); s.lock()
    expect(s.files.requestExport('update').allowed).toBe(false)
    expect(s.files.requestExport('saved-only').allowed).toBe(true)
  })
})

it('revalidates prepared imports and exports before committing or downloading', () => {
  const s = setup(); s.add(); s.authoring.captureStep()
  s.files.prepareImport(s.document())
  const before = s.state()
  s.validate.mockReturnValue({ allowed: false, reason: 'Policy rejected the snapshot.' })
  expect(s.files.confirmImport().allowed).toBe(false)
  expect(s.state()).toBe(before)
  expect(s.replace).not.toHaveBeenCalled()
  expect(s.files.requestExport('saved-only').allowed).toBe(false)
  expect(s.download).not.toHaveBeenCalled()
  expect(s.state()).toBe(before)
})
