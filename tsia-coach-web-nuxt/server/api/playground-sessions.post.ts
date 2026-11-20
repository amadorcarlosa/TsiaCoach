import { Effect } from 'effect'
import { defineEventHandler, getHeader, getRequestURL, setResponseStatus } from 'h3'
import { startPlaygroundSession } from '#shared/effect/playground-events'
import { requestBody } from '#server/effect/input'
import { httpError } from '#server/effect/errors'
import { playgroundEventPolicy, startPlaygroundSessionEffect } from '#server/effect/playground-events'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(async (event) => {
  const policy = playgroundEventPolicy({
    enabled: useRuntimeConfig(event).public.playgroundEventsEnabled === true,
    origin: getHeader(event, 'origin'),
    requestOrigin: getRequestURL(event).origin,
    contentType: getHeader(event, 'content-type'),
  })
  if (policy.status !== 200) {
    event.node.req.resume()
    setResponseStatus(event, policy.status)
    return null
  }
  const session = await runServerEffect(event, Effect.gen(function* () {
    const parsed = startPlaygroundSession.safeParse(yield* requestBody(event))
    if (!parsed.success) {
      return yield* Effect.fail(httpError({ statusCode: 400, statusMessage: 'Invalid playground session request.' }))
    }
    return yield* startPlaygroundSessionEffect(event, parsed.data)
  }))
  setResponseStatus(event, 201)
  return session
})
