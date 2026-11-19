import { Effect } from 'effect'
import type { H3Event } from 'h3'
import { BackendConfigurationError, backendHttpError, type BackendError } from './errors'
import { requestBackend, type BackendRequest } from './transport'

export interface BackendOperation<T> extends BackendRequest<T> {
  readonly connectionMessage: string
  readonly fallbackMessage: string
  readonly missingStatus?: number
  readonly missingMessage?: string
  readonly includeProblem?: boolean
  readonly responseMessage?: (status: number, body: unknown) => string
}

/** Request-scoped configuration. This factory never captures learner state globally. */
export function backendApiFor(event: H3Event) {
  return {
    request<T>(operation: BackendOperation<T>) {
      return Effect.suspend(() => {
        const { apiUrl } = useRuntimeConfig(event)
        if (!apiUrl) {
          return Effect.fail(new BackendConfigurationError({
            status: operation.missingStatus ?? 500,
            message: operation.missingMessage
              ?? 'NUXT_API_URL is not configured. Start the application through Aspire.',
          }))
        }
        return requestBackend<T>(apiUrl, operation)
      }).pipe(Effect.mapError((error: BackendError) => backendHttpError(error, operation)))
    },
  }
}
