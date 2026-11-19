import { initializeServerTelemetry, closeServerTelemetry } from '../effect/telemetry'

export default defineNitroPlugin(async (nitro) => {
  await initializeServerTelemetry()
  nitro.hooks.hook('close', closeServerTelemetry)
})
