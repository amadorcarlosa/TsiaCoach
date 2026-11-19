import { defineEventHandler, getHeader, getRequestURL, setResponseStatus } from 'h3'
import { telemetryBodyLimit, telemetryProxyPolicy } from '../../effect/telemetry-proxy'
import { readTelemetryBody } from '../../effect/telemetry-body'

// Deliberately bypass runServerEffect: exporter traffic must not trace itself.
export default defineEventHandler(async (event) => {
  const declared = Number(getHeader(event, 'content-length'))
  if (Number.isFinite(declared) && declared > telemetryBodyLimit) {
    setResponseStatus(event, 413)
    return
  }
  const policy = telemetryProxyPolicy({
    origin: getHeader(event, 'origin'),
    requestOrigin: getRequestURL(event).origin,
    contentType: getHeader(event, 'content-type'),
    bytes: 0,
  }, process.env)
  if (!policy.upstream) {
    event.node.req.resume()
    setResponseStatus(event, policy.status)
    return
  }
  const body = await readTelemetryBody(event.node.req, telemetryBodyLimit)
  if (!body) {
    setResponseStatus(event, 413)
    return
  }
  try {
    const response = await fetch(policy.upstream.url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-protobuf', ...policy.upstream.headers },
      body: body ? new Uint8Array(body) : undefined,
      signal: AbortSignal.timeout(policy.upstream.timeoutMillis),
      redirect: 'error',
    })
    // No collector error body or response headers are exposed to the browser.
    setResponseStatus(event, response.ok ? 204 : 502)
    await response.body?.cancel()
  } catch {
    setResponseStatus(event, 502)
  }
})
