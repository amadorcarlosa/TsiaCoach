import { Data } from 'effect'

export class BackendConfigurationError extends Data.TaggedError('BackendConfigurationError')<{
  readonly status: number
  readonly message: string
}> {}

export class BackendConnectionError extends Data.TaggedError('BackendConnectionError')<{
  readonly cause: unknown
  readonly cancelled: boolean
}> {}

export class BackendResponseError extends Data.TaggedError('BackendResponseError')<{
  readonly status: number
  readonly body: unknown
}> {}

export class BackendPayloadError extends Data.TaggedError('BackendPayloadError')<{
  readonly message: string
}> {}

export type BackendError = BackendConfigurationError | BackendConnectionError
  | BackendResponseError | BackendPayloadError

/** Keep H3 errors in the typed error channel. */
export function httpError(input: { statusCode: number; statusMessage: string; data?: unknown }): Error & { statusCode: number } {
  // Some adapters throw immediately, while H3 itself returns the error value.
  try { return Object.assign(createError(input), { statusCode: input.statusCode }) }
  catch (error) { return error as Error & { statusCode: number } }
}

export function problemTitle(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || !('title' in body)) return undefined
  return typeof body.title === 'string' ? body.title : undefined
}

export function backendHttpError(error: BackendError, options: {
  connectionMessage: string
  fallbackMessage: string
  responseMessage?: (status: number, body: unknown) => string
  includeProblem?: boolean
}): Error & { statusCode: number } {
  switch (error._tag) {
    case 'BackendConfigurationError':
      return httpError({ statusCode: error.status, statusMessage: error.message })
    case 'BackendConnectionError':
      return httpError({ statusCode: 502, statusMessage: options.connectionMessage })
    case 'BackendPayloadError':
      return httpError({ statusCode: 502, statusMessage: error.message })
    case 'BackendResponseError':
      return httpError({
        statusCode: error.status,
        statusMessage: options.responseMessage?.(error.status, error.body)
          ?? problemTitle(error.body) ?? options.fallbackMessage,
        ...(options.includeProblem === false ? {} : { data: error.body }),
      })
  }
}
