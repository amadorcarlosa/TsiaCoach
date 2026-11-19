import { Effect } from 'effect'
import type { H3Event } from 'h3'
import type { PracticeItemPrompt } from '#shared/types/sample-items'
import { backendApiFor } from '#server/effect/backend'
import { runServerEffect } from '#server/effect/runtime'

export function getPracticeItemsEffect(event: H3Event) {
  return backendApiFor(event).request<PracticeItemPrompt[]>({
    path: '/api/practice-items',
    connectionMessage: 'Could not reach the practice item API.',
    fallbackMessage: 'Could not load practice items.',
  }).pipe(Effect.withSpan('PracticeItems.list'))
}

export function getPracticeItemByIdEffect(event: H3Event, id: string) {
  return backendApiFor(event).request<PracticeItemPrompt>({
    path: `/api/practice-items/${encodeURIComponent(id)}`,
    connectionMessage: 'Could not reach the practice item API.',
    fallbackMessage: 'Could not load practice item.',
  }).pipe(Effect.withSpan('PracticeItems.get'))
}

export function getPracticeItems(event: H3Event): Promise<PracticeItemPrompt[]> {
  return runServerEffect(event, getPracticeItemsEffect(event))
}

export function getPracticeItemById(event: H3Event, id: string): Promise<PracticeItemPrompt> {
  return runServerEffect(event, getPracticeItemByIdEffect(event, id))
}
