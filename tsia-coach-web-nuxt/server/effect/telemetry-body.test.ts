import { Readable } from 'node:stream'
import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { readTelemetryBody } from './telemetry-body'

describe('bounded OTLP protobuf input', () => {
  it('preserves raw protobuf bytes across stream chunks', async () => {
    const request = Readable.from([Buffer.from([0, 255]), Buffer.from([1, 128])]) as IncomingMessage
    expect(await readTelemetryBody(request, 4)).toEqual(Buffer.from([0, 255, 1, 128]))
  })
  it('rejects oversized chunked bodies even without a content-length header', async () => {
    const request = Readable.from([Buffer.alloc(4), Buffer.alloc(4), Buffer.alloc(4)]) as IncomingMessage
    expect(await readTelemetryBody(request, 5)).toBeUndefined()
    expect(request.listenerCount('data')).toBe(0)
  })
})
