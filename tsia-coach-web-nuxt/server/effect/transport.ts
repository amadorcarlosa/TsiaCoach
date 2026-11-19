import { Effect } from 'effect'
import { traceHeaders } from '#shared/effect/trace'
import { BackendConnectionError, BackendPayloadError, BackendResponseError, type BackendError } from './errors'

export interface BackendRequest<T> {
  readonly path: string
  readonly method?: 'GET' | 'POST'
  readonly body?: unknown
  readonly timeout?: number
  readonly validate?: (body: unknown) => body is T
  readonly invalidResponseMessage?: string
}

export interface BackendFetchResponse {
  readonly status: number
  readonly _data?: unknown
}

export type BackendFetch = (path: string, options: {
  baseURL: string
  method: 'GET' | 'POST'
  body?: unknown
  timeout?: number
  ignoreResponseError: true
  retry: 0
  signal: AbortSignal
  headers: Record<string, string>
}) => Promise<BackendFetchResponse>

function isTransient(error: BackendError): boolean {
  return error._tag === 'BackendConnectionError'
    ? !error.cancelled
    : error._tag === 'BackendResponseError'
      && (error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500)
}

/** One transport owns retries and client spans; ofetch's nested retry policy is disabled. */
export function requestBackend<T>(baseURL: string, request: BackendRequest<T>,
  fetch: BackendFetch = (path, options) => $fetch.raw(path, {
    ...options, body: options.body as Record<string, unknown> | undefined,
  }),
): Effect.Effect<T, BackendError> {
  const method = request.method ?? 'GET'
  const execute = Effect.tryPromise({
    try: signal => fetch(request.path, {
      baseURL, method,
      ...(request.body === undefined ? {} : { body: request.body }),
      ...(request.timeout === undefined ? {} : { timeout: request.timeout }),
      ignoreResponseError: true,
      retry: 0,
      signal,
      headers: traceHeaders(),
    }),
    catch: cause => new BackendConnectionError({
      cause,
      cancelled: cause instanceof Error && (cause.name === 'AbortError' || cause.name === 'CanceledError'),
    }),
  }).pipe(Effect.flatMap((response): Effect.Effect<T, BackendResponseError | BackendPayloadError> => {
    if (response.status < 200 || response.status >= 300) {
      return Effect.fail(new BackendResponseError({ status: response.status, body: response._data }))
    }
    if (request.validate && !request.validate(response._data)) {
      return Effect.fail(new BackendPayloadError({
        message: request.invalidResponseMessage ?? 'The API returned an invalid response.',
      }))
    }
    return Effect.succeed(response._data as T)
  }))

  return execute.pipe(
    Effect.withSpan(`backend.${method.toLowerCase()}`, {
      kind: 'client',
      attributes: { 'http.request.method': method },
    }),
    Effect.retry({ times: method === 'GET' ? 1 : 0, while: isTransient }),
  )
}
