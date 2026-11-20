# Plan: playground action log for agents

Goal: record meaningful learner actions in each playground so an agent (coach, `/api/agent`, analytics) can reason about *what the student did*, separate from operational tracing.

## Principles

- **Semantic, not pointer-level.** Log committed actions (`apply` succeeded or was rejected), never drag frames or hovers.
- **One hook per scene.** Every manipulative already funnels changes through a typed `apply(ids, action)`; instrument there, not in each component.
- **Allowlisted payloads.** Each event type has an Effect Schema; no free text unless the type explicitly allows it (and then length-limited).
- **Telemetry stays separate.** Tracing = ops health (sampled, stripped). Action log = product data (complete, structured, queryable). Events carry `traceId` only for correlation.
- **The C# API is the owner.** Events are stored against an attempt/session there, like other learner state.

## 1. Event envelope (shared/effect/playground-events.ts)

```ts
PlaygroundEvent = {
  id: string            // uuid, client-generated, for idempotent retries
  sessionId: string     // playground session (see §4)
  playground: 'bar-rod' | 'array-rod' | 'fraction-rod' | 'math-tabla' | 'systems'
            | 'rod-count-systems' | 'base-ten' | 'algebra-tiles' | 'scaffold' | 'rod-canvas'
  seq: number           // monotonic per session, preserves order
  at: string            // ISO timestamp
  traceId?: string
  type: <per-playground literal>
  outcome: 'applied' | 'rejected'
  reason?: string       // rejection code derived from the authored text (see reasonCode), never prose
  data: <per-type schema>   // e.g. { pieceIds, pieceKinds, counts, from, to }
  sceneSummary?: <small derived state>  // e.g. rod counts by value, tile totals; never full scene
}
```

Event types map directly onto the existing action unions:

| Playground | Hook (existing) | Event types |
|---|---|---|
| Bar / Array / Fraction / MathTabla rods | `useRodScene.apply` (`useRodScene.ts:792`), `useSceneInteraction.settleMove` (`:101`) | `piece.created/moved/deleted`, `rods.grouped`, `regroup-addends`, `regroup-factors`, `regroup-area`, `make-rectangle`, `zero-pair.cancelled`, `rotated` |
| Systems of equations / rod count | `useRodScene.apply`, `useSystemsCountActivity` (`:192-277`), `useCountConversionWorkspace.apply` (`:133`) | above + `arrange.x-then-y`, `count.rod-added/removed`, `denomination.converted`, `system.correctness-evaluated` |
| Base ten | `useBaseTenScene.apply` (`:127`) | `block.placed/moved/deleted/rotated`, `exchange.regrouped` |
| Algebra tiles | `useAlgebraTileScene.apply` (`:132`) | `tile.added/moved/rotated/duplicated/deleted`, `terms.combined`, `zero-pair.cancelled` |
| Scaffold grid | `scaffold-session.ts` `submit` / `askCoach` | `step.checked` (server outcome), `step.advanced`, `coach.asked` (question length only, or text if consented) |
| Goals / authoring (dev) | `BoardGoalEditor.vue:46-56`, `useAuthoringControls.ts`, `useLevelFiles` | `goal.met`, `level.imported/exported` (authoring only; off for learners) |
| Selection | `select()` in each scene, `useSceneMarquee` | `selection.changed` — debounced, optional, off by default |

## 2. Client service (app/effect/playground-events.ts)

- `PlaygroundEvents` Effect service: `record(event) : Effect<void>` — never fails the UI.
- Implementation: an Effect `Queue` drained by a fiber that batches (e.g. 25 events or 2 s), sends `POST /api/playground-events`, retries with backoff on transient failures, flushes on `pagehide` via `navigator.sendBeacon`.
- Lives in the per-app `WorkflowContext` (not module-global), disposed with it; no-op on SSR.
- Thin helper `instrumentScene(scene, playground)` wraps a scene's `apply`/`settleMove` and records `{ type: action.type, outcome, reason, data }`. Each playground opts in with one line where its scene is created.
- Feature flag `runtimeConfig.public.playgroundEventsEnabled` (default false).

## 3. Nuxt route (server/api/playground-events.post.ts)

- `runServerEffect` adapter; decode batch with the shared schema (strict, max batch size/bytes); forward to C# via `backendApiFor(event)` (POST, no auto-retry; client owns retries, `id` makes it idempotent).
- Same-origin check like the telemetry proxy; rate limit per session.

## 4. C# API

- `POST /api/playground-sessions` → `{ sessionId }` (optionally linked to `attemptId` / scaffold `sessionId` / level id).
- `POST /api/playground-sessions/{id}/events` → append, dedupe by event `id`, order by `seq`.
- `GET /api/playground-sessions/{id}/events?since=seq` and `GET .../summary` for agents.
- `IPlaygroundEventStore` supports in-memory development and durable storage on Turso Cloud. See [Playground event storage](#playground-event-storage) for setup.

## 5. Agent consumption

- **Coaching:** server-side, the coach handler fetches the recent event summary for the attempt and adds it to the prompt context (the browser never sends it, so it can't be forged).
- **`/api/agent` + CoachPlayground:** include `recentEvents` / `sceneSummary` alongside the captured board.
- **Summary projection** (server): counts per action type, rejections and their reasons, time on task, last N events, "stuck" signals (e.g. same rejection 3×). Agents should read summaries, not raw streams.

## 6. Privacy & governance

- No names/emails/IDs from auth in events; session id is opaque.
- Free text (scaffold question, coach messages) excluded by default; if needed, separate consented event type with length limit and retention.
- Retention policy and deletion by session id; document in `docs/architecture/`.

## 7. Phasing

1. Envelope + schemas + client service + Nuxt route + C# in-memory store; instrument **algebra tiles** and **base ten** (smallest `apply` surfaces). Unit tests: schema rejection of unknown fields, batching/flush, idempotent append, ordering.
2. Rod scenes (bar/array/fraction/MathTabla) via `useRodScene.apply` + `settleMove`.
3. Systems + rod-count (count activity, conversions, correctness evaluation).
4. Scaffold events tied to attempt/session; coach prompt uses the server summary.
5. Durable storage, retention, dashboard/export; enable flag in production.

## Implementation status (2026-11-19)

Phases 1–5 are built; the log is **off by default** (`NUXT_PUBLIC_PLAYGROUND_EVENTS_ENABLED=true` turns it on).

| Piece | Where |
|---|---|
| Envelope, per-playground type allowlist, batch and session schemas | `tsia-coach-web-nuxt/shared/effect/playground-events.ts` |
| Client log: dropping `Queue` (1000) drained by one fiber, 25 events or 2 s, one request per session, exponential retry on transient failures, refused batches dropped, `sendBeacon` on `pagehide` | `tsia-coach-web-nuxt/app/effect/playground-events.ts` |
| Scene describers and `apply` wrapper (`events.during` folds several edits into one event) | `tsia-coach-web-nuxt/app/components/playground/events/scene-events.ts` |
| `instrumentScene(scene, playground)` / `usePlaygroundRecorder` | `tsia-coach-web-nuxt/app/composables/usePlaygroundEvents.ts` |
| Nuxt routes: `POST /api/playground-sessions`, `POST /api/playground-events` (flag gate, same-origin JSON, 256 KiB, 600 events/min per session) | `tsia-coach-web-nuxt/server/api/`, `server/effect/playground-events.ts` |
| C# store (`IPlaygroundEventStore`, in memory: 5,000 events per session, 10,000 sessions, oldest evicted), summary projection, endpoints | `TsiaCoach.WebApi/PlaygroundEvents/`, `EndPoints/PlaygroundSessionEndpoints.cs` |

Instrumented: algebra tiles, base ten, bar, array, fraction, MathTabla, systems and rod-count systems. Drags are covered because `settleMove` commits through `apply`; zero-distance moves are skipped. Rod-count "+x/−x" and in-order clone record one `count.rod-added` / `count.rod-removed` / `piece.duplicated` event each. Board transforms map to `denomination.converted` and `arrange.x-then-y`. `system.correctness-evaluated` is recorded when the board starts or stops satisfying the system. Draft edits inside the conversion workspace are not logged, only the committed conversion.

Differences from the plan above:

- `data` is one strict allowlist shared by every type, not a schema per type. Its strings must be identifier tokens with no spaces, so free text cannot get in. `reason` is a rejection code: the recorder reduces the scene's authored text with `reasonCode` (lowercase words and hyphens, numbers become `n`, at most 64 characters), so `Select exactly 8 x rods; 3 selected.` is sent as `select-exactly-n-x-rods-n-selected`. Local `recent()` history keeps the readable text.
- The API repeats every check (`PlaygroundEventSchema`): the type per playground, each `data` field and its shape, and the reason-code pattern. It does not trust Nuxt.
- A batch carries one `sessionId`; the Nuxt route forwards it to `POST /api/playground-sessions/{id}/events`.
- Events recorded before the session has opened cannot go out by beacon, so if the page closes in the first moments those events are lost.
- The summary's stuck signal is the same refusal (type and reason) three or more times with no later success of that type. Time on task adds the gaps between events, each capped at 5 minutes.
- The `GET` endpoints exist only on the API; the browser cannot read events back.

**Phase 4.** The scaffold store (`app/pages/scaffolds/scaffold-session.ts`) opens one recorder per scaffold session, linked to its `attemptId` and `scaffoldSessionId`, and records:

- `step.checked`: the server's verdict. `outcome` is `rejected` when the move broke the step's rule, so repeated rule breaks become stuck signals. Data holds `stepId`, `satisfied` and the server outcome.
- `step.advanced`: the new step or `completed`, with the completed-step count.
- `coach.asked`: the step and the question's **length** only, with `answered` or `unanswered`. The question text is never logged.

Before a coach question the store calls `log.flush()`, which sends waiting events immediately (waiting at most 1 s), so the coach sees the latest checks.

On the API, `CoachingTurnService` reads the attempt's sessions (`PlaygroundActivityProjector.ForAttempt`) and passes a `playgroundActivity` block to every model-backed coach prompt. The block covers the newest 3 sessions that have events: counts per type, applied and rejected counts, time on task, the top 3 rejections, stuck signals, the last 5 actions (type, outcome and reason only) and the latest scene totals. It never includes event `data`, so piece, step and scaffold IDs stay out of the prompt, which matters because the probe prompt must not reveal step IDs. The system prompt says the block is context only and never changes the phase, allowed moves or IDs. With no linked activity, the field is omitted and prompts are unchanged.

**Attempt links.** A page calls `providePlaygroundLinks({ attemptId })` and every playground recorder below it links its session to that attempt (the API refuses unknown attempts). `/dev/playground?attemptId=<id>` does this for all tabs, so the coach's `playgroundActivity` includes manipulative work, not just scaffold checks.

**Coach playground and `/api/agent`.** Each instrumented scene keeps its last 20 actions in memory (`scene.events.recent()`), whether or not the log is on. Every rod tab's `capture()` returns them as `recentActions`, and the coach-playground prompt (and the decision state sent to `/api/decisions`) includes them beside the snapshot, with the same train IDs. Nothing is stored for this; it is part of the prompt the operator already sees.

## Phase 5: storage and governance (2026-11-20)

### Playground event storage

The durable store uses the **Turso Database engine on Turso Cloud (early preview)**. The API uses Turso’s managed .NET package, `Turso.Serverless.Client`, to execute SQL over HTTP. On first use it creates `playground_sessions` and `playground_events`. Each event has a composite primary key of `(session_id, id)` so a retried event is stored once. Timestamps use Unix milliseconds. [Turso Cloud engines](https://docs.turso.tech/turso-cloud) · [.NET client](https://www.nuget.org/packages/Turso.Serverless.Client/0.8.3)

To connect a local Aspire run to the preview, run these PowerShell commands from the repository root. The example uses the Turso CLI installed in WSL. For first-time setup, sign in after locating the CLI. [Turso Cloud quickstart](https://docs.turso.tech/quickstart)

```powershell
$turso = (wsl sh -lc 'command -v turso || realpath ~/.turso/turso').Trim()
wsl -- $turso auth login
```

Choose an available database name. The `--tursodb` flag selects the preview engine. This block configures Aspire after Turso creates the database and returns its HTTPS URL and database token. [Database URLs and tokens](https://docs.turso.tech/sdk/http/reference)

```powershell
& {
    $database = 'tsia-playground-dev'
    wsl -- $turso db create $database --tursodb
    if ($LASTEXITCODE -ne 0) { throw 'Turso could not create the preview database.' }

    $databaseUrl = wsl -- $turso db show $database --http-url
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($databaseUrl)) {
        throw 'Turso could not return the database URL.'
    }
    $databaseToken = wsl -- $turso db tokens create $database
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($databaseToken)) {
        throw 'Turso could not return a database token.'
    }

    @{
        'Parameters:turso-url' = $databaseUrl.Trim()
        'Parameters:turso-auth-token' = $databaseToken.Trim()
    } | ConvertTo-Json | dotnet user-secrets set --project TsiaCoach.AppHost
    if ($LASTEXITCODE -ne 0) { throw 'Could not save the Aspire settings.' }

    $env:NUXT_PUBLIC_PLAYGROUND_EVENTS_ENABLED = 'true'
    aspire start
}
```

- **Local development.** Aspire uses the hosted database when the `Parameters:turso-url` AppHost secret is set. With no URL, it uses the in-memory event store and sessions expire when the API restarts. (The old `Turso:Url` key is no longer read; rename it.)
- **Deployment.** The Aspire publish model requires a `turso-url` parameter and a secret `turso-auth-token` parameter. When running the API directly, set `PlaygroundEvents__Store=Turso`, `PlaygroundEvents__Turso__Url` to the HTTPS database URL, and `PlaygroundEvents__Turso__AuthToken` to its database token.
- **Store tests.** Point `TSIA_TEST_TURSO_URL` and `TSIA_TEST_TURSO_TOKEN` at a separate disposable preview database and run `dotnet test --project TsiaCoach.WebApi.Tests`. The contract suite exercises deletion and a database-wide retention sweep. With these settings absent, the default suite uses in-memory storage.

**Retention.** `PlaygroundEventRetentionService` deletes sessions, with their events, that started more than `PlaygroundEvents:RetentionDays` ago (default **180**; 0 keeps everything). It sweeps a minute after start, then every `RetentionSweepInterval` (1 day). The consent notice shows `runtimeConfig.public.playgroundEventsRetentionDays`; keep the two values equal.

**Deletion and export (API only; Nuxt does not proxy these):**

- `DELETE /api/playground-sessions/{id}` deletes one session and its events.
- `GET /api/playground-sessions/{id}/export` returns the session (including consent) and every event.
- `GET /api/playground-sessions/export?from=&to=` returns NDJSON, one line per session started in the range, each with its events.

**Consent: opt-in per browser** (`runtimeConfig.public.playgroundEventsConsent`, default `opt-in`; `not-required` when consent is handled outside the app, for example by school agreements).

- When the log is on, `PlaygroundEventsConsent` (on `/dev/playground` and the scaffold page) asks once. The choice is kept in `localStorage`.
- Until the learner allows it, recorders record nothing and open no session, so nothing leaves the browser. Declining keeps every playground usable.
- Sessions opened with consent are stored with `consent = 'granted'`.

**Free text: never.** Only identifier tokens, numbers and rejection codes are stored; for `coach.asked`, only the question length.

**Rate limits.** Events: 600 per session per minute (Nuxt). Session starts: 120 per client address and 1,200 overall per minute (Nuxt), plus `PlaygroundEvents:SessionStartsPerMinute` (default 1,200; 0 turns it off) on the API, so rotating sessions cannot get around the event budget.

Still open: hosting the production Turso database and setting its token; a learner-facing way to change the consent choice later; and an export or deletion request flow for families (the API endpoints exist; there is no UI).

## Open decisions

- Whether dev/authoring playgrounds log at all, or only learner-facing ones.
- Whether any free text is ever stored.
- Consent model for minors (TSIA learners).
