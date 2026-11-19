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
  reason?: string       // rejection reason (authored text from build(), not learner text)
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
- Storage: current stores are in-memory (`InMemoryAttemptStore` etc.). Start with `InMemoryPlaygroundEventStore` behind an interface; choose durable storage (Postgres/Cosmos/Table) as a separate decision before production — **this is the key open decision**.

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

## Open decisions

- Durable store choice and retention period.
- Whether dev/authoring playgrounds log at all, or only learner-facing ones.
- Whether any free text is ever stored.
- Consent model for minors (TSIA learners).
