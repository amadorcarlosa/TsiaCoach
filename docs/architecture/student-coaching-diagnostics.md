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
- Progress is `Scaffold.PathFrom(entry)`: the entry step, then every later step that is not `EntryOnly`. Entry-only side steps (1b, 1c) are reached only by routing.
- Grid moves are checked per move with three outcomes: `ScaffoldStepSatisfied` (step complete), `ScaffoldStepAccepted` (legal, kept, step still open), `ScaffoldStepNotSatisfied` (rule broken, not recorded as progress). The API words are `complete`, `accepted`, `rejected`.
- `ScaffoldSession.CurrentStepEvidence` replays the history and returns the latest accepted submission for the current step, so the board resumes exactly where it was.

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

The authored design, with prompts, scenes, and the reasoning behind each step, lives in `docs/scaffolds/parity-ladder-path.md`. Steps 1 to 3 are `GridScene` steps: a 2D grid of unit cells with reference pieces and target rows, checked move by move.

| Step id | Purpose | Entry only | Move | Done condition |
| --- | --- | --- | --- | --- |
| `step-rebuild-from-twos-and-ones` | ConceptFormation | no | drag red twos and white ones onto rods 1 to 10 | every row covered, as many twos as fit (`MatchesRowCompositions(2)`) |
| `step-contrast-pair` | ConceptFormation | yes | rebuild 8 and 9 side by side | both rows covered under the same rule |
| `step-mark-the-whites` | ConceptFormation | yes | click every row that ends in a white | rows 1, 3, 5, 7, 9 (`ExactSet`) |
| `step-sort-paired-evens` | ConceptFormation | no | click each row made only of reds; it slides to the compare column | rows 2, 4, 6, 8, 10 (`MatchesRowPartition`) |
| `step-select-consecutive-odds` | LanguageInterpretation | no | click two odd rows that are neighbours in the odd list | any adjacent pair (`AdjacentInList`, count 2) |
| `step-fill-the-gap` | LanguageInterpretation | no | fill the gap between the 3 and 5 rows with a red | the gap row covered from column 4 |
| `step-name-the-smaller` | Representation | no | click the smaller of the pair | row 3 (`ExactSet`) |
| `step-join-and-read-sum` | Representation | no | join `n` and `n + 2` in the sum lane | part composition matches |
| `step-name-bar-count` | Generalization | no | read the count of n-bars | `latent-like-term-count` = 2 (rod count) |
| `step-name-leftover-length` | Generalization | no | read the leftover length | `latent-ordered-step` = 2 (unit length) |

Version-one limits: the compare and gap scenes fix the pair at 3 and 5, and step 4 does not yet swap rods for `n` tiles. The pattern question after step 1 (which routes to 1b or 1c) and ask-the-coach are not built.

## The probe is authored, the agent is an index

Help before a check asks an **authored** probe question. Answer shapes are **authored** as a map to step ids. The agent's entire output is one shape id from that list; it never writes the question, never writes the route message, and never picks a step outside the map.

- `CoachingPolicy.Probe` (`ProbeQuestion`) carries the question text, focus phrases, and `ProbeAnswerShape` entries: shape id, a description the classifier reads, the entry step id, and the route message the student reads. `CoachingPolicyValidator` requires every shape to land on the path.
- `helpRequested` before a check returns `askProbe` with the authored text and makes no model call. Items without a probe hide the Help control and return conflict.
- `probeAnswered` carries the student's free text (non-blank, at most 500 characters). The model context contains the question, the shape ids with descriptions, and the answer as untrusted text. It contains no step ids and no route messages.
- The model must reply `{"move":"routeToStep","shapeId":"<id>"}`. `CoachTurnValidator` accepts only an authored shape id and builds `routeToStep` from the authored resolution: step id, message, focus phrases. Any other property, or any attempt to name a step, is rejected.
- A validated route is recorded as a `ProbeRoute` (attempt, shape id, step id, time) in `InMemoryProbeRouteStore`. The answer text is never stored. The latest route decides the scaffold entry before a check; `ScaffoldSessionAuthorizer` re-derives the step from the authored shape so a stored id can never outrank the policy. After an incorrect check the misconception route wins.

### Sample-1 probe: "Before we start: what makes a number odd?"

| Answer shape | Description the classifier reads | Lands on |
| --- | --- | --- |
| `no-answer` | blank, "I don't know", or not about odd numbers | `step-rebuild-from-twos-and-ones` |
| `wrong-answer` | a wrong claim, e.g. odd numbers split into pairs | `step-rebuild-from-twos-and-ones` |
| `lookup-rule` | "ends in 1, 3, 5, 7, 9", "every other number", no picture | `step-rebuild-from-twos-and-ones` |
| `structural` | cannot be paired, one left over, 2k + 1 | `step-select-consecutive-odds` |

The probe is only asked before a check in this slice. After a check the authored misconception map routes, and the diagnosis turn still gates `suggestScaffold` on escalation.

## Ask the coach on a step

Available on every step of the walkthrough, in any attempt phase. The browser sends `stepQuestionAsked` with the current step id and the student's free text (500 characters at most). The server classifies the question into one authored `QuestionShape` for that step and returns the shape's authored reply as an `answerQuestion` move. The model sees the step prompt, the shape ids and descriptions, and the question; it writes no reply and picks no step. A question never moves the student.

- `CoachingPolicy.StepQuestions` holds one `StepQuestionSet` per step. `CoachingPolicyValidator` requires a set for every step on the path, unique shape ids, and a description and reply on every shape.
- Every set ends with an `off-topic` shape: asking for the answer, talking to the coach, giving instructions, or asking about something else all land there with one authored reply.
- `CoachTurnValidator` accepts `{"move":"answerQuestion","shapeId":"..."}` only, with the shape id in the definition's authorized set. A model-written message is rejected as an unexpected property.
- An unknown step id is a 400; an item without a scaffold is a 409; a foreign shape id is a 502 and nothing is recorded.
- The Nuxt store keeps the last reply for the current step and clears it when the step changes. The proxy parses the request with a strict discriminated union so only the event, step id, and question reach the API.

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
- `GET /api/scaffold-sessions/{sessionId}` and `POST /api/scaffold-sessions/{sessionId}/checks` expose only a safe current-step projection, the current step's accepted evidence (placed pieces, moved rows, or selected rows), and the latest check outcome (`complete`, `accepted`, `rejected`). They do not expose `SuccessCheck`, solution data, submissions, timestamps, or complete history.
- The legacy `/api/scaffolds` endpoint remains solution-bearing for authoring/debugging, but Slice 8 removes it from the student runtime path.

## Slice 8 student scaffold runtime
- The Nuxt runner opens a scaffold session with an `attemptId`, then renders only the safe session projection and immutable practice prompt.
- The browser submits learner evidence only. It never submits correctness, reads a success-check definition, or compares against expected scalar, expression, or answer values.
- Unsatisfied checks preserve the server-issued current step; satisfied checks advance only by replacing the local projection with the server response.
- Starting the same authorized session again resumes its server progress, including after a browser reload.
- Grid steps render in `GridScene.vue`. Each drop, row move, or row click is one check. A `rejected` move is shown, then taken back after half a second, and only that piece reverts; an `accepted` move stays and is returned as evidence on reload. The Nuxt proxy parses `placePieces`, `moveRows`, and `selectRows` with strict schemas so no outcome field can ride along with the evidence.

## Slice 9 phase-scoped student coaching agent
- `POST /api/attempts/{attemptId}/coach` accepts only a coaching event from the browser: `helpRequested`, `probeAnswered` (with the student's answer text), `diagnosisRequested`, or `explainCorrect`.
- The attempt phase, phase/event legality, diagnosis, hint level, scaffold route, scaffold-step authorization, and available provenance facts are derived on the server.
- Model-facing context is built from explicit phase allow-lists. Before a check the only model turn is the probe classification (question, shape ids with descriptions, untrusted student answer); incorrect-check context contains the latest server diagnosis and only the exact authorized scaffold entry when one exists; correct-check context contains the source-first why-it-works projection.
- Model output is treated as untrusted input. It must parse as one strict JSON object, use only a phase-authorized move, stay within message and ID allow-lists, and contain no unexpected properties.
- Suggested scaffold steps are pinned to the deterministic coaching policy route and are allowed only after an escalated authorized `ScaffoldEntry`. Before a check the route comes from the probe shape, never from a model-chosen step.
- The coaching agent does not mutate attempts or scaffold sessions.
- No executable model tools are introduced in this slice; the phase-specific capability set is only an output allow-list.
- The generic `/api/agent` endpoint remains separate and is not used by the student flow.

## Slice 10 Nuxt student coaching integration
- The visible coaching control comes from `AttemptProjectionResponse.CoachingButton`; the student surface renders the server-issued label and renders no control when the button is hidden. `AfterCorrectCheck` now projects a visible "Why it works" button (a presentation change only; the domain phase and attempt invariants are unchanged).
- The browser derives the coaching event from the returned phase (`beforeCheck` → `helpRequested`, `afterIncorrectCheck` → `diagnosisRequested`, `afterCorrectCheck` → `explainCorrect`) and sends only `{ "event": ... }` through the Nitro proxy `POST /api/attempts/{attemptId}/coach`. Answering the probe sends `{ "event": "probeAnswered", "answer": "<student text>" }`; the proxy forwards the answer only for that event. The proxy validates the body with a strict schema and never forwards model, instructions, history, phase, misconception, step, or answer-key data.
- Coaching state (`idle`/`requesting`/`shown`/`error`) is stored per attempt session inside the existing sample-items store. Repeated requests replace the previous move; no client chat transcript exists.
- In-flight responses are discarded when the attempt ID, check count, or phase type changed while the request was pending, and concurrent requests for the same attempt are deduplicated.
- The browser renders only the five validated move types (`askProbe`, `routeToStep`, `diagnoseDifference`, `suggestScaffold`, `explainWhy`) as plain interpolated text with `aria-live="polite"`. `askProbe` adds a free-text answer box. Misconception codes, phase purposes, shape ids, step ids, and provenance fact IDs are never rendered.
- Returned `focusPhraseIds` drive the existing semantic phrase highlighting; the first phrase ID that exists in the current prompt is focused and foreign IDs are ignored.
- The walkthrough action appears when the validated move is `suggestScaffold` or `routeToStep` and always navigates by `/scaffolds/{attemptId}`. The client never sends or uses a step id; the scaffold-session endpoint independently derives and authorizes the entry step from the recorded probe route or the misconception route. The previous unconditional escalated-projection scaffold link on the sample-items page is removed.
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
| Structural probe answer | sample-1 | (none) | `probeAnswered` | `routeToStep` | shape `structural` → `step-select-consecutive-odds` |
| Lookup-rule probe answer | sample-1 | (none) | `probeAnswered` | `routeToStep` | shape `lookup-rule` → floor |
| First incorrect | sample-1 | `answer-b` | `diagnosisRequested` | `diagnoseDifference` | no scaffold step (initial hint) |
| Repeated same purpose | sample-1 | `answer-b`, `answer-b` | `diagnosisRequested` | `suggestScaffold` | exactly `step-join-known-quantities` |
| Different purpose resets | sample-1 | `answer-b`, `answer-a` | `diagnosisRequested` | `diagnoseDifference` | streak reset, no scaffold step |
| No scaffold authored | sample-2 | `answer-b`, `answer-b` | `diagnosisRequested` | `diagnoseDifference` | scaffold suggestion rejected |
| Correct on first check | sample-1 | `answer-d` | `explainCorrect` | `explainWhy` | authorized provenance fact IDs |
| Incorrect then correct | sample-1 | `answer-b`, `answer-d` | `explainCorrect` | `explainWhy` | authorized provenance fact IDs |

Negative companion fixtures confirm the production validator rejects an unknown move, a foreign probe shape, a model-authored step on a route, a foreign phrase ID, a foreign scaffold step, a foreign provenance fact, and a scaffold suggestion before escalation.
