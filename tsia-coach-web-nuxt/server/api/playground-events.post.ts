import { Effect } from 'effect'
import { defineEventHandler, getHeader, getRequestURL, setResponseStatus } from 'h3'
import { MAX_BATCH_BYTES, playgroundEventBatch } from '#shared/effect/playground-events'
import { httpError } from '#server/effect/errors'
import { appendPlaygroundEventsEffect, playgroundEventLimiter, playgroundEventPolicy } from '#server/effect/playground-events'
import { readTelemetryBody } from '#server/effect/telemetry-body'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(async (event) => {
  const policy = playgroundEventPolicy({
    enabled: useRuntimeConfig(event).public.playgroundEventsEnabled === true,
    origin: getHeader(event, 'origin'),
    requestOrigin: getRequestURL(event).origin,
    contentType: getHeader(event, 'content-type'),
  })
  const declared = Number(getHeader(event, 'content-length'))
  const status = policy.status !== 200 ? policy.status
    : Number.isFinite(declared) && declared > MAX_BATCH_BYTES ? 413
    : 200
  if (status !== 200) {
    event.node.req.resume()
    setResponseStatus(event, status)
    return null
  }
  const bytes = await readTelemetryBody(event.node.req, MAX_BATCH_BYTES)
  if (!bytes) {
    setResponseStatus(event, 413)
    return null
  }

  await runServerEffect(event, Effect.gen(function* () {
    const json = yield* Effect.try({
      try: () => JSON.parse(bytes.toString('utf8')) as unknown,
      catch: () => httpError({ statusCode: 400, statusMessage: 'Playground events must be JSON.' }),
    })
    const parsed = playgroundEventBatch.safeParse(json)
    if (!parsed.success) {
      // Field paths only; learner payloads are never echoed back.
      return yield* Effect.fail(httpError({
        statusCode: 400,
        statusMessage: 'Invalid playground events.',
        data: { issues: parsed.error.issues.map(issue => issue.path.join('.')).slice(0, 20) },
      }))
    }
    if (!playgroundEventLimiter.take(parsed.data.sessionId, parsed.data.events.length)) {
      return yield* Effect.fail(httpError({ statusCode: 429, statusMessage: 'Too many playground events.' }))
    }
    yield* appendPlaygroundEventsEffect(event, parsed.data)
  }))
  setResponseStatus(event, 204)
  return null
})
