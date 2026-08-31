# Student Coaching Diagnostics

## Status
Accepted

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
