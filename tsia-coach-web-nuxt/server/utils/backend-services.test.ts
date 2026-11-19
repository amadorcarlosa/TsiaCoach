import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { getRodCatalog, getAlgebraTileCatalog, getBaseTenBlockCatalog } from './catalogs'
import { getModels } from './models'
import { getSampleItems } from './sample-items'
import { getScaffolds } from './scaffolds'
import { postAgentRequest } from './agent'
import { postDecision } from './decisions'

const event = {} as H3Event
const raw = vi.fn()

describe('Effect backend service contracts', () => {
  beforeEach(() => {
    raw.mockReset()
    vi.stubGlobal('$fetch', { raw })
    vi.stubGlobal('useRuntimeConfig', () => ({ apiUrl: 'https://api.example.invalid' }))
    vi.stubGlobal('createError', (input: { statusCode: number; statusMessage: string; data?: unknown }) =>
      Object.assign(new Error(input.statusMessage), input))
  })
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    [getRodCatalog, '/api/rods'],
    [getAlgebraTileCatalog, '/api/algebra-tiles'],
    [getBaseTenBlockCatalog, '/api/base-ten-blocks'],
    [getModels, '/api/models'],
    [getSampleItems, '/api/sample-questions'],
    [getScaffolds, '/api/scaffolds'],
  ] as const)('forwards a catalog read through the configured backend', async (load, path) => {
    raw.mockResolvedValue({ status: 200, _data: [] })
    await expect(load(event)).resolves.toEqual([])
    expect(raw).toHaveBeenCalledWith(path, expect.objectContaining({ baseURL: 'https://api.example.invalid', method: 'GET', retry: 0 }))
  })

  it.each([
    [getRodCatalog, 503], [getAlgebraTileCatalog, 503], [getBaseTenBlockCatalog, 503],
    [getModels, 500], [getSampleItems, 500], [getScaffolds, 500],
  ] as const)('preserves the existing missing-configuration status', async (load, statusCode) => {
    vi.stubGlobal('useRuntimeConfig', () => ({ apiUrl: '' }))
    await expect(load(event)).rejects.toMatchObject({ statusCode })
    expect(raw).not.toHaveBeenCalled()
  })

  it('retains agent text, model, and token fields and forwards only the declared request', async () => {
    const response = { text: 'Ready.', model: 'model-1', inputTokens: 3, outputTokens: 2 }
    raw.mockResolvedValue({ status: 200, _data: response })
    await expect(postAgentRequest(event, { model: 'model-1', prompt: 'hello', instructions: 'help', history: [] }))
      .resolves.toEqual(response)
    expect(raw.mock.calls[0]?.[1].body).toEqual({ model: 'model-1', prompt: 'hello', instructions: 'help', history: [] })
  })

  it('maps a malformed configured URL to the safe connection failure', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ apiUrl: 'not a URL' }))
    raw.mockRejectedValue(new TypeError('Invalid URL'))
    await expect(getModels(event)).rejects.toMatchObject({
      statusCode: 502,
      message: 'Could not reach the model API.',
    })
    expect(raw).toHaveBeenCalledTimes(2)
  })

  it('rejects an invalid agent success response with a safe 502', async () => {
    raw.mockResolvedValue({ status: 200, _data: { text: 15, secret: 'provider details' } })
    await expect(postAgentRequest(event, { model: 'model-1', prompt: 'hello', instructions: 'help', history: [] }))
      .rejects.toMatchObject({ statusCode: 502, message: 'The agent API returned an invalid response.' })
    expect(raw).toHaveBeenCalledTimes(1)
  })

  it('retains the decision timeout and minimizes the paid request', async () => {
    raw.mockResolvedValue({ status: 200, _data: { accepted: true } })
    await postDecision(event, { state: { board: 'one' }, instructions: 'evaluate' })
    expect(raw).toHaveBeenCalledWith('/api/decisions', expect.objectContaining({
      method: 'POST', timeout: 35_000, retry: 0,
      body: { state: { board: 'one' }, instructions: 'evaluate' },
    }))
  })

  it('does not retry paid decision requests after an upstream failure', async () => {
    raw.mockResolvedValue({ status: 503, _data: { title: 'Not ready' } })
    await expect(postDecision(event, { state: {}, instructions: 'evaluate' }))
      .rejects.toMatchObject({ statusCode: 503, message: 'Not ready' })
    expect(raw).toHaveBeenCalledTimes(1)
  })
})
