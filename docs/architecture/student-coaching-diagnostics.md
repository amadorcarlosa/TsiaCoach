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

## Authored purpose tables

### Practice Item One

| Misconception code | Scaffold phase purpose |
| --- | --- |
| `ordinary-step-and-missing-sum` | `LanguageInterpretation` |
| `stopped-at-second-integer` | `Representation` |
| `ordinary-step-in-sum` | `LanguageInterpretation` |

The generic scaffold resolver maps `LanguageInterpretation` to the first cold-start step in that phase, `TraverseOddGaps`, and `Representation` to `JoinKnownQuantities`.

### Practice Item Two

| Misconception code | Scaffold phase purpose |
| --- | --- |
| `this-year-resolved-as-w` | `LanguageInterpretation` |
| `stopped-at-this-year` | `LanguageInterpretation` |
| `scaled-variable-only` | `Representation` |

`this-year-resolved-as-w` misreads the “this year” reference. `stopped-at-this-year` stops before interpreting the next-year relation. `scaled-variable-only` recognizes the scale but represents it as applying only to the variable term.

## Route escalation

After an incorrect check, the policy projects the latest misconception to its authored purpose and route. It walks backward through the check history and counts consecutive incorrect checks resolving to that same purpose. A streak of one uses `Initial`; a streak of two or more uses `Escalated`. Different misconception codes sharing a purpose continue the same streak.

## Missing scaffold behavior
- Items without a scaffold produce `NoScaffoldAuthored`.
- Text-only Help and Diagnosis remain available.
- `openScaffoldStep` is excluded from the response allow-list.

## Slice 7 authorized scaffold sessions
- `POST /api/attempts/{attemptId}/scaffold-sessions` can create a session only for an escalated coaching diagnosis with an authored `ScaffoldEntry` route. `BeforeCheck`, initial hints, correct attempts, and `NoScaffoldAuthored` routes return conflict.
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
