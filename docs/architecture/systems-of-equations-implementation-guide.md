# Systems of Equations Playground implementation guide

Updated: October 31, 2026.
Status: stages 1–6 implemented as a development tab (October 31, 2026). Stage 7 (problem editor, hints, history, elimination, substitution) is not started.

Implementation notes:

- Coefficient propagation: `systems.substitution.ts` waits for a complete learner region: exactly one horizontal rod per coefficient row, equal lengths, aligned starts, full containment and no overlaps. It propagates only that variable to the corresponding region in the other equation, in either direction. It never solves the other variable or uses target answers. Compatible partial target rods are preserved; incompatible targets are explicitly reported and never overwritten. Breaking source completion removes generated rows immediately. Suggestions are faded, outlined and inert, derived only from learner material and excluded from saved scenes, selection, collision and editing commands. Area summaries include the displayed suggestions; separately labelled learner-material feedback and authoring evaluation still use committed rods. No result sections or extra grids are added.
- Current problems set `staging: false`: only the four equation groups are drawn and selectable destinations, with no staging rows or readout. Saved configurations that omit `staging` retain their staging region, coordinates and material on import; no rods are silently dropped.
- Pure model: `app/components/systems/` — `systems.schema.ts` (problem and limits), `systems.fixtures.ts` (both development problems), `systems.geometry.ts` (regions, headings, gutter), `systems.evaluate.ts`, `systems.feedback.ts`, `systems.operations.ts` (repeat row, arrange rows, redistribute, test candidate).
- Scene: new `board-transform` action. The board supplies `ScenePolicy.planTransform`; the scene replans at check and at commit, refuses a stale `expected` key, validates the whole candidate and commits once. `ScenePolicy.regionBoundEdits` keeps Make a train, Clone and factor arrangements inside the source group (opt-in; other boards unchanged). Factors try the current anchor, then nearest grid positions by Manhattan distance, using the shared deterministic offset order. Selected sources are excluded from collisions; replacements are checked together and committed atomically. Oversized and fully blocked arrangements return distinct reasons, and menu availability uses the same search as commit.
- UI: `SystemsOfEquationsPlayground.vue`, `SystemsBoard.vue`; previews use `useBoardTransformPreview.ts` and the shared `PreviewDialog.vue` (now also used by zero-pair cancellation). Region background right-click offers "Add rods here" and "Select this group's rods".
- Live area readouts: `SystemsAreaSummaries.vue` shows each equation's x area, y area and emphasized total from `evaluateSystem(config, scene.trains)`, never from target areas. Only fully contained trains count; staging and preview ghosts do not. The polite live region sits outside the horizontal board scroller and follows the equation bands during vertical scrolling and zooming.
- Region-bound factor choices include both orders of every factor pair, including one-row and one-column arrangements. Rows wider than 10 use multiple catalog rods (for example 25 is 10 + 10 + 5), not length-25 rods. Other boards retain their existing nontrivial factor choices.
- Goals: the chosen path is generic region goals for the four variable groups; system status is derived from the rods and shown separately. There is no system-satisfied goal type yet.
- Files: `BoardDescriptor` kind `systems` stores the full problem and layout. Importing a level for a different problem adopts it (the import replaces all rods and steps). Switching problems from the toolbar is refused while the board has work or captured steps.
- Repeat row refuses occupied destination lanes rather than offering replacement. Test candidate replaces the other equation's material, and its preview says how much.
- Coach capture sends the systems descriptor and rods; derived status is not yet added to the capture.
- Tests: `app/components/systems/systems.test.ts`, `tests/e2e/systems-of-equations.spec.ts`.

## Purpose and first release

Add a **Systems of Equations Playground** tab to the existing Nuxt playground. Students construct two area models, discover candidate variable lengths, and test whether both equations use the same values. Keep exploration open: incomplete rectangles, unequal rows, and incorrect candidate arrangements are legal scene states with meaningful feedback.

Reuse the existing semantic HTML rods, trains, context menus, grid, camera, selection, movement and authoring lifecycle. Do not create a parallel rod engine or change the Array playground's mathematics or zero-pair cancellation behavior.

First release: a fixed development problem, four labelled variable regions, shared rod palette, existing manipulation/context-menu actions, pure constraint feedback, pan/zoom, reset/clear, and step capture. A problem selector/editor follows once the evaluator and persistence contract are stable. Full undo/redo, hints, elimination, substitution and move replay are separate milestones; Capture Step is not advertised as general undo history.

Related guides: [Code structure and patterns](code-structure-and-patterns.md), [Frontend consistency implementation guide](frontend-consistency-implementation-guide.md), [Negative rods](negative-rods-implementation-guide.md), and [Zero-pair cancellation](negative-rods-stage-6-implementation-guide.md).

## 1. Mathematical interpretation

Development fixture:

```text
3x + 5y = 34
4x + 2y = 22
```

For each equation, x and y occupy separate groups of horizontal row lanes. Coefficients determine lane count. Unknown values are lengths along the lanes. Equation area is the combined occupied area of its x and y groups, not the required length of every row.

At x=3 and y=5, the first model occupies 3*3 + 5*5 = 34 cells and the second occupies 4*3 + 2*5 = 22. At x=8 and y=2, the first reaches 34 but the second reaches 36, an excess of 14.

**Individual rod magnitudes remain 1–10. Variable lengths are positive whole numbers bounded by configured lane capacity, and may exceed 10.** A row of length 14 can consist of [10,4], [7,7], or fourteen ones. No renderer, schema or evaluator may cast a variable length of 14 to `CuisenaireRodValue`.

For longer-variable acceptance tests, use:

```text
2x + y = 32
x + 3y = 26
```

The common assignment is x=14 and y=4. A lane capacity of at least 14 must support it. Tests may know the solution; the runtime interface must not reveal it by default.

Initially accept positive coefficients, nonnegative integer targets, and positive-integer variable assignments only. Zero, negative and fractional variable lengths are outside this release. An empty group is incomplete, not an inferred value of zero. A problem with no admissible solution remains an exploratory problem; do not mark an invalid arrangement solved to force an answer.

## 2. Domain model and single source of truth

Use a systems-specific model above the existing scene types. Proposed concepts:

```ts
type VariableId = 'x' | 'y'
type LinearEquation = {
  id: string
  coefficients: Record<VariableId, number>
  targetArea: number
}
type LinearSystem = { equations: readonly [LinearEquation, LinearEquation] }
type SystemsBoardConfig = {
  system: LinearSystem
  laneColumns: number
  regionGapRows: number
}
```

These are illustrative types; follow repository validation/type conventions. Bound coefficients, lane capacity and total board dimensions to sensible configured limits. Coefficient 14 means fourteen lanes, not an unsupported length-14 coefficient rod.

Derive four semantic region IDs from equation ID and variable ID, such as `equation-1:x`. The layout function produces regions, labels and axis positions from the same validated configuration. Do not duplicate coefficient row counts in component-local constants.

Scene rods are the authoritative placed material. Infer a `CandidateAssignment` from valid region geometry; do not maintain editable x/y fields that can disagree with the board. Candidate models are derived readouts or command parameters, not a second source of scene state.

Variable identity derives from explicit labelled regions and train containment. Color, rod magnitude, DOM order and train IDs do not determine x or y. This is a positional region model: moving a train to another region changes which group it contributes to. Do not add a sticky variable role unless a later feature specifically needs identity independent of region.

## 3. Layout and visual meaning

Use two vertically stacked equation bands on one common HTML workspace. Each band contains an x region followed vertically by a y region, with a gap between equations and an optional separate staging region for loose material.

- Row lanes are available space, not filled material. Draw their backgrounds with CSS grid lines; only placed rods count toward occupied area.
- Show a coefficient bracket/strip and a textual label such as “3 rows of x.” For coefficients greater than 10, use a train-like segmented magnitude indicator or plain bracket/count; never invent a length outside the rod catalog.
- Label x and y consistently in both equations. Use consistent group accents/borders while retaining normal Cuisenaire magnitude colors on every rod.
- Render targets, occupied areas and missing/excess amounts near each equation.
- Keep labelled regions aligned to board cells and use the shared camera for large capacities. Do not render one DOM element per empty cell.
- Coefficient decorations occupy a gutter outside the editable cell regions. They are not selectable rods, occupied cells or equation material.
- Ghosts, target outlines and previews are decorative, not scene objects.

Start with top-down placement. Any later tilt must use the actual projected coordinate helper and corresponding tests, rather than a hard-coded angle.

## 4. Reuse map and proposed owners

Source paths are relative to `tsia-coach-web-nuxt/`.

| Owner | Responsibility |
| --- | --- |
| Proposed `app/components/playground/SystemsOfEquationsPlayground.vue` | Compose the board, controls, readouts, menu choices and authoring. |
| Proposed `app/components/systems/systems.types.ts` and `systems.schema.ts` | Validated problem/configuration and derived evaluation types. |
| Proposed `app/components/systems/systems.geometry.ts` | Pure configuration-to-regions/lane geometry and label anchors. |
| Proposed `app/components/systems/systems.evaluate.ts` | Pure snapshot-to-constraint evaluation. No DOM, Vue state or mutation. |
| Proposed `app/components/systems/systems.operations.ts` | Pure planners for systems-specific context-menu transformations. |
| Existing `useRodScene` and `ScenePolicy` | Canonical scene state, collision, bounds, candidate validation, selection and commit. |
| Existing `scene-regions.ts` and `part-footprint.ts` | Region containment and physical occupied cells. |
| Existing `useRodPlaygroundInteraction`, `useSceneMenu`, `SceneMenu`, `SceneRodLayer` | Shared mouse/touch/keyboard interaction, menus, focus and rod rendering. |
| Existing `rod-arithmetic.ts` and train types | Positive magnitudes, train lengths, metadata preservation and signed-material rejection. |
| Existing `useBoardCamera`, `BoardViewControls`, `grid-coordinates.ts` | Pan/zoom/reset and input-to-cell conversion. |
| Existing authoring and level-file adapters | Capture/update/switch steps, immutable snapshots and strict import/export. |
| Existing playground tab registry and `/dev/playground` composition | Register and activate the new tab with the same gesture-cancellation behavior. |

Keep equation-specific interpretation out of `CuisenaireRod.vue`, camera code and generic drag helpers. Do not repurpose denominator/numerator `materialRole` as x/y identity. Use typed region/configuration data for this board.

## 5. Scene policy: legal exploration versus validity

Configure editable variable regions with the coefficient's lane count and configured lane capacity. A whole train must fit within one compatible region; reject cross-region spans and overlaps through existing scene validation. Gaps and unequal row lengths remain legal placements. They affect constraint status, not movement permission.

Allow horizontal material in variable lanes initially. Vertical/tower rotation remains available in a staging region if provided, but placement into a variable lane must satisfy its orientation policy. Menu disabled reasons should say why. This avoids interpreting tower value as area: a tower occupies one ground cell despite its magnitude.

The shared palette creates material in a chosen region through the existing create action's region intent. Provide a visible destination selector or region focus, and an optional region background menu for “Add rod here.” Do not infer the intended destination from an unrelated last DOM node. Material in staging contributes to no equation and is reported separately.

Allow creation and deletion in free exploration. These actions change occupied area; do not label them as equation-preserving operations. Explicit preservation planners must prove their own invariants.

Negative rods and cancellation are disabled for this board. Snapshot imports and actions enforce that restriction even if controls are hidden.

## 6. Pure geometry evaluator

`evaluateSystem(config, snapshot)` returns per-region, per-equation and cross-equation status. Derive it reactively from committed snapshots and configuration. Provisional drag/ghost positions are not committed mathematical facts; if live previews are shown, label them as previews.

For each variable region:

1. Calculate actual positive occupied cells using the shared footprint/occupancy helpers.
2. Partition cells by region-relative lane index.
3. For every required lane, record cell count, contiguous interval, and any hole.
4. Require every lane to be nonempty and hole-free before assigning a positive row length.
5. Require identical intervals across lanes to form a complete rectangle. Equal counts alone do not prove rectangularity.
6. Require the lane count to match the coefficient exactly and all parts to remain within the region.
7. When valid, derive variable length from rectangle width, even if a row consists of multiple independent rods or a multi-part train.

A complete rectangle may be translated horizontally within its region: require one common start column, not necessarily the left edge. This preserves free placement. A future “Align rows” action may align it explicitly.

Two rows containing the same occupied cells must evaluate identically regardless of rod partition, part order, train IDs or selection. Reject overlapping/untrusted input before evaluation; never count overlapping material twice as a valid area model.

Return explicit statuses such as empty, incomplete, gaps, unequal widths, misaligned rows, or valid rectangle. Include observed row widths without claiming a definite variable value when invalid.

For each equation:

- `occupiedArea = xRegion.occupiedArea + yRegion.occupiedArea`.
- `difference = occupiedArea - targetArea`; positive means excess, negative means missing.
- `areaMatches` can be true even if shape is invalid.
- `equationSatisfied` requires both valid variable rectangles and matching target area.

For the system:

- Compare x lengths across equations only when both corresponding regions are valid.
- Compare y lengths under the same rule.
- Report agreement as unknown/incomplete, agrees, or disagrees; missing data is not equality.
- `systemSatisfied` requires both equations satisfied and both variable lengths agreed.

A group with the right cell count but holes cannot satisfy the system. Two individually satisfied equations with different variable assignments cannot satisfy the system either.

## 7. Context-menu workflows

Context menus are a primary interaction surface, alongside existing toolbar/keyboard controls. Preserve mouse right-click, keyboard Context Menu/Shift+F10, and touch long-press. Do not attach different mathematics directly to a rod face; actions target the existing semantic train selection.

### Existing actions

Reuse shared Clone, Make a train, Undo train, Regroup to ones, Regroup to addends, applicable factor/area arrangements, orientation and Delete choices. Availability comes from the same scene `check` path that `apply` uses.

Add board-specific guards where needed: selected trains from different semantic regions cannot be joined by Make a train. A variable-row clone must remain in the requested region and fit without overlap. Generic factor arrangements may create a useful candidate, but they do not automatically satisfy coefficient row count or equation area.

Do not use existing factor menus as the sole way to build long rows: current supported factor shapes may constrain a single constituent rod length. Systems commands must construct each long row as multiple 1–10 rods.

### Systems-specific choices

| Selection/context | Menu command | Behavior |
| --- | --- | --- |
| Several horizontal rods in one region | Make a train | Existing composition, checked for same-region membership; creates a selectable row train. |
| One contiguous horizontal row/train | Repeat row into this group | Preview copies into the coefficient lanes, without clearing other material silently. |
| One variable group | Arrange as coefficient rows | Redistribute that group's selected/all explicit material into its fixed row count if divisible and placement fits. |
| The two groups in one equation | Redistribute this equation's area | Preview alternative allocations that preserve that equation's existing occupied area, using positive integer row lengths. |
| A valid equation candidate | Test candidate in other equation | Explicitly preview constructing the same x/y lengths in the other equation. Never synchronize silently. |
| Region background | Add rod here / select group material | Set explicit creation destination or select the region's trains. |

Use the existing distinction between `SceneMenuChoice` actions and commands. A command opens a preview/chooser and does not mutate the scene. Extend the typed command union with named systems commands; do not send an unknown action to `useRodScene` and reinterpret it inside the renderer.

Pass target region IDs and captured input IDs/state explicitly. Background region requests may require a separate typed menu target because the current menu request identifies a train. Introduce a narrowly scoped discriminated target or separate board-region menu adapter; preserve existing train menu callers.

For context menus, show specific disabled reasons: “Select rods from one variable group,” “This group has 25 cells; 25 cannot form 3 equal whole-number rows,” or “The destination already contains material.” Do not reveal hidden solution values through reasons or preselected options.

### Length greater than 10 example

To construct x=14, a student can select rods 10 and 4, Make a train, and choose Repeat row into this group. If the coefficient is 3, preview three independent row trains, each with parts [10,4]. Confirm places the rows only if they fit.

An area of 42 can also use Arrange as coefficient rows for coefficient 3, deriving width 14 and the same three trains. Do not reject because 14 exceeds the rod catalog. The geometric representation is a sequence of legal rods, not a new rod value.

Each row train is independently selectable and movable. A coefficient group is a semantic region, not an implicit nested train that changes existing selection behavior.

## 8. Transformation planners and atomic commit

Board-specific planners accept validated problem/region configuration and readonly source snapshots. They produce candidate trains plus structured descriptions for preview. They do not own DOM, ID counters or mutable scene state.

Use a reusable magnitude decomposition helper for new rows: repeatedly use rod magnitude 10, followed by the positive remainder. Other partitions remain legal student arrangements. Avoid duplicating this builder if the shared rod layer already exposes a suitable helper.

For commands that preserve area, prove:

- Original and candidate area in the intended equation/group are equal.
- Unselected regions, equations and staging material remain unchanged.
- Every generated part has magnitude 1–10 and positive sign.
- All new rows fit within the configured regions without overlap.

Repeat-row and Test-candidate commands can add or replace material; describe the effect and area change explicitly. They are not conservation claims. If destination replacement is requested, preview the removed and added material and require explicit confirmation.

For an equation-area-preserving redistribution with coefficients a and b and existing area A, enumerate finite pairs satisfying a*x + b*y = A with 1 <= x,y <= laneColumns. Do not solve against both equations to rank or highlight the correct answer. If no such pair exists, explain that the current area cannot make two positive whole-number rectangles with those row counts.

All mutations must use the scene's atomic candidate validation/commit boundary. Add a small typed candidate/transformation pathway if needed, reusing validation and ID allocation. Avoid an unvalidated mutable scene setter or sequential deletes/creates that expose partial results. For simple operations, use existing actions directly.

A preview captures source identity and configuration. Confirm rechecks current input snapshots and problem/regions, regenerates the candidate, and validates it. Movement, import, configuration changes or deletion invalidate stale previews. Dismiss on tab deactivation, edit-disable, camera/view changes and unmount using existing gesture lifecycle hooks.

Commit selection and focus consistently: select newly formed row trains, restore focus to a surviving/new primary train, or the viewport if none remains. Ghost rows stay decorative and do not alter constraints, occupancy or authored snapshots.

## 9. Feedback and discovery

Feedback describes observed constraints:

- “Equation 1: 34 of 34 cells. Both groups form rectangles.”
- “Equation 2: 36 of 22 cells; 14 excess.”
- “The x rows have different lengths.”
- “Both x groups are rectangles, but their lengths disagree.”
- “These rows have equal area but start at different columns.”

Do not show the correct x/y assignment in the initial state, infer it for missing groups, or auto-correct placements. A collapsed optional status panel can reduce visual guidance while leaving labels and user-requested feedback accessible.

Test candidate is explicit: valid source rectangles can supply x=8,y=2 to a preview of the second model. The student sees the second area become 36, not an app-selected replacement with x=3,y=5. Keep the source unchanged.

Use textual equations, labelled region groups, accessible row/area summaries and existing keyboard train controls. Do not create a tab stop for every empty grid cell. Announce meaningful completed changes rather than every pointermove. Respect reduced motion for optional transitions.

## 10. Authoring, files and problem changes

Add a systems-specific discriminant to `BoardDescriptor` and its strict schema. Persist the complete problem and layout configuration: equation IDs, coefficients, targets, lane capacity and region spacing. A snapshot of rods without its equations is not a reproducible activity.

Update every exhaustive board-kind switch: file compatibility, geometry/goal adapters, coach capture/transport validation and any host board registry. Keep existing descriptors and old files unchanged. New signed or role-bearing material must be rejected under this board's positive-only rules.

Reuse `RodPlaygroundAuthoring` and `useLevelAuthoring` through an appropriate goal adapter. Do not pretend a generic occupied-area goal is equivalent to system satisfaction. If a system-satisfied goal is introduced, give it a typed schema/adapter implementation. Alternatively, keep generic authoring goals null and display derived system status separately in the first milestone; document which path is chosen.

Problem/configuration remains fixed across captured steps of one document. A later problem editor must use a guarded workflow: offer to retain compatible placements or start a new problem, validate every saved step against changed regions, and never silently reinterpret old snapshots under new coefficients.

Reset returns to the problem's explicit initial scene and dismisses gestures/previews. Clear removes working material but retains equations/configuration and does not erase captured steps. Document these distinctions in control labels. Do not silently seed the known solution as the initial scene.

Before importing, validate the complete problem/config and every step atomically. Reuse the existing matching-configuration policy or implement an explicit preview-and-confirm problem import; do not bypass descriptor checks. Exports must capture the current systems descriptor. The coach receives problem and actual board status, not decorative coefficient rods or ghost candidates.

## 11. Future algebraic transformations

Elimination and substitution require representations of equivalence, not just matching visible areas. Two groups with equal numeric area are not necessarily interchangeable algebraic expressions.

Later plans must distinguish copying material from multiplying both sides of an equation, and deleting cells from subtracting equal quantities on both sides. Preserve symbolic coefficients and right-hand sides in those operations. Do not repurpose zero-pair cancellation from the Array board as equation elimination without a separate algebraic contract.

General undo/redo should record committed scene/problem transactions, not transient drag frames or previews. Scope its history, ID behavior, reset and authoring interaction before implementing it as a reusable facility.

## 12. Delivery stages

1. **Types, geometry and pure evaluation.** Fixtures for both systems; derive all region geometry from config. No UI solution solver.
2. **New tab and basic manipulation.** Shared HTML scene, four variable regions, creation destinations, selection, existing menus and camera. Keep other playgrounds unchanged.
3. **Constraint readouts and long rows.** Valid/invalid rectangles, exact occupied area, x/y agreement, and trains longer than 10.
4. **Context-menu construction.** Repeat row and coefficient-row arrangement through preview and atomic commit. Test with coefficient 3 and row length 14.
5. **Candidate testing and redistribution.** Explicit other-equation testing and finite single-equation area-preserving alternatives. No automatic cross-equation synchronization.
6. **Authoring and strict files.** Capture/update/reset/clear, full systems descriptor, all-step validation and coach capture integration.
7. **Later expansion.** Problem selector/editor, optional hints, transaction history, elimination and substitution after their contracts are specified.

A basic exploratory first release can ship after stage 6 without later algebraic transformations. Do not mark context-menu stages complete if only toolbar shortcuts exist.

## 13. Verification and acceptance

| Layer | Required cases |
| --- | --- |
| Arithmetic | Fixture x=3,y=5 satisfies both; x=8,y=2 satisfies only first and gives second excess 14. |
| Long variables | x=14,y=4 solves the second fixture with individual parts <=10; [10,4], [7,7] and fourteen ones evaluate identically. |
| Shape | Empty/missing lanes, gaps, equal-count misalignment, unequal widths, and right area with invalid rectangles remain unsatisfied. |
| Agreement | Two locally satisfied equations with different candidate assignments never satisfy the system; incomplete values report unknown. |
| Regions | No cross-region train spans, no double-counted overlap, staging excluded, decorations/ghosts excluded, negative material rejected. |
| Menus | Right-click, keyboard and touch open shared menus; same-region joining and disabled reasons work; long rows can repeat into coefficient groups. |
| Atomicity | Invalid placement/preview, changed source, changed configuration and failed destination replacement preserve scene, selection and IDs. |
| Conservation | Coefficient-row arrangement and equation redistribution preserve intended area; other regions remain unchanged. |
| Discovery | Candidate testing never selects the true solution automatically and never changes source material without explicit action. |
| Persistence | Problem/config plus all steps round-trip; old board files remain unchanged; malformed/later-step input rejects atomically. |
| Camera | Dragging, snapping, marquee and menu anchoring at 25/50/100/200% zoom and nonzero pan; long trains remain semantic HTML. |
| Regression | Existing Array, negative rods, cancellation, Fraction and MathTabla behavior and file compatibility remain intact. |

Add pure tests beside systems helpers and browser tests in `tests/e2e/systems-of-equations.spec.ts`, included in the existing playground Playwright configuration. Use the repo-installed runtime. Capture screenshots in `output/playwright/systems-of-equations/` showing an incomplete model, the x=8/y=2 rejected candidate, a solved model, a long-variable model and a context-menu preview.

Run from `tsia-coach-web-nuxt/`:

```powershell
pnpm test
pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json
# Run pnpm exec eslint on touched files.
pnpm exec playwright test --config playwright.playground.config.ts
```

Configure `PLAYGROUND_URL` when using an existing frontend. Do not introduce external browser tooling when the repo-installed Playwright runtime is available.

## Completion example

A student opens the fixture, builds one candidate using the rod context menus, tests it against the other equation, sees accurate excess/missing area and disagreement, revises the rows, and captures their discovery steps. They can also build x=14 from a 10-and-4 train and use it consistently across both equations in the long-variable fixture. At every point, the visible material and computed constraints come from the same committed scene.


## November 2, 2026: continuous-grid presentation

The default development fixtures now use `layout: 'continuous'`: adjacent x/y row bands, one separator row between equations, a two-column coefficient/variable gutter, and a shared visible grid. Per-row labels and the equation text preserve variable identity while the four band accents follow the supplied reference. Rod colors still represent magnitude.

The Systems tab retains the Array shell, rod layer, context menus and camera. Creation destination and problem selection are compact selects; detailed feedback is collapsed below the board. Older files omitting `layout` retain their original spaced geometry and saved coordinates. New exports preserve the explicit layout setting. Mathematical region evaluation and transformation planners derive their geometry from the same configuration in either layout.


### Empty starting board

The Systems board starts with no placed rods. Students create material from the top palette, using the selected destination or a region context menu. Reset board and problem switching also start empty; there are no automatic starter rods or activation-time seeding. The blank staging grid remains available for optional loose material and counts toward neither equation.
