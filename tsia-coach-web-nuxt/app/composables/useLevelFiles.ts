import { readonly, ref } from 'vue'
import type { useLevelAuthoring } from './useLevelAuthoring'
import type { AuthoringResult } from '~/components/playground/authoring.types'
import type { Validation } from '~/components/playground/goals/goal.types'
import { sameBoard, validateLevelDocument, type BoardDescriptor, type LevelDocumentAdapter, type LevelDocumentV1 } from '~/components/playground/files/level-document'
import { boardDescriptorSchema } from '~/components/playground/files/level-document.schema'
import { downloadLevel, MAX_LEVEL_FILE_BYTES, readLevelFile } from '~/components/playground/files/level-file-io'
export type ExportDecision = 'update' | 'saved-only' | 'cancel'
/** `resizesBoard`: confirming switches the playground to the file's board. */
export type ImportPreview = { board: BoardDescriptor; stepCount: number; resizesBoard: boolean }
/** Lets a playground take on an imported level's board, such as its size. */
export type BoardAdoption = {
  /** An adapter for `board`, or null when this playground cannot host it. */
  adapterFor: (board: BoardDescriptor) => LevelDocumentAdapter | null
  /** Switches the live playground to `board` and returns a function that switches back. */
  apply: (board: BoardDescriptor) => () => void
}
type Options = {
  adapter: LevelDocumentAdapter
  authoring: ReturnType<typeof useLevelAuthoring>
  editable: () => boolean
  hasWorkingRods: () => boolean
  resolveDrafts: () => boolean
  onImported: () => void
  download?: (document: LevelDocumentV1) => void
  adoptBoard?: BoardAdoption
}
export function useLevelFiles(options: Options) {
  const preview = ref<ImportPreview | null>(null)
  const message = ref('')
  const exportQuestion = ref<'dirty' | 'uncaptured' | null>(null)
  let prepared: { document: LevelDocumentV1; adapter: LevelDocumentAdapter } | null = null
  let readVersion = 0
  function report<T extends AuthoringResult>(result: T): T {
    message.value = result.allowed ? '' : result.reason
    return result
  }
  /** The current board's adapter, or one for the file's board when the playground can adopt it. */
  function adapterFor(input: unknown): LevelDocumentAdapter {
    if (!options.adoptBoard || typeof input !== 'object' || input === null) return options.adapter
    const board = boardDescriptorSchema.safeParse((input as { board?: unknown }).board)
    if (!board.success || sameBoard(board.data, options.adapter.board)) return options.adapter
    return options.adoptBoard.adapterFor(board.data) ?? options.adapter
  }
  function prepareImport(input: unknown): Validation<ImportPreview> {
    const adapter = adapterFor(input)
    const parsed = validateLevelDocument(input, adapter)
    if (!parsed.allowed) return report(parsed)
    prepared = { document: parsed.value, adapter }
    // The publicly exposed preview never contains the private steps/goals.
    const value = {
      board: structuredClone(parsed.value.board),
      stepCount: parsed.value.steps.length,
      resizesBoard: adapter !== options.adapter,
    }
    preview.value = value
    message.value = ''
    return { allowed: true, value: structuredClone(value) }
  }
  function confirmImport(): AuthoringResult {
    if (!options.editable()) return report({ allowed: false, reason: 'Editing is unavailable.' })
    if (!prepared) return report({ allowed: false, reason: 'Choose a valid level file first.' })
    const { adapter } = prepared
    const parsed = validateLevelDocument(prepared.document, adapter)
    if (!parsed.allowed) return report(parsed)
    if (!options.resolveDrafts()) return report({ allowed: false, reason: 'Resolve the goal draft before replacing the level.' })
    // Synchronous atomic commit: replacement failure leaves the board and
    // authoring state intact, including a board switch made for this file.
    const restore = adapter !== options.adapter && options.adoptBoard
      ? options.adoptBoard.apply(parsed.value.board)
      : null
    const result = options.authoring.replaceSteps(parsed.value.steps)
    if (!result.allowed) {
      restore?.()
      return report(result)
    }
    options.onImported()
    cancelImport()
    exportQuestion.value = null
    return report(result)
  }
  function cancelImport(): void {
    readVersion++
    prepared = null
    preview.value = null
    message.value = ''
  }
  async function selectFile(file: File): Promise<AuthoringResult> {
    const version = ++readVersion
    if (file.size > MAX_LEVEL_FILE_BYTES) return report({ allowed: false, reason: 'Level files must be 2 MiB or smaller.' })
    try {
      const input = await readLevelFile(file)
      if (version !== readVersion) return { allowed: false, reason: 'File reading cancelled.' }
      return prepareImport(input)
    } catch (error) {
      if (version !== readVersion) return { allowed: false, reason: 'File reading cancelled.' }
      return report({ allowed: false, reason: `Could not read level file: ${error instanceof Error ? error.message : 'Unknown file error.'}` })
    }
  }
  function requestExport(decision?: ExportDecision): AuthoringResult {
    if (decision === 'cancel') { exportQuestion.value = null; return report({ allowed: true }) }
    if (!options.resolveDrafts()) return report({ allowed: false, reason: 'Resolve the goal draft before exporting.' })
    const authoring = options.authoring
    if (authoring.steps.value.length === 0 && options.hasWorkingRods()) {
      exportQuestion.value = 'uncaptured'
      return report({ allowed: false, reason: 'The working board is not included. Capture a step before exporting.', needsDecision: true })
    }
    if (authoring.dirty.value) {
      if (!decision) {
        exportQuestion.value = 'dirty'
        return report({ allowed: false, reason: 'Choose how to export unsaved board changes.', needsDecision: true })
      }
      if (decision === 'update') {
        // Existing capture path cancels unfinished movement before saving.
        const result = authoring.updateStep()
        if (!result.allowed) return report(result)
      }
    }
    // Saved-only reads metadata and saved trains; it never captures/cancels/replaces.
    const parsed = validateLevelDocument({ version: 1, board: options.adapter.board, steps: authoring.steps.value }, options.adapter)
    if (!parsed.allowed) return report(parsed)
    ;(options.download ?? downloadLevel)(parsed.value)
    exportQuestion.value = null
    return report({ allowed: true })
  }
  function captureFirst(): AuthoringResult {
    const result = options.authoring.captureStep()
    return result.allowed ? requestExport() : report(result)
  }
  return { preview: readonly(preview), message: readonly(message), exportQuestion: readonly(exportQuestion), prepareImport, confirmImport, cancelImport, selectFile, requestExport, captureFirst }
}
