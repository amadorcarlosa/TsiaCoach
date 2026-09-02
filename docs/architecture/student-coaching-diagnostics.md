# Student Coaching Diagnostics

## Status
Accepted

## Slice 6 deterministic scaffold evaluation
- Learner submissions are modeled separately from authored `LearnerAction` values.
- `ScaffoldStepEvaluator` derives scaffold-step correctness from the scaffold, practice item, step id, and submitted evidence.
- Latent scalars, latent expressions, and correct answer ids remain evaluator inputs only.
- `ScaffoldStepEvaluation` outcomes contain only satisfied/not-satisfied state and no solution-bearing data.
- Expression evaluation in this slice compares a submitted known `MathObjectId` with the expected latent expression's authored math object.
- Authorized scaffold sessions now pin the latest authorizing attempt check and server-derived scaffold entry.
- Session history stores only scaffold submission facts and server timestamps; progress replays `ScaffoldStepEvaluator` and never stores correctness.
- Session checks can target only the derived current step, remain on that step when unsatisfied, advance one step when satisfied, and become terminal after the final satisfied step.
- Progress is `Steps[entryIndex..]`: the remainder of the flat path from the entry step.

## Slice 5 safe path
- `/sample-Items` now uses `PracticeItemPromptResponse` through Nuxt BFF endpoints at `/api/practice-items` and attempt routes.
- Server-side attempts drive all correctness and phase transitions.
- Practice item prompt payloads on the student surface no longer expose answer keys or `latentFacts` (`correctAnswerId` and `semantics.latentFacts` are no longer sent to the student page).
- Feedback now comes from returned attempt `phase` (`beforeCheck`, `afterIncorrectCheck`, `afterCorrectCheck`) and transport state only.
- The scaffold walkthrough is still backed by the legacy solution-bearing prompt contract via `/api/sample-items` and the legacy `PracticeItemResponse`; its direct `QuestionInteractionResponse` remains unchanged.
- Removal of the scaffold exposure remains deferred to server-side scaffold evaluation/session slices.

## Diagnostic model
- Practice items author `AnswerChoiceId → MisconceptionCode`.
- `PracticeItem.Evaluate` derives `CheckOutcome`.
- `CheckResult` will store submission facts only.
- A future operation-path evaluator may replace the authored map without changing `CheckOutcome`.

## The scaffold is one flat path (decompress, act, recompress)

Every practice item compresses math a student is assumed to already hold. The scaffold is that latent math written out as **one ordered path of steps**, the full path a student who knows nothing would need. The student acts on rods at each step, then recompresses what they built back into symbols.

- `Scaffold.Steps` is a flat list. Every step has an id, a `ScaffoldPhasePurpose` label, a prompt, a done condition (`SuccessCheck`), and a scene that renders from resources alone. There is no step that depends on a previous step's scene state; `ContinuedScene` and `CanStartCold` no longer exist. Purpose is a label on the step, not a container that routes.
- Every step is a valid entry. `ScaffoldEntryResolver.Resolve` only confirms an authored id is on the path; `ScaffoldSession` slices the path from that index.
- The first step of every path is the floor: the most invariant concept the item rests on. Routing can land there (`ScaffoldEntryResolver.Floor`).
- The item owns invariant math (`PracticeItemOne` semantics and latent facts); the scaffold layer owns rods, lanes, and the path.

### Sample-1 path (`scaffold-parity-ladder`)

| Step id | Purpose | Move | Done condition |
| --- | --- | --- | --- |
| `step-rebuild-from-twos-and-ones` | ConceptFormation | classify 1 to 10 by fit against the two-rod | matches computed fit |
| `step-remove-paired-evens` | ConceptFormation | name the leftover group | `OddIntegers` |
| `step-select-consecutive-odds` | LanguageInterpretation | walk each odd-to-odd gap with the two-rod | all gaps traversed |
| `step-join-and-read-sum` | Representation | join `n` and `n + 2` in the sum lane | part composition matches |
| `step-name-bar-count` | Generalization | read the count of n-bars | `latent-like-term-count` = 2 (rod count) |
| `step-name-leftover-length` | Generalization | read the leftover length | `latent-ordered-step` = 2 (unit length) |

Deviations from the pattern that still need a decision: the handoff's single "name the two different 2s" step is authored here as two scalar readings against the two existing latent facts, rather than one step against a new count-versus-length fact; and the consecutive-odds step checks every gap, not one chosen pair.

## Authored entry tables

Routing after a check is an authored map from misconception code (an answer shape) to a step id. It is an index into the path, never a search.

### Practice Item One

| Misconception code | Entry step |
| --- | --- |
| `ordinary-step-and-missing-sum` | `step-select-consecutive-odds` |
| `stopped-at-second-integer` | `step-join-and-read-sum` |
| `ordinary-step-in-sum` | `step-select-consecutive-odds` |

Before any check, and after a correct check, the entry is the floor step.

### Practice Item Two

No scaffold is authored. All three codes (`this-year-resolved-as-w`, `stopped-at-this-year`, `scaled-variable-only`) route to `NoScaffoldAuthored`, and the diagnosis projects no purpose.

## Route escalation

After an incorrect check, the policy projects the latest misconception to its authored route. It walks backward through the check history and counts consecutive incorrect checks resolving to that same route. A streak of one uses `Initial`; a streak of two or more uses `Escalated`. Different misconception codes sharing an entry step continue the same streak. Escalation only gates the coach's `suggestScaffold` move; it no longer gates the scaffold session itself, and it is slated to be replaced by the authored probe.

## Missing scaffold behavior
- Items without a scaffold produce `NoScaffoldAuthored` and deny scaffold sessions in every phase.
- Text-only Help and Diagnosis remain available.
- `openScaffoldStep` is excluded from the response allow-list.

## Slice 7 authorized scaffold sessions
- `POST /api/attempts/{attemptId}/scaffold-sessions` creates a session in any attempt phase for an item with a scaffold. Before a check and after a correct check the entry is the floor step; after an incorrect check the entry is the authored step for the latest misconception. Only `NoScaffoldAuthored` returns conflict. (The original pre-check and initial-hint denials were rules for the old phase-container shape and were removed with it.)
- A session is reused for the same `AttemptId + ScaffoldId + EntryStepId`; its grant remains valid after the attempt changes.
- `GET /api/scaffold-sessions/{sessionId}` and `POST /api/scaffold-sessions/{sessionId}/checks` expose only a safe current-step projection and the latest derived satisfied/not-satisfied result. They do not expose `SuccessCheck`, solution data, submissions, timestamps, or complete history.
- The legacy `/api/scaffolds` endpoint remains solution-bearing for authoring/debugging, but Slice 8 removes it from the student runtime path.

## Slice 8 student scaffold runtime
- The Nuxt runner opens a scaffold session with an `attemptId`, then renders only the safe session projection and immutable practice prompt.
- The browser submits learner evidence only. It never submits correctness, reads a success-check definition, or compares against expected scalar, expression, or answer values.
- Unsatisfied checks preserve the server-issued current step; satisfied checks advance only by replacing the local projection with the server response.
- Starting the same authorized session again resumes its server progress, including after a browser reload.

## Slice 9 phase-scoped student coaching agent
- `POST /api/attempts/{attemptId}/coach` accepts only a coaching event from the browser: `helpRequested`, `diagnosisRequested`, or `explainCorrect`.
- The attempt phase, phase/event legality, diagnosis, hint level, scaffold route, scaffold-step authorization, and available provenance facts are derived on the server.
- Model-facing context is built from explicit phase allow-lists. Before-check context contains prompt text, safe tokens, and authorized phrases; incorrect-check context contains the latest server diagnosis and only the exact authorized scaffold entry when one exists; correct-check context contains the source-first why-it-works projection.
- Model output is treated as untrusted input. It must parse as one strict JSON object, use only a phase-authorized move, stay within message and ID allow-lists, and contain no unexpected properties.
- Suggested scaffold steps are pinned to the deterministic coaching policy route and are allowed only after an escalated authorized `ScaffoldEntry`.
- The coaching agent does not mutate attempts or scaffold sessions.
- No executable model tools are introduced in this slice; the phase-specific capability set is only an output allow-list.
- The generic `/api/agent` endpoint remains separate and is not used by the student flow.

## Slice 10 Nuxt student coaching integration
- The visible coaching control comes from `AttemptProjectionResponse.CoachingButton`; the student surface renders the server-issued label and renders no control when the button is hidden. `AfterCorrectCheck` now projects a visible "Why it works" button (a presentation change only; the domain phase and attempt invariants are unchanged).
- The browser derives the coaching event from the returned phase (`beforeCheck` → `helpRequested`, `afterIncorrectCheck` → `diagnosisRequested`, `afterCorrectCheck` → `explainCorrect`) and sends only `{ "event": ... }` through the Nitro proxy `POST /api/attempts/{attemptId}/coach`. The proxy validates the body with a strict schema and never forwards model, instructions, history, phase, misconception, step, or answer-key data.
- Coaching state (`idle`/`requesting`/`shown`/`error`) is stored per attempt session inside the existing sample-items store. Repeated requests replace the previous move; no client chat transcript exists.
- In-flight responses are discarded when the attempt ID, check count, or phase type changed while the request was pending, and concurrent requests for the same attempt are deduplicated.
- The browser renders only the four validated move types (`askReadingQuestion`, `diagnoseDifference`, `suggestScaffold`, `explainWhy`) as plain interpolated text with `aria-live="polite"`. Misconception codes, phase purposes, and provenance fact IDs are never rendered.
- Returned `focusPhraseIds` drive the existing semantic phrase highlighting; the first phrase ID that exists in the current prompt is focused and foreign IDs are ignored.
- The walkthrough action appears only when the validated move is `suggestScaffold` and always navigates by `/scaffolds/{attemptId}`. The client never sends or uses `suggestedStepId`; the scaffold-session endpoint independently derives and authorizes the entry step. The previous unconditional escalated-projection scaffold link on the sample-items page is removed.
- Upstream `409`, `429`, and `502` statuses surface as student-safe messages with an explicit Retry action; a `409` also refreshes the attempt projection. Raw provider or model output never reaches the UI, and the client never auto-retries model requests.

## Slice 9B coaching move recorder and recorded fixtures

### Recorder

- `ICoachingMoveRecorder` is a single thread-safe singleton (`InMemoryCoachingMoveRecorder`) registered in `Program.cs`. `Record` appends atomically under a lock; `Snapshot` returns an immutable point-in-time copy.
- `CoachingTurnService` records one `CoachingMoveRecord` only after the full success path: the attempt and practice item are found, the requested event is legal for the server-derived phase, the provider call succeeds, the response parses, and `CoachTurnValidator` accepts the move. Nothing is recorded for bad requests, unknown attempts, phase conflicts, provider failures, rate limits, cancellations, or invalid model output.
- Recording never alters the public coach response and never mutates the attempt or any scaffold session. Repeated successful requests create separate records.
- A record contains server-derived facts only: record ID, attempt ID, practice item ID, check count, derived phase, requested coaching event, validated move kind, validated focus phrase IDs, authorized suggested step ID (suggest-scaffold moves only), authorized provenance fact IDs (explain-why moves only), and a server timestamp from `TimeProvider`.
- A record never contains: model instructions or system prompt, model-facing context, raw or rejected model output, the coach message text, correct answers, distractor tables, latent solution values, scaffold success checks, or client conversation history.

### Recorded coaching fixture matrix

`RecordedCoachingFixtureTests` replays the production attempt derivation (`Attempt.Phase`), coaching policy, `CoachingAgentDefinitionFactory`, and `CoachTurnValidator` fully in-process — no web host, network, model provider, or credentials. Each fixture pairs a practice item, submitted answer history, requested event, and fake model JSON with the expected move and authorization.

| Fixture | Item | Answer history | Event | Expected move | Authorization |
| --- | --- | --- | --- | --- | --- |
| Before check | sample-1 | (none) | `helpRequested` | `askReadingQuestion` | authored phrase IDs only |
| First incorrect | sample-1 | `answer-b` | `diagnosisRequested` | `diagnoseDifference` | no scaffold step (initial hint) |
| Repeated same purpose | sample-1 | `answer-b`, `answer-b` | `diagnosisRequested` | `suggestScaffold` | exactly `step-join-known-quantities` |
| Different purpose resets | sample-1 | `answer-b`, `answer-a` | `diagnosisRequested` | `diagnoseDifference` | streak reset, no scaffold step |
| No scaffold authored | sample-2 | `answer-b`, `answer-b` | `diagnosisRequested` | `diagnoseDifference` | scaffold suggestion rejected |
| Correct on first check | sample-1 | `answer-d` | `explainCorrect` | `explainWhy` | authorized provenance fact IDs |
| Incorrect then correct | sample-1 | `answer-b`, `answer-d` | `explainCorrect` | `explainWhy` | authorized provenance fact IDs |

Negative companion fixtures confirm the production validator rejects an unknown move, a foreign phrase ID, a foreign scaffold step, a foreign provenance fact, and a scaffold suggestion before escalation.
