# TsiaCoach Nuxt application

Vue presentation and interactive math boards, Effect application services and I/O, and Atom Vue workflow state. The Nuxt backend-for-frontend calls the retained C# API. See the [Effect implementation and operations guide](../docs/architecture/effect-migration.md) and [application architecture](../docs/architecture/code-structure-and-patterns.md).

## Setup

Use Node **22.22.0** and the pnpm version declared in `package.json`. The runtime is pinned in `.nvmrc` and `pnpm-workspace.yaml`; the supported engine range is Node 22.19+ within 22.x. Scripts launched through pnpm use the pinned runtime, including Aspire's `WithPnpm()` launcher.

```powershell
pnpm install
pnpm exec node --version
```

Update both runtime pins together when changing Node versions, then rerun the checks below.

## Development

Start the application through Aspire from the repository root:

```powershell
$effectAppHost = (Resolve-Path .\TsiaCoach.AppHost\TsiaCoach.AppHost.csproj).Path
aspire start --apphost $effectAppHost --non-interactive
aspire wait api --apphost $effectAppHost --non-interactive
aspire wait web-nuxt --apphost $effectAppHost --non-interactive
aspire describe --apphost $effectAppHost --format Json --non-interactive
```

Read the API and Nuxt URLs from `describe`. Aspire supplies the private `NUXT_API_URL` and OpenTelemetry exporter configuration. Do not expose the backend address or exporter authentication headers in public runtime configuration.

For a standalone frontend process, set `NUXT_API_URL` to an already-running C# API before running `pnpm dev`. The development command runs unit and live contract tests before starting Nuxt, so that API must be reachable.

## Checks

Run from this directory:

```powershell
pnpm test
pnpm exec vue-tsc --noEmit
pnpm lint
$env:NUXT_API_URL = '<discovered-api-http-url>'
pnpm exec vitest run --config vitest.integration.config.ts
$env:PLAYWRIGHT_BASE_URL = '<discovered-nuxt-url>'
pnpm exec playwright test --config playwright.aspire.config.ts
```

The Aspire Playwright configuration uses existing services and writes artifacts under the repository's `output/effect-aspire/` folder. Its smoke test checks SSR hydration, a real answer check, and browser trace forwarding. See the operations guide for cross-service trace/log/metric verification.

## Production artifact

```powershell
pnpm build
pnpm exec node .output/server/index.mjs
```

`build` runs both unit and live contract suites before producing the Nitro Node server. Configure the production `NUXT_API_URL` and private OTLP environment variables for the server process. Set `NUXT_PUBLIC_TELEMETRY_ENABLED=true` only when browser trace export through the same-origin proxy is desired. Without an exporter endpoint, remote telemetry export is disabled and application workflows continue.

Browser sampling uses `NUXT_PUBLIC_TELEMETRY_SAMPLING_RATIO` from `0` to `1`, defaulting to `1`; empty or invalid values also use `1`. For matching production server-root sampling, set `OTEL_TRACES_SAMPLER=parentbased_traceidratio` and `OTEL_TRACES_SAMPLER_ARG` to the same ratio. Parent sampling decisions remain connected across services. Reload the browser page after changing its telemetry configuration.

Production deployment and monitoring-service provisioning are separate from building or locally starting this artifact.
