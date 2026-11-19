import { otlpSettings, type TelemetryEnvironment } from '#shared/effect/telemetry-config'

export const telemetryBodyLimit = 1024 * 1024

/** Fixed destination, fixed signal; browser headers cannot select an upstream. */
export function telemetryProxyPolicy(input: {
  origin: string | undefined
  requestOrigin: string
  contentType: string | undefined
  bytes: number
}, env: TelemetryEnvironment) {
  if (input.origin !== input.requestOrigin) return { status: 403 } as const
  if (input.contentType?.split(';')[0]?.trim() !== 'application/x-protobuf') return { status: 415 } as const
  if (input.bytes > telemetryBodyLimit) return { status: 413 } as const
  const upstream = otlpSettings(env, 'traces')
  if (!upstream) return { status: 204 } as const
  return { status: 200, upstream } as const
}
