# Rod-count conversion workspace: rectangles and equal groups

Date: November 6, 2026.
Status: implementation handoff; proposed behavior, not a report of completed changes.

Companion to the [rod-count systems solver guide](rod-count-system-solver-implementation-guide.md). This guide supersedes its single-step exchange-preview workflow and automatic exchange packing. Keep its candidate mathematics and representation contract.

## Requested outcome

Give the learner an editable conversion workspace with the existing Array board tools. In that workspace, replace **Make a train** with **Create rectangle**. After forming a rectangle from 24 selected cells, offer **3 groups of 8** through its context menu. The learner can manipulate the material, inspect the grouping, and apply or cancel the conversion.

Keep the equation models and summaries visible throughout. Rearranging conversion material must not erase Equation 2 or silently reinterpret the confirmed variable counts. Update both models together when the learner applies a valid conversion.

This is an editing workspace, not a modal preview that disables the tools. Continue using semantic HTML, the shared rod scene, grid, camera and context menu. Do not introduce a separate renderer, pointer-coordinate system or mathematical solver.

## What the supplied images mean

The system is:

```text
3x + 8y = 71
9x + 4y = 73
```

Here x and y are counts. An x unit is a 3-rod in Equation 1 and a 9-rod in Equation 2. A y unit is an 8-rod above and a 4-rod below.

The reference image shows the candidate **(13, 4)** while eight of its thirteen x rods are being rearranged for the next exchange:

- Five upright green 3-rods remain at the left: 15 cells.
- The other eight green 3-rods form eight horizontal rows, each three cells wide. Together they fill a rectangle three columns wide and eight rows high: 24 cells.
- Four existing brown 8-rods remain beside that rectangle: 32 cells.
- Green material still totals 39, so the upper readout is **39 + 32 = 71**.
- The lower check still uses thirteen 9-rods and four 4-rods: **117 + 16 = 133**.

The green 24-cell rectangle has not yet become three additional y rods. That happens when the learner chooses **3 groups of 8** and applies the conversion. The new candidate is then (5, 7), and the lower check becomes 45 + 28 = 73.

Required sequence:

| Confirmed counts | Upper area | Lower area | Conversion |
| --- | --- | --- | --- |
| (21, 1) | 63 + 8 = 71 | 189 + 4 = 193 | Eight 3-rods → three 8-rods |
| (13, 4) | 39 + 32 = 71 | 117 + 16 = 133 | Eight 3-rods → three 8-rods |
| (5, 7) | 15 + 56 = 71 | 45 + 28 = 73 | Common solution; stop |

The browser annotations identify a different, broken experience. Selection alone does not change the material. In the later screenshots, rotating a 3-rod makes it unassigned, the recognized count drops, and the lower model disappears. The guide must fix that interruption without claiming that a partially converted shape is already a new candidate.

## Current code and the missing abstractions

Paths in this table are relative to `tsia-coach-web-nuxt/`.

| Owner | Current behavior | Required change |
| --- | --- | --- |
| `app/components/systems/systems.count-layout.ts` | `classifyCountMaterial` counts coefficient-valued upright parts; a horizontal 3-rod becomes unassigned. `derivedLowerTrains` builds the lower model from counts. | Keep strict committed-scene classification. Interpret conversion work through a transaction baseline, not through each temporary part layout. |
| `app/components/systems/systems.count-evaluate.ts` | `clean` becomes false with unassigned material, and `lower` becomes null. | Keep mathematical validation honest. Add an explicit display state for a retained check during conversion or unfinished free editing. |
| `app/composables/useSystemsCountActivity.ts` | `derived` returns an empty array when evaluation is not clean. `openExchange` opens the shared static preview. | Own conversion lifecycle, baseline, active editing target and the display evaluation. |
| `app/components/systems/systems.count-operations.ts` | `count-exchange` requires a clean feasible candidate and exactly the required x units. It calls `arrange`, which also moves/recreates other rods. | Reuse selection and arithmetic checks. Commit only the chosen material's replacement. Keep **Arrange x, then y** as a separate action. |
| `app/composables/useBoardTransformPreview.ts` | Static plans, stale checks, confirmation, dismissal and focus. The host blocks normal editing while it is active. | Keep it for static previews. An editable conversion session needs its own draft lifecycle; do not simply remove the global editing guard. |
| `app/components/tabla/area-grouping.ts` | `tiledRectangle`, `areaGroupReadings`, `areaGroupPartitions` and `areaGroupParts` already validate/read/partition a filled rectangle. | Reuse these. The selected-objects-to-rectangle operation is missing. |
| `app/composables/useAreaGroupingMenuChoice.ts` | Offers area readings for one filled rectangle. Explicitly rejects multiple selected objects. | Reuse after **Create rectangle** has combined the selected material. |
| `app/composables/useRodScene.ts` | Shared creation, movement, cloning, regrouping, rotation, placement validation and atomic board transforms. `allowAreaRegroup` is opt-in. | Use a second instance for the draft; opt into rectangle operations. Add a small shared read-only-object policy if needed to protect surrounding material. |
| `app/components/rod/scene/rod-menu-choices.ts` | Shared base menu offers **Make a train**, which creates a linear group. | Compose a conversion-specific rectangle choice in place of that entry; preserve other boards' menus. |
| `app/components/playground/SystemsOfEquationsPlayground.vue` | Composes menus, toolbar, scene interactions, preview, rendering and authoring. | Route all conversion tools to the draft scene and render the confirmed lower check throughout. |

The existing `RodTrain` name does not require every object to be linear: its parts already have two-dimensional offsets, and factor rectangles already use that structure. A filled rectangle can therefore be represented with existing scene geometry. Do not introduce a second general-purpose group tree or store a fictitious rod with value 24.

There are real gaps to implement, rather than just menu wording to change:

1. Combine a multi-object selection and arrange its aggregate area as one rectangle.
2. Edit that material in isolation while retaining a confirmed mathematical baseline.
3. Partition the rectangle into logical groups and release the converted groups as independent scene objects.

## Interaction contract

### Enter conversion

From a feasible, unsolved Equation 1 candidate:

1. Select the required x units using normal click, modified click or marquee. Keep **Select 8 x rods to exchange** as a convenient shortcut for this problem.
2. Open the ordinary context menu on the selection. Offer **Convert selected area…**, with “8 x rods · 24 cells” in the description.
3. Opening conversion captures the source scene and selection, and activates draft editing in the upper work area. The lower board remains visible and labelled **Confirmed candidate: x = 21, y = 1** for the first conversion.

Count source units by parts, not by selected train IDs. A selected train containing several whole x units contributes all those units. Initially require whole selected trains whose parts total exactly the required units. Do not silently take some parts from a selected train. Explain how many units are selected and reject a mixed selection even if its aggregate area happens to be 24.

### Create rectangle

In the conversion menu, replace **Make a train** with **Create rectangle…**. This must be a new area operation, not the linear train operation with a different label. It must accept the selected upright 3-rods without first requiring the learner to lay each one horizontally.

Show the selected area and available fitting factor shapes. For the reference exchange, make **3 columns × 8 rows — 24 cells** the suggested shape because it supports the target 8-unit grouping. Also expose other legal factor shapes; do not hard-code 24 or always choose the factor pair closest to a square.

For the suggested shape:

```text
Before: 8 upright 3-rods       Rectangle: 8 horizontal 3-rods
        area 8 × 3 = 24                  width 3, height 8
```

The created rectangle remains green in this case because its eight constituent rods are still actual 3-rods. Draw cell lines, the rectangle boundary and its area. Moving or selecting the rectangle acts on the full rectangle. **Ungroup rectangle** releases its constituent rods at their current positions.

Creating a rectangle may rearrange/repartition the selected material; its area must be unchanged. It is different from merely grouping an already filled selection. Present the shape choice before applying that draft edit. Reject a shape that cannot fit without collisions. Never use the bounding box of a scattered selection as if all its cells were filled.

### Choose equal groups

On the filled 3-column, 8-row rectangle, the context menu offers:

```text
Group rectangle
  3 groups of 8 — vertical columns       [target y grouping]
  8 groups of 3 — horizontal rows        [current source grouping]
```

These labels come from the rectangle dimensions, through `areaGroupReadings`, not from a special-case list for this equation. Draw the proposed partition boundaries on hover/focus or selection, with an accessible text description.

Choosing **3 groups of 8** replaces the eight horizontal 3-parts with three vertical 8-unit groups covering the same rectangle cells. Those groups use the normal 8-rod color and labels. Choosing a grouping edits the draft; it does not yet change the confirmed candidate or the lower check.

The distinction between reshaping and partitioning matters:

- Rearranging an 8-by-3 rectangle into a 3-by-8 rectangle preserves area, but changes its occupied cell set.
- Partitioning the resulting 3-by-8 rectangle into columns preserves its exact occupied cell set.
- An 8-by-3 rectangle has **3 groups of 8 in horizontal rows**, not vertical columns. Labels must follow actual geometry.

### Keep the tools available

The conversion workspace uses the existing tray, selection, marquee, dragging, snapping, clone, delete, decomposition, factors and orientation controls. Commands target the draft, including keyboard and touch commands. Pan/zoom/reset continue to use the shared camera. A conversion session must not set the active draft controls to globally disabled merely because a preview/session exists.

Use **Create rectangle**, **Ungroup rectangle**, and **Group rectangle** for area work. Keep **Regroup to ones**, addends and factor choices where applicable. Existing helpers sometimes reject non-linear rectangles; implement the corresponding area operation where needed rather than leaving ordinary rectangle decomposition permanently disabled behind a linear-train error. Rectangle rotation uses a rectangular layout/transpose operation; it must not flatten the rectangle into a length-24 train. Tower remains an individual-rod operation under the existing policy.

Clone, creation and delete are allowed experiments within the draft. If they change the conversion area's amount, show, for example, **27 cells in workspace; this exchange requires 24**. Disable **Apply conversion** until the required area, grouping and output are restored. Ordinary collision, bounds and supported-sign rules still apply. “All tools” does not mean accepting an invalid conversion.

### Apply or cancel

Keep **Apply conversion** and **Cancel conversion** available outside a blocking modal. Show a compact equation bridge:

```text
8 × 3 = 24 = 3 × 8
x: 21 → 13     y: 1 → 4
3(13) + 8(4) = 71
```

Apply only when the draft contains exactly the required target groups. Release the three groups as **three independent 8-rod objects** so each can move normally afterward. Commit one validated scene action, then rebuild Equation 2 from the new counts. Do not commit one deletion/addition at a time.

Cancel discards all draft experiments and restores source selection/focus. The committed scene, counts and lower check must be exactly as before conversion, including original IDs and placements.

## Session architecture and ownership

### One committed scene; an isolated draft using the same engine

Keep the existing scene authoritative for saved material and confirmed counts. Add a conversion controller, preferably `useCountConversionWorkspace.ts`, called by `useSystemsCountActivity`.

On begin, snapshot the complete upper scene and configuration identity. Create a draft with a second `useRodScene` instance using the same placement engine and current grid dimensions. Copy the complete upper scene into it so surrounding rods remain real collision obstacles. Mark every non-source train protected/read-only for the session. Only source material and objects created from it belong to the editable conversion set.

Render the draft in place of the upper learner layer while conversion is active; do not draw the original upper layer on top of it. Surrounding rods stay visible. The lower derived layer continues rendering from the committed baseline. Reuse the existing grid world and camera so this adds no permanent stock/staging area at the bottom.

`SceneRodLayer.inertIds` and `useRodPlaygroundInteraction.eligible` already support excluding pieces from input. Use them, but also enforce protection at the scene action boundary: keyboard commands, planners and direct actions must not move, regroup, delete or clone protected sources.

If no suitable shared capability exists when implementation begins, add an optional `ScenePolicy` protected-ID getter. Check targeted IDs and verify that every protected train remains identical in a candidate result before accepting it. Apply the same rule in `check` and `apply`, including board-transform removals. Enable protection only after internal draft hydration. Other boards omit the option and retain existing behavior. Test this as a shared scene capability, not just disabled menu styling.

After every successful draft action, editable membership is the current draft IDs excluding protected IDs. New IDs from clone, decomposition and rectangle operations belong to the draft. Keep baseline source IDs separately; regrouping may legitimately replace all current draft source IDs.

Suggested session data, with names adapted to repository conventions:

```ts
type CountConversionSession = {
  baselineKey: string
  configKey: string
  sourceIds: readonly string[]
  protectedIds: ReadonlySet<string>
  baselineCounts: CandidateCounts
  step: ExchangeStep
  // The isolated scene owns mutable geometry and selection.
  // Area, grouping validity and proposed counts are derived, not independent setters.
}
```

The baseline key must include configuration/strategy identity and the source scene, not selection or camera coordinates. Any external scene/configuration change makes the session stale. Reset, import, captured-step restore, problem/tab change, editing-disable, deactivation and unmount discard the session through the existing cancellation lifecycle. Camera movement does not invalidate mathematical inputs.

### Route tools through one active editing target

The host currently binds toolbar, menu and interaction commands to `scene` and `controls`. Compose an explicit active editing target:

```text
no conversion: committed scene + committed controls
conversion:    draft scene + draft controls
```

Use that target consistently for tray creation, toolbar actions, menu availability, menu execution, selected/highlighted pieces, marquee and keyboard commands. Do not switch only the renderer while leaving the menu attached to the committed scene.

The conversion controller owns begin/apply/cancel and validation. Pure geometry belongs in shared helpers; system-specific arithmetic stays in `systems.candidates.ts` and the count planners. Vue components emit intents and render their state.

### Reuse rectangle geometry; add aggregate creation explicitly

Implement a pure shared rectangle-creation planner. Suggested location: `app/components/rod/scene/rectangle-operations.ts`.

Inputs are selected trains/parts, a chosen integer rectangle shape and placement. Validate safe integer area, positive supported material, no duplicate source IDs, and `width × depth === selected physical area`. Preserve source metadata where relevant; reject unsupported mixed roles/signs rather than dropping metadata.

Use existing footprint helpers, `factorShapes`, `factorParts`, `tiledRectangle` and area-grouping helpers. `factorParts` can tile wide rows with catalog rods. For the reference 3-by-8 shape, it naturally produces eight horizontal 3-rods. In other shapes, catalog segmentation can change; never recolor a 2-part to pretend it is a 4-rod just because the original material came from x units.

Expose rectangle creation through a scene action or a shared planner used by an opt-in board transform. Availability and execution must use the same planner and full-scene checks. Do not implement it as an unchecked component-side array replacement.

`regroup-area` already handles same-footprint repartitioning for one positive rectangle, but Systems currently does not opt into `allowAreaRegroup`. Enable the capability for conversion and replace the MathTabla-only rejection wording with capability-based wording where appropriate. Keep the opt-in behavior on other boards.

For logical groups larger than 10, use a separate train per group, tiled with catalog rods (for example, a 12-unit group is 10 + 2). Reuse `areaGroupPartitions` for boundaries. `areaGroupParts` currently returns null beyond a single catalog rod; retain that contract and add a grouped-train builder rather than casting 12 or 24 to `CuisenaireRodValue`. A column grouping uses vertical train segments; a row grouping uses horizontal segments. This also preserves boundaries for three or more groups without abusing the two-addend `addendGroup` field.

The present rod-count activity still restricts coefficients to its supported schema range. The reusable geometry may show other groupings for exploration, but only the equation's required target group can complete this conversion.

### Placement and unaffected material

Exchange only source material. Protect all other rods and their metadata/IDs. Do not call the existing whole-band `arrange` helper as a hidden part of conversion.

For a contiguous rightmost source block, first try right-aligning the suggested rectangle inside its source bounding width. At candidate (13,4), source x columns 5–12 can become a rectangle occupying columns 10–12, height 8, relative to the upper material origin. Five untouched x columns remain at 0–4; existing four y columns remain at 13–16. This reproduces the reference's separated green work block and brown block.

Validate that proposed placement against the entire draft, including protected rods, bounds and regions. For scattered source selections, search a deterministic finite set of legal placements using the existing nearest-position utilities, and show the proposed move. If none fits, report insufficient space or allow the learner to reposition editable material. Never silently move protected rods to make room.

An explicit **Arrange x, then y** after a completed exchange may compact the committed scene. It conserves counts and is separate from conversion. For the reference sequence, use it after the first exchange if needed before reproducing the second-exchange illustration.

## Mathematical and commit validation

Conversion entry also accepts a complete selection of x rods that the learner has already laid horizontally. Reconstruct source counts from those selected whole coefficient-valued rods plus the remaining upright units. Require exactly one exchange's source units, no unassigned material outside the selection, positive counts and exact Equation 1 equality. Reject towers, fragments, mixed selections and a source pair already solving both equations. This recovery is local to explicit conversion intent; ordinary scene classification remains strict.

For such a session, the baseline counts, confirmed summaries and history must use those validated source counts rather than the unfinished scene's raw classifier counts. Hide unassigned-material hatching over the editable conversion material. Cancel restores the actual horizontal source arrangement byte-for-byte; it must not manufacture an upright arrangement.

For Equation 1 `a*x + b*y = c`, reuse `exchangeStep`:

```text
g = gcd(a, b)
removedX = b / g
addedY = a / g
exchangeArea = a * removedX = b * addedY
next = (x - removedX, y + addedY)
```

For 3 and 8 this is eight 3-rods exchanged for three 8-rods, area 24. For 4 and 6 it is three 4-rods for two 6-rods, area 12. Do not use eight, three or 24 as controller constants.

Before Apply, recompute and validate all of the following:

1. The committed baseline and configuration still match the session key. Source IDs still exist with their baseline contents.
2. The baseline is a feasible unsolved candidate; the selected baseline material is exactly the required whole x units; next counts remain in the activity domain.
3. Protected draft trains are unchanged, and no draft action escaped its editable membership.
4. Editable draft area is exactly `exchangeArea`, without overlap, towers or unsupported signs at completion.
5. It yields exactly `addedY` target groups of magnitude `b`, standing upright. Intermediate rectangles, residual cells, extra cloned material or the wrong factor grouping cannot pass.
6. The final replacement scene fits all regions and collision rules. Re-evaluation has no unassigned material, counts equal `next`, and Equation 1 still totals `c`.

Use a pure final planner to remove the baseline `sourceIds` and add independently movable target groups at validated draft positions. Carry only validated integer placement/choice parameters into the existing board-transform pathway, replan from current inputs, and check the expected baseline key. Never trust arbitrary replacement trains supplied by a UI session. If the current numeric-parameter contract cannot express placement cleanly, extend the typed contract deliberately; do not serialize unchecked scene JSON inside a parameter.

Assign permanent new IDs only on successful committed apply. Draft IDs must not leak into capture or persistence. Unaffected committed IDs remain unchanged. Failed apply leaves the committed scene intact and reports why. On success, close the workspace, select/focus the created groups, and derive both equation summaries and the lower model from the new committed scene in the same update.

The current “Candidates so far” display is a sequence prefix derived from candidate index, not a recorded action log. Keep that distinction. Opening, editing or cancelling a conversion must not advance its index. Do not add a second independently writable candidate counter.

## Equation 2 and readout behavior

Expose a presentation model with explicit state, rather than passing raw draft evaluation directly to both summaries:

| State | Equation 2 and counts |
| --- | --- |
| Normal clean editing | Follow the current valid whole-unit counts, as today. |
| Conversion active | Show baseline counts/check, labelled **Confirmed candidate**; separately show workspace area and proposed groups. |
| Conversion ready | Continue baseline check; label next counts as **Proposed**, until Apply. |
| Conversion applied | Rebuild once from the newly committed counts. |
| Conversion cancelled | Continue the original check, with no count change. |
| Free editing creates unassigned material outside conversion | Retain the last feasible candidate's lower check if one exists, clearly labelled **Previous candidate — current material is unfinished**. Current upper evaluation still reports unassigned material. |
| No valid baseline exists | Show the existing waiting explanation; do not invent counts. |

The retained previous-candidate check is a transient, configuration-scoped display snapshot, not an accepted solution or independently saved mathematical state. Clear it on problem/reset/import/step restore; reconstruct from valid restored material if possible. Only refresh it from a feasible committed candidate, never from selection, ghost rods or draft parts. This handles the annotated free-rotation case without weakening the classifier.

During the reference (13,4) conversion, keep **39 + 32 = 71** as the confirmed upper decomposition, **117 + 16 = 133** as the confirmed lower check, and add **24 cells being converted: 8 groups of 3 → 3 groups of 8**. Do not show x=5,y=7 as confirmed while the rectangle is merely being prepared.

## Persistence, accessibility and scope

- Capture/export reads only committed material. Cancel the workspace through the existing capture/import hooks before authoring captures, or explicitly capture the untouched baseline and close it. Never save draft/protected-ID/session/display-cache state or lower derived rods.
- Keep the same shared camera and grid-coordinate conversion for pointer and keyboard placement. Verify menus and snapping after scroll and zoom; do not calculate positions by dividing browser pixels by a hard-coded cell size.
- Use real HTML/context-menu items for **Create rectangle**, shape choices and groupings. Expose rectangle dimensions, area, group count, units per group and draft/confirmed status in accessible names. Preserve focus/selection visuals on top faces.
- Keep menus, keyboard and touch long-press functionally equivalent. Announce completed draft actions and successful apply without repeatedly announcing pointer movement. Honor reduced motion.
- Preserve row-length Systems, Array, MathTabla, negative rods and cancellation behavior outside explicit new capability opt-ins. Signed exchanges, a new equation solver, coefficient-domain expansion and persistent nested groups are separate work.

## Implementation order and file ownership

1. **Shared area operations:** add aggregate rectangle creation, grouping/independent-group construction and focused tests. Extend scene action types/capabilities and protected-object validation only as needed. Reuse `tabla/area-grouping.ts`; add a shared menu factory rather than putting dimensions/math in a Vue template.
2. **Conversion controller:** add `useCountConversionWorkspace.ts`; integrate lifecycle and display state in `useSystemsCountActivity.ts`. Create a draft using `useRodScene` and `useRodPlaygroundInteraction`. Keep arithmetic in existing pure count modules.
3. **Host wiring:** update `SystemsOfEquationsPlayground.vue` to route the complete editing surface to the active target. Put the rectangle and grouping choices in the conversion menu. A small `SystemsCountConversionTools.vue` may render area/status/apply/cancel controls and emit intents.
4. **Board and summaries:** extend `SystemsCountBoard.vue`, `SystemsCountSummaries.vue` and `SystemsCountPanel.vue` to render draft material, protected context, partition boundaries and explicit confirmed/proposed readouts. Keep all conversion controls reachable while editing.
5. **Commit planner:** refactor `count-exchange` so it validates and replaces only conversion sources. Keep `count-arrange` separate. Retain or adapt existing static-preview tests for other commands.
6. **Lifecycle and browser coverage:** verify cancellation, authoring/persistence boundaries, accessibility, all tools, camera accuracy and regression behavior.

Work in the current checkout: rod-count files and the companion guide already contain ongoing changes. Read their current contents before editing and preserve other contributors' work.

## Acceptance tests

### Pure geometry and scene tests

- Eight separate upright 3-rods can become one 3-by-8 rectangle without the linear-train horizontal prerequisite. Its eight horizontal 3-parts tile exactly 24 distinct cells.
- Rectangle readings give 3 groups of 8 in columns and 8 groups of 3 in rows. Selecting the first produces exactly three vertical 8-unit groups covering the same cells.
- An 8-by-3 rectangle gives the opposite orientations. Changing shape and changing partition have their distinct area/cell-set invariants.
- Rectangle creation uses the aggregate selection, not eight independent factorizations of 3. Reject duplicate/stale IDs, invalid dimensions, holes when recognizing a pre-existing rectangle, unsupported material and blocked placements.
- A 12-unit logical group uses a train of 10 + 2; two such groups remain independent. No invalid catalog rod values or two-addend-only group metadata are introduced.
- Source trains containing multiple x units count by their parts. Reject wrong/mixed selections with the same total area. Protected objects reject edits through direct `check`/`apply`, not only the menu.
- Clone/delete/decomposition modify only the draft. Wrong workspace area or grouping blocks Apply; correcting it restores availability.
- Commit preserves area and expected counts for both the 3/8 and 4/6 exchanges. Unaffected objects retain IDs, positions and metadata; invalid or stale apply changes nothing.

### Browser scenarios

Extend `tests/e2e/rod-count-solver.spec.ts` with the real workspace flow; a direct preview-confirm test alone is insufficient.

1. Build (21,1), select eight x rods and open conversion through the context menu. Verify selection alone leaves both totals and all geometry unchanged.
2. Use **Create rectangle → 3 columns × 8 rows**. Verify the tools remain usable, the selected green material is 24 cells, and Equation 2 remains visible at 193 throughout draft rotation/drag/decomposition.
3. Use **Group rectangle → 3 groups of 8**. Verify three brown groups, proposed counts (13,4), and an unchanged confirmed lower check before Apply.
4. Apply. Verify (13,4), upper71, lower133, three independently movable newly created 8-rods, unchanged unaffected IDs and no saved draft state.
5. Explicitly arrange if needed, then open the next conversion. Reproduce the supplied reference: five untouched green 3-rods, an eight-row green 24-cell work rectangle, four brown 8-rods; confirmed lower total 133. Apply three groups of 8 and verify (5,7), lower total 73 and solution stopping.
6. Cancel after moving, cloning, deleting and regrouping draft material. Compare the committed snapshot byte-for-byte with the baseline; ensure focus returns to source material.
7. Rotate a rod outside conversion. Verify honest unassigned feedback plus a clearly labelled previous-candidate lower check, not a blank unexplained board or a claimed new candidate.
8. Exercise menu invocation/grouping/apply with mouse, keyboard and touch, at supported zoom extremes and with nonzero board/page scrolling. Check dragging, snapping and top selection visuals.
9. Test stale input, reset/problem/tab changes, import, capture/restore and editing-disable. No draft rods survive those boundaries. A restored incomplete scene with no feasible baseline shows waiting, not an invented lower model.

Keep browser artifacts under `tsia-coach-web-nuxt/output/playwright/rod-count-conversion/`. Capture the baseline, green work rectangle, three-group preview and committed result. Compare structure and mathematics with the reference, not fixed screenshot pixel coordinates.

Suggested commands from `tsia-coach-web-nuxt/`, adjusted for tests added during implementation:

```powershell
pnpm exec vitest run app/components/systems/systems.candidates.test.ts app/components/systems/systems.count.test.ts app/components/tabla/area-grouping.test.ts
pnpm exec vitest run --config vitest.integration.config.ts app/components/rod/
pnpm exec nuxt typecheck
pnpm lint
pnpm exec playwright test --config playwright.playground.config.ts tests/e2e/rod-count-solver.spec.ts
```

Run new rectangle/controller tests as well. After focused checks pass, run the existing playground browser regressions, especially editing, camera, Systems, MathTabla, negative rods and cancellation. Use repo-installed Playwright.

## Definition of done

The learner can select 24 cells, create a rectangle using the normal tools, choose **3 groups of 8**, inspect and manipulate that conversion, then apply it atomically. The lower check stays visible with truthful confirmed/previous labels throughout. Both reference exchanges work, the illustrated intermediate layout is reproducible, and the implementation shares scene, area, menu and camera abstractions with the existing playgrounds.

## Implementation status (November 6, 2026)

Implemented in the Rod Count Systems tab. The single-step exchange preview is gone: exchanges happen only through the workspace. **Arrange x, then y** is still a separate static preview.

| Area | Where |
| --- | --- |
| Rectangle creation, transposition, ones, groups larger than 10 | `app/components/rod/scene/rectangle-operations.ts`; scene action `make-rectangle`, policy `allowRectangles` |
| Protected objects at the action boundary | `ScenePolicy.protectedIds`, checked in `useRodScene` `build()` (targets and unchanged results, including board-transform removals) |
| Menus | `useRectangleMenuChoice` (**Create rectangle…**, suggested shape first), `rectangleRodMenuChoices` (**Ungroup rectangle**), `useAreaGroupingMenuChoice(scene, 'Group rectangle', note)` |
| One editing target | `useActiveScene`: interaction, menus, marquee, keyboard, toolbar and tray all bind to it |
| Workspace lifecycle | `useCountConversionWorkspace` (draft scene, baseline key, begin/apply/cancel, stale cancel), called by `useSystemsCountActivity` |
| Workspace reading | `systems.count-conversion.ts` `assessConversion` (area, grouping, readiness, placements) |
| Commit planner | `count-exchange` in `systems.count-operations.ts`: removes only the sources and adds upright y rods at integer `params` placements (`encodePlacements`/`decodePlacements`); `conversionSource` validates the selection by parts |
| Equation 2 display | `LowerDisplay` in `useSystemsCountActivity`: current, confirmed, proposed, previous or waiting; the previous candidate is a transient, problem-scoped display aid |
| UI | `SystemsCountConversionTools.vue` (bridge, Apply/Cancel), the workspace outline, the lower-band label and partition preview in `SystemsCountBoard.vue`, labelled summaries |

Lifecycle: capture, replace (reset, restore, import), problem changes, editing becoming unavailable (including leaving the tab) and outside scene changes all cancel the workspace. Camera changes do not.

Tests: `useRodScene.rectangle.test.ts`, `useCountConversionWorkspace.test.ts`, `systems.count.test.ts` and `tests/e2e/rod-count-solver.spec.ts` (mouse, keyboard and touch flows, the reference layout, cancel to the exact baseline, the previous-candidate label, zoom and scroll alignment, lifecycle boundaries). Screenshots are in `output/playwright/rod-count-conversion/`.

Known limits:
- Rotation is refused when the transposed rectangle has no room. A packed board leaves no room for a 3 × 8 rectangle to turn, but an 8 × 3 rectangle created in the sources' columns can turn upright.
- Apply requires the y rods to be upright single rods. Rod-count coefficients stay at 9 or less, so groups larger than 10 matter only for exploration.
