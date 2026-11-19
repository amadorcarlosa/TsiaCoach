import { Effect } from 'effect'
import type { H3Event } from 'h3'
import type { SampleItem } from '#shared/types/sample-items'
import { backendApiFor } from '#server/effect/backend'
import { runServerEffect } from '#server/effect/runtime'

export function getSampleItemsEffect(event: H3Event) {
  return backendApiFor(event).request<SampleItem[]>({
    path: '/api/sample-questions',
    connectionMessage: 'Could not reach the sample item API.',
    fallbackMessage: 'Could not load sample items.',
  }).pipe(Effect.withSpan('SampleItems.list'))
}
export function getSampleItemByIdEffect(event: H3Event, id: string) {
  return backendApiFor(event).request<SampleItem>({
    path: `/api/sample-questions/${encodeURIComponent(id)}`,
    connectionMessage: 'Could not reach the sample item API.',
    fallbackMessage: 'Could not load sample item.',
  }).pipe(Effect.withSpan('SampleItems.get'))
}
export function getSampleItems(event: H3Event): Promise<SampleItem[]> {
  return runServerEffect(event, getSampleItemsEffect(event))
}
export function getSampleItemById(event: H3Event, id: string): Promise<SampleItem> {
  return runServerEffect(event, getSampleItemByIdEffect(event, id))
}
