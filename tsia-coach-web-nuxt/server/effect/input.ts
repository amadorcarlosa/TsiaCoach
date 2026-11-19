import { Effect } from 'effect'
import type { H3Event } from 'h3'
import { httpError } from './errors'

export function requestBody(event: H3Event) {
  return Effect.tryPromise({ try: () => readBody<unknown>(event), catch: error => error })
}

export function routeParameter(event: H3Event, name: string, missingMessage: string) {
  return Effect.try({
    try: () => {
      const value = getRouterParam(event, name)
      if (!value) throw httpError({ statusCode: 400, statusMessage: missingMessage })
      return value
    },
    catch: error => error,
  })
}

export function parseInput<A>(input: unknown, parse: (input: unknown) => A) {
  return Effect.try({ try: () => parse(input), catch: error => error })
}
