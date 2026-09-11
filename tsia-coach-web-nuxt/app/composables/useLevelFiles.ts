import { readonly, ref } from 'vue'
import type { useLevelAuthoring } from './useLevelAuthoring'
import type { AuthoringResult } from '~/components/playground/authoring.types'
import type { Validation } from '~/components/playground/goals/goal.types'
import { validateLevelDocument, type BoardDescriptor, type LevelDocumentAdapter, type LevelDocumentV1 } from '~/components/playground/files/level-document'
import { downloadLevel, MAX_LEVEL_FILE_BYTES, readLevelFile } from '~/components/playground/files/level-file-io'
export type ExportDecision = 'update' | 'saved-only' | 'cancel'
export type ImportPreview = { board: BoardDescriptor; stepCount: number }
type Options = {
  adapter: LevelDocumentAdapter
  authoring: ReturnType<typeof useLevelAuthoring>
  editable: () => boolean
  hasWorkingRods: () => boolean
  resolveDrafts: () => boolean
  onImported: () => void
  download?: (document: LevelDocumentV1) => void
}
export function useLevelFiles(options: Options) {
  const preview = ref<ImportPreview | null>(null)
  const message = ref('')
  const exportQuestion = ref<'dirty' | 'uncaptured' | null>(null)
  let prepared: LevelDocumentV1 | null = null
  let readVersion = 0
  function report<T extends AuthoringResult>(result: T): T {
    message.value = result.allowed ? '' : result.reason
    return result
  }
  function prepareImport(input: unknown): Validation<ImportPreview> {
    const parsed = validateLevelDocument(input, options.adapter)
    if (!parsed.allowed) return report(parsed)
    prepared = parsed.value
    // The publicly exposed preview never contains the private steps/goals.
    const value = { board: structuredClone(parsed.value.board), stepCount: parsed.value.steps.length }
    preview.value = value
    message.value = ''
    return { allowed: true, value: structuredClone(value) }
  }
  function confirmImport(): AuthoringResult {
    if (!options.editable()) return report({ allowed: false, reason: 'Editing is unavailable.' })
    if (!prepared) return report({ allowed: false, reason: 'Choose a valid level file first.' })
    const parsed = validateLevelDocument(prepared, options.adapter)
    if (!parsed.allowed) return report(parsed)
    if (!options.resolveDrafts()) return report({ allowed: false, reason: 'Resolve the goal draft before replacing the level.' })
    // Synchronous atomic commit: replacement failure leaves authoring state intact.
    const result = options.authoring.replaceSteps(parsed.value.steps)
    if (!result.allowed) return report(result)
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
