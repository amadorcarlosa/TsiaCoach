# Student Coaching Diagnostics

## Status
Accepted

## Slice 6 deterministic scaffold evaluation
- Learner submissions are modeled separately from authored `LearnerAction` values.
- `ScaffoldStepEvaluator` derives scaffold-step correctness from the scaffold, practice item, step id, and submitted evidence.
- Latent scalars, latent expressions, and correct answer ids remain evaluator inputs only.
- `ScaffoldStepEvaluation` outcomes contain only satisfied/not-satisfied state and no solution-bearing data.
- Expression evaluation in this slice compares a submitted known `MathObjectId` with the expected latent expression's authored math object.
- Step authorization, step order enforcement, and append-only scaffold history are deferred to Slice 7.

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
