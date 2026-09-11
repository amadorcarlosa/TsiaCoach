import type { LevelDocumentV1 } from './level-document'
/** Application-owned limit, checked before reading the file. */
export const MAX_LEVEL_FILE_BYTES = 2 * 1024 * 1024
export async function readLevelFile(file: File): Promise<unknown> {
  const text = await file.text()
  return JSON.parse(text) as unknown
}
export function downloadLevel(document: LevelDocumentV1): void {
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = `${document.board.kind}-level.json`
  window.document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
