import { Effect, Schema } from 'effect'
import type { H3Event } from 'h3'
import type { components } from '#server/types/schema'
import type { AttemptProjection } from '#shared/types/sample-items'
import { backendApiFor } from '#server/effect/backend'
import { runServerEffect } from '#server/effect/runtime'

type StartAttemptRequest = components['schemas']['StartAttemptRequest']
type CheckAnswerRequest = components['schemas']['CheckAnswerRequest']

export const StartAttemptRequestSchema = Schema.Struct({ practiceItemId: Schema.String })
export const CheckAnswerRequestSchema = Schema.Struct({ selectedAnswerId: Schema.String })

export function startAttemptEffect(event: H3Event, request: StartAttemptRequest) {
  return backendApiFor(event).request<AttemptProjection>({
    path: '/api/attempts', method: 'POST',
    body: { practiceItemId: request.practiceItemId },
    connectionMessage: 'Could not reach the attempts API.',
    fallbackMessage: 'Could not start attempt.',
  }).pipe(Effect.withSpan('Attempts.start'))
}

export function getAttemptEffect(event: H3Event, attemptId: string) {
  return backendApiFor(event).request<AttemptProjection>({
    path: `/api/attempts/${encodeURIComponent(attemptId)}`,
    connectionMessage: 'Could not reach the attempts API.',
    fallbackMessage: 'Could not load attempt.',
  }).pipe(Effect.withSpan('Attempts.get'))
}

export function checkAttemptEffect(event: H3Event, attemptId: string, request: CheckAnswerRequest) {
  return backendApiFor(event).request<AttemptProjection>({
    path: `/api/attempts/${encodeURIComponent(attemptId)}/checks`, method: 'POST',
    body: { selectedAnswerId: request.selectedAnswerId },
    connectionMessage: 'Could not reach the attempts API.',
    fallbackMessage: 'Could not check selected answer.',
  }).pipe(Effect.withSpan('Attempts.check'))
}

export function startAttempt(event: H3Event, request: StartAttemptRequest): Promise<AttemptProjection> {
  return runServerEffect(event, startAttemptEffect(event, request))
}

export function getAttempt(event: H3Event, attemptId: string): Promise<AttemptProjection> {
  return runServerEffect(event, getAttemptEffect(event, attemptId))
}

export function checkAttempt(event: H3Event, attemptId: string, request: CheckAnswerRequest): Promise<AttemptProjection> {
  return runServerEffect(event, checkAttemptEffect(event, attemptId, request))
}
