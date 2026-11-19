import { Context, Data, Effect, Layer } from 'effect'
import type { ResourceScope } from './scoped-resource'

export class BrowserIOError extends Data.TaggedError('BrowserIOError')<{
  operation: 'file-read' | 'file-json' | 'storage-read' | 'storage-write' | 'clipboard'
  cause: unknown
}> {
  override get message(): string {
    return this.cause instanceof Error ? this.cause.message : 'Browser operation failed.'
  }
}

type BrowserIOService = {
  readFile: (file: File) => Effect.Effect<unknown, BrowserIOError>
  readStorage: (key: string) => Effect.Effect<string | null, BrowserIOError>
  writeStorage: (key: string, value: string) => Effect.Effect<void, BrowserIOError>
  copyText: (text: string) => Effect.Effect<void, BrowserIOError>
  download: (input: { value: unknown; filename: string; resources: ResourceScope }) => Effect.Effect<void>
}

export class BrowserIO extends Context.Service<BrowserIO, BrowserIOService>()('TsiaCoach/BrowserIO') {}

export const BrowserIOLive = Layer.succeed(BrowserIO, {
  readFile: file => Effect.tryPromise({
    try: () => file.text(),
    catch: cause => new BrowserIOError({ operation: 'file-read', cause }),
  }).pipe(Effect.flatMap(text => Effect.try({
    try: () => JSON.parse(text) as unknown,
    catch: cause => new BrowserIOError({ operation: 'file-json', cause }),
  }))),
  readStorage: key => Effect.try({
    try: () => localStorage.getItem(key),
    catch: cause => new BrowserIOError({ operation: 'storage-read', cause }),
  }),
  writeStorage: (key, value) => Effect.try({
    try: () => localStorage.setItem(key, value),
    catch: cause => new BrowserIOError({ operation: 'storage-write', cause }),
  }),
  copyText: text => Effect.tryPromise({
    try: () => navigator.clipboard.writeText(text),
    catch: cause => new BrowserIOError({ operation: 'clipboard', cause }),
  }),
  download: ({ value, filename, resources }) => Effect.sync(() => {
    const url = resources.acquire(
      () => URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })),
      url => URL.revokeObjectURL(url),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    try {
      document.body.append(link)
      link.click()
    } catch (error) {
      resources.close()
      throw error
    } finally { link.remove() }
    resources.timer().schedule(resources.close, 1000)
  }),
})

export const readFile = (file: File) => Effect.flatMap(BrowserIO, io => io.readFile(file)).pipe(Effect.provide(BrowserIOLive))
export const copyText = (text: string) => Effect.flatMap(BrowserIO, io => io.copyText(text)).pipe(Effect.provide(BrowserIOLive))

/** Convenience persistence must never make a playground unusable. */
export const readStoredText = (key: string): string | null => Effect.runSync(
  Effect.flatMap(BrowserIO, io => io.readStorage(key)).pipe(Effect.catch(() => Effect.succeed(null)), Effect.provide(BrowserIOLive)),
)
export const writeStoredText = (key: string, value: string): void => Effect.runSync(
  Effect.flatMap(BrowserIO, io => io.writeStorage(key, value)).pipe(Effect.catch(() => Effect.void), Effect.provide(BrowserIOLive)),
)
