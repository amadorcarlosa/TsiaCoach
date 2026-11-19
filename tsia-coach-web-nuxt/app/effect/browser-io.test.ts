import { Effect } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserIO, BrowserIOLive, copyText, readFile, readStoredText, writeStoredText } from './browser-io'
import { createResourceScope } from './scoped-resource'

afterEach(() => vi.unstubAllGlobals())

describe('browser I/O effects', () => {
  it('treats denied convenience storage as an absent saved board', () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('Denied') }, setItem() { throw new Error('Denied') } })
    expect(readStoredText('board')).toBeNull()
    expect(() => writeStoredText('board', 'value')).not.toThrow()
  })

  it('reports clipboard rejection through the typed failure channel', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('Denied')) } })
    const result = await Effect.runPromise(copyText('safe text').pipe(Effect.match({ onFailure: error => error.operation, onSuccess: () => 'success' })))
    expect(result).toBe('clipboard')
  })

  it('decodes file JSON and distinguishes malformed files', async () => {
    expect(await Effect.runPromise(readFile({ text: () => Promise.resolve('{"version":1}') } as File))).toEqual({ version: 1 })
    const result = await Effect.runPromise(readFile({ text: () => Promise.resolve('{') } as File).pipe(Effect.match({ onFailure: error => error.operation, onSuccess: () => 'success' })))
    expect(result).toBe('file-json')
  })

  it('revokes a download URL once when its component closes before the delay', () => {
    vi.useFakeTimers()
    try {
      const revoke = vi.fn()
      const click = vi.fn(), remove = vi.fn()
      vi.stubGlobal('URL', { createObjectURL: () => 'blob:owned', revokeObjectURL: revoke })
      vi.stubGlobal('document', { createElement: () => ({ click, remove }), body: { append: vi.fn() } })
      const resources = createResourceScope()
      Effect.runSync(Effect.flatMap(BrowserIO, io => io.download({ value: { version: 1 }, filename: 'level.json', resources })).pipe(Effect.provide(BrowserIOLive)))
      expect(click).toHaveBeenCalledOnce()
      expect(remove).toHaveBeenCalledOnce()
      resources.close()
      vi.runAllTimers()
      expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:owned')
    } finally { vi.useRealTimers() }
  })
})
