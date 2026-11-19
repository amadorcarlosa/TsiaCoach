import type { LevelDocumentV1 } from './level-document'
import { BrowserIO, BrowserIOLive, readFile } from '~/effect/browser-io'
import { createResourceScope, type ResourceScope } from '~/effect/scoped-resource'
import { runBrowserEffect } from '~/effect/runtime'
import { Effect } from 'effect'
/** Application-owned limit, checked before reading the file. */
export const MAX_LEVEL_FILE_BYTES = 2 * 1024 * 1024
export function readLevelFile(file: File, signal?: AbortSignal): Promise<unknown> {
  return runBrowserEffect(readFile(file), { name: 'files.read', signal })
}
export function downloadLevel(document: LevelDocumentV1, owner?: ResourceScope): void {
  const resources = createResourceScope()
  owner?.defer(resources.close)
  // Keep download initiation synchronous, within the browser's user gesture.
  Effect.runSync(Effect.flatMap(BrowserIO, io => io.download({
    value: document, filename: `${document.board.kind}-level.json`, resources,
  })).pipe(Effect.provide(BrowserIOLive)))
}
