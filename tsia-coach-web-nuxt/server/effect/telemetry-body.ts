import { Buffer } from 'node:buffer'
import type { IncomingMessage } from 'node:http'

/** Stop retaining bytes at the limit; drain excess input without buffering it. */
export function readTelemetryBody(request: IncomingMessage, limit: number): Promise<Buffer | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let bytes = 0
    const cleanup = () => {
      request.off('data', data)
      request.off('end', end)
      request.off('error', error)
      request.off('aborted', aborted)
    }
    const error = (cause: Error) => { cleanup(); reject(cause) }
    const aborted = () => error(new DOMException('Request cancelled.', 'AbortError'))
    const end = () => { cleanup(); resolve(Buffer.concat(chunks, bytes)) }
    const data = (value: Buffer | string) => {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value)
      bytes += chunk.byteLength
      if (bytes > limit) {
        cleanup()
        request.resume()
        resolve(undefined)
      } else chunks.push(chunk)
    }
    request.on('data', data)
    request.once('end', end)
    request.once('error', error)
    request.once('aborted', aborted)
  })
}
