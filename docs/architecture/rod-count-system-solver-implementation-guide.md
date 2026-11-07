# Rod-count systems solver implementation guide

Date: November 6, 2026.
Status: implementation plan based on the supplied feature specification and Artboards 1–8.

## Representation contract

For ax + by = c and dx + ey = f, x and y represent counts of rods. Coefficients represent the value of each rod in that equation. The same counts appear in both equation models.

For x=5, y=7 in 3x+8y=71 and 9x+4y=73, draw five green 3-rods and seven brown 8-rods above, and five blue 9-rods and seven purple 4-rods below. Their areas are 15+56=71 and 45+28=73.

A variable count of 21 means twenty-one coefficient-valued rods. It does not require a length-21 rod. This activity needs explicit rod-count semantics alongside the existing row-length interpretation. Add an explicit strategy/representation discriminator to configuration, evaluation and persistence. Files without it retain their existing interpretation.

Restrict generated coefficients to integers 1–9, targets to positive integers and candidates to positive integer counts. Require a nonzero determinant and an intended positive integer solution. Future broader domains need their own rules.

## Artboard behavior

Use two large stacked grid workspaces. Arrange coefficient-valued rods vertically, side by side, so rectangle width expresses count and height expresses coefficient. Place x material followed by y material, with clear variable labels and established Cuisenaire colors. Maintain the shared counts when rebuilding the lower model.

The supplied sequence begins with one rod of each type, explores filling the upper area, then reaches candidates (21,1), (13,4), (5,7). Allow incomplete exploration and loose material. Residual unit cells in intermediate artboards must be labelled unassigned material and must not establish a fractional rod count or a feasible candidate.

At candidate boundaries, the upper model is the learner's committed material. The lower model is an automatically derived check using its own coefficients and the same counts. Mark derived material distinctly and exclude it from learner editing and saved rod snapshots. Persist enough activity state to regenerate it.

Keep equations, area addends, totals and target comparisons visible together. A candidate satisfying only the first equation is feasible for that equation. Describe the second result as missing/excess area or a failed common-solution check.

## Existing architecture and proposed extensions

Frontend paths below are relative to tsia-coach-web-nuxt/.

| Existing owner | Reuse or extension |
| --- | --- |
| app/components/playground/SystemsOfEquationsPlayground.vue | Host the strategy selector and compose activity controls with shared interactions. |
| app/components/systems/systems.schema.ts | Reuse equation/configuration types and add representation plus generation settings validation. |
| app/components/systems/systems.geometry.ts | Add rod-count layout with capacity derived from every displayed candidate. |
| app/components/systems/systems.evaluate.ts | Preserve existing evaluation and introduce explicit dispatch to rod-count evaluation. |
| app/components/systems/systems.substitution.ts | Keep row-length propagation scoped to its representation. Count-mode lower material derives from candidate counts. |
| app/components/systems/SystemsBoard.vue and SystemsAreaSummaries.vue | Reuse grid, palette, equation summaries and decorative derived material. |
| useRodScene and BoardTransform | Reuse candidate validation, atomic commit, ID allocation and selection. |
| SceneMenu and SceneMenuChoice commands | Open conversion preview through the existing command pathway. |
| useBoardTransformPreview and PreviewDialog | Reuse confirmation, source-state checks, dismissal and focus behavior. |
| SceneRodLayer and CuisenaireRod | Render actual rods, selection and decorative previews. |
| useBoardCamera and grid-coordinates.ts | Reuse pan, zoom and projected pointer conversion. |
| RodPlaygroundAuthoring and level-file adapters | Capture committed state, validate all steps and restore the matching problem/strategy. |

Before implementation, inspect the current checkout for generation, difficulty, history and activity-controller abstractions. Reuse any suitable existing owner. Proposed new modules are systems.candidates.ts for pure arithmetic, systems.generator.ts for bounded seeded generation, systems.count-layout.ts for scene construction, and a small controller composable if existing controllers cannot express this activity cleanly.

Keep mathematics independent from Vue, DOM, animation and grid coordinates. Put rendering geometry in the layout adapter. Keep the canonical equation model shared.

## Pure candidate engine

Validate integer coefficients and targets at the boundary. Use exact integer arithmetic within validated safe ranges.

For the first equation, compute an upper bound floor((c-b)/a). Search downward until c-a*x is positive and divisible by b. Return y=(c-a*x)/b. Return an explicit no-positive-candidate result if no x>=1 qualifies.

Compute g=gcd(a,b), removedX=b/g, addedY=a/g and preservedArea=a*removedX=b*addedY. The next candidate is (x-removedX,y+addedY), provided both counts remain positive.

Expose one deterministic candidate iterator. Full-sequence validation and learner progression consume this same iterator. Keep counts and lengths typed distinctly in interfaces and variable names.

For each candidate calculate both equations' x addend, y addend, total, target difference and satisfaction. All expressions, summaries and lower-board material derive from this evaluation.

The reference sequence must produce (21,1), (13,4), (5,7), upper totals 71 throughout and lower totals 193,133,73. The exchange removes eight 3-rods and adds three 8-rods, preserving 24 cells. Stop at (5,7).

A general imported problem can report no positive candidate, no common positive integer solution or a singular system. Generated activities reject these before starting. A first-candidate solution completes immediately unless generation settings require conversion practice.

## Learner controller

Use the existing activity/session model where suitable. Retain the system, strategy, committed candidate index/history and current interaction phase. Derive candidate, evaluation, conversion availability and success from the shared engine. Selection remains owned by the scene interaction layer.

Suggested phases are building the first candidate, reviewing the second-equation check, selecting conversion material, previewing replacement, and solution found. Introduction and conversion explanations can be presentation states. Avoid storing duplicate placed counts, candidate totals and success flags when they can be derived.

During initial construction, derive x/y counts from the learner scene. Every counted unit must have the correct coefficient magnitude, positive sign and permitted orientation, with explicit equation/variable membership. A train may contain several units. Selection of a train must account for its constituent units, rather than treating each train ID as one rod.

Free rod decomposition can temporarily invalidate the count interpretation. Treat such material as work in progress until reassembled into coefficient-valued units. Only an exact positive feasible arrangement becomes a candidate.

Guide the initial search toward the greatest feasible x through progressive prompts. Do not display the full candidate list or intended solution upfront. An intermediate feasible pair can be recognized while the guided activity explains how to reach its required starting candidate.

## Context-menu conversion

After the automatic lower check fails, offer a command such as “Exchange x rods for equal-area y rods.” It opens the existing preview workflow.

Validate selected source units belong to the first equation's x group, have coefficient value a, and total exactly removedX units. Count units inside selected trains consistently. Reject mixed selections, stale IDs, unrelated material or a conversion leaving x<1.

Preview the removed units and addedY y units valued b. Show the conserved area and proposed next counts. Existing rods and ghost units need distinct visual treatment. Keep a keyboard-accessible confirm/keep choice.

Commit only after complete validation. Recompute from current source state, verify the preview baseline, validate the full replacement scene and allocate IDs at commit. Preserve unaffected objects and metadata. Rebuild the lower derived check from the new counts and stop conversion when both equations hold.

The mathematical invariant is a*x+b*y=c before and after each committed exchange. The preserved exchange area is lcm(a,b). Candidate history advances once per successful transaction. Dismissal, invalid selection and interrupted animation must leave the committed candidate unchanged.

Use existing tab, camera, replacement, edit-disable and unmount cancellation hooks to dismiss stale previews. Animation follows the validated transition and honors reduced motion.

## Dynamic generation and difficulty

Inject a seeded random source. Select the intended positive solution first, choose coefficients 1–9, reject determinant a*e-b*d=0, and compute c and f from that solution. Enumerate first-equation candidates with the shared engine and locate the intended solution.

Validate candidate-count bounds, solution index/conversions-before-solution bounds, supported coefficients and visual capacity. Bound attempts, with a default of 500, and return an actionable generation failure when settings are infeasible. New problem must use the normal guarded activity transition so captured work is handled explicitly.

Suggested profiles from the specification are introductory solution values 1–8 with 2–3 candidates and one conversion, standard values 1–12 with 2–5 candidates and 1–3 conversions, and advanced values 1–20 with 3–7 candidates and 2–5 conversions. These bound intended solution values, not every intermediate candidate count.

Capacity checks must include all candidates the learner can reach and all corresponding lower-model totals. The reference lower area begins at 193 even though its target is 73. A target-only limit of 150 cannot establish that the entire visual sequence fits. Validate actual rectangle extents and reserved workspace dimensions, including preview material. Pan/zoom changes the view, not mathematical capacity.

## Persistence and correctness

Extend strict board and captured-step contracts as needed to include strategy, problem, committed candidate/phase/history and generation seed/settings. Inspect authoring's current scene-only assumptions before wiring capture. A save must restore both learner scene and controller consistently. Use a canonical committed snapshot, validate both representations against one another, and regenerate derived lower material.

Do not serialize previews or independently editable lower suggestions. Preserve existing file behavior for the row-length strategy. Decide whether the new activity metadata can be expressed compatibly or requires a versioned document migration before shipping.

Equation correctness uses both the valid count representation and exact target equality. Stage progression requires the same x/y counts for both equations. Learner-facing feedback distinguishes first-equation feasibility from whole-system success.

## Delivery and verification

1. Add strategy schemas, pure candidate engine and mathematical tests.
2. Add seeded bounded generation and capacity validation using that engine.
3. Add rod-count layout and scene interpretation using shared renderers and interactions.
4. Add controller, initial construction and automatic lower checking.
5. Add context-menu exchange preview and atomic commit.
6. Integrate new-problem, reset, capture/restore, difficulty and replay behavior supported by the existing architecture.
7. Review artboard fidelity, accessibility and positive/negative/row-length board regressions.

Required mathematical cases include the primary sequence, 3x+8y=70 starting at (18,2), 9x+4y=73 producing (5,7),(1,16), and 4x+6y=34 producing (7,1),(4,3),(1,5) with an exchange of three 4-rods for two 6-rods. Test 4x+6y=5 as no positive candidate.

Test determinant-zero rejection, first-candidate success, exhausted sequences, generated-system reproducibility, impossible difficulty settings and bounded failure. For every generated candidate verify positivity, integer counts and conservation of the first equation.

Scene tests must cover multi-unit trains, incomplete decompositions, invalid/mixed selections, stale previews, rollback, ID allocation, cancellation and restoring a saved activity. Verify that lower derived rods cannot become sources for learner counts.

Browser tests must reproduce the complete reference sequence via context-menu exchanges with mouse, keyboard and touch. Include nonzero scrolling, supported zoom levels, reduced motion, automatic totals, solution stopping, new problem, reset and save/load. Use repo-installed Playwright and output/playwright/rod-count-solver for artifacts.

Run relevant unit tests, lint on touched files, the Nuxt application typecheck and the existing playground browser suites. A screenshot-only check does not establish area conservation or correct activity progression.

## Completion criterion

The learner can construct a feasible first candidate, see its second-equation check, exchange exactly the smallest equal-area group through the context menu, and reach the common solution one candidate at a time. Generated problems use the same mathematics and fit every displayed state. Both models consistently express variables as counts and coefficients as rod values.
