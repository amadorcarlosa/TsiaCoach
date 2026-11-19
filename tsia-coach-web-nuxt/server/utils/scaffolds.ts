import { Effect } from 'effect'
import type { H3Event } from 'h3'
import type { Scaffold } from '#shared/types/scaffolds'
import { backendApiFor } from '#server/effect/backend'
import { runServerEffect } from '#server/effect/runtime'

export function getScaffoldsEffect(event: H3Event) {
  return backendApiFor(event).request<Scaffold[]>({
    path: '/api/scaffolds',
    connectionMessage: 'Could not reach the scaffold API.',
    fallbackMessage: 'Could not load scaffolds.',
  }).pipe(Effect.withSpan('Scaffolds.list'))
}
export function getScaffoldByIdEffect(event: H3Event, id: string) {
  return backendApiFor(event).request<Scaffold>({
    path: `/api/scaffolds/${encodeURIComponent(id)}`,
    connectionMessage: 'Could not reach the scaffold API.',
    fallbackMessage: 'Could not load scaffold.',
  }).pipe(Effect.withSpan('Scaffolds.get'))
}
export function getScaffolds(event: H3Event): Promise<Scaffold[]> {
  return runServerEffect(event, getScaffoldsEffect(event))
}
export function getScaffoldById(event: H3Event, id: string): Promise<Scaffold> {
  return runServerEffect(event, getScaffoldByIdEffect(event, id))
}
