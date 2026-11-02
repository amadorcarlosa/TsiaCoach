# Stage 6: explicit zero-pair cancellation

Updated: October 31, 2026.
Status: first cancellation release implemented on Array (October 31, 2026). Many-pair cancellation, mixed-train simplification and an animated exit remain follow-up work.

Implementation notes:

- Planner: `app/components/rod/scene/zero-pair-cancellation.ts` (`planZeroPair`, `applyZeroPairPlan`, `zeroPairBaseline`); text in `zero-pair-text.ts`.
- Scene: `ScenePolicy.allowZeroPairCancellation` and the `cancel-zero-pair` action in `useRodScene.ts`; `expectedInputs` is compared with `zeroPairBaseline`, a canonical `copyScene` of both inputs. `scene.planZeroPair(ids)` is the read-only plan for previews.
- Preview: `useCancellationPreview.ts` owns the session; `ZeroPairPreview.vue` is a native modal `<dialog>` docked bottom-right so the rods stay visible. The menu opens it through a `kind: 'command'` choice, which never commits.
- Ghosts are drawn by `DraggableRod.vue` from a `RodPreview` passed through `SceneRodLayer`; the semantic object, its name and its input are unchanged.
- No animation ships in this release.
- Tests: `zero-pair-cancellation.test.ts` (all 100 magnitude pairs in both orders, rejections, stale guard) and `tests/e2e/zero-pair-cancellation.spec.ts` (screenshots in `output/playwright/zero-pair-cancellation/`).

Prerequisite: [Negative rods implementation guide](negative-rods-implementation-guide.md). Follow the ownership boundaries in [Code structure and patterns](code-structure-and-patterns.md) and [Frontend consistency implementation guide](frontend-consistency-implementation-guide.md).

## 1. Outcome and scope

A student selects one positive rod and one negative rod, previews the zero pair, and explicitly confirms cancellation. Equal magnitudes disappear together. Unequal magnitudes show a decomposition and leave a rod with the larger input's sign.

The first release accepts exactly two independent, single-part trains on the signed Array board. Each train is already one selectable HTML object. Selecting a constituent face of a multi-part train continues to select that whole train; cancellation does not introduce part-level selection or nested groups. Students can use the existing Undo train action to expose constituent rods first.

Support horizontal and vertical rods, including two different orientations. Initially reject towers with “Lay both rods horizontally or vertically before cancelling.” A concave tower is supported by the renderer already, but unequal tower decomposition needs a separate placement design and is outside this milestone.

Do not implement automatic mixed-train simplification, cancellation of many pairs at once, general mixed-sign factor/addend regrouping, overlap-to-cancel gestures, or global undo history in this release. Existing mixed-sign regroup guards remain in effect. This milestone introduces a specific mixed-sign arithmetic operation, not permission for every existing operation to accept mixed material.

## 2. Student interaction

### Equal magnitudes

1. Select +4 and -4 using existing multi-selection controls.
2. Choose **Cancel zero pair** from the shared scene menu.
3. Show the equation `4 + (−4) = 0` and highlight both matching rods.
4. Offer **Cancel pair** and **Keep rods** buttons.
5. On confirmation, remove both rods in one scene commit and announce the result.

Opening the preview never removes material. Keep rods, Escape, or closing the preview leaves the committed scene unchanged.

### Unequal magnitudes

For +10 and -4, offer **Find a zero pair**:

1. Preview the decomposition `10 = 6 + 4` on the positive rod's existing footprint.
2. Explain `6 + [4 + (−4)] = 6` with the zero pair highlighted.
3. Offer **Cancel pair** and **Keep rods**.
4. Confirm once: remove the matching +4 and -4, leaving +6.

The decomposition is preview-only. No intermediate split is saved or committed. If the student declines, the original +10 remains intact. Announce the decomposition before the cancellation; do not make an animation the only explanation.

For +4 and -10, show `−10 = (−6) + (−4)` and leave -6. For equal magnitudes, show “No rods remain,” rather than creating a zero-length or zero-value rod.

Matching rods can be anywhere on the board. Do not require adjacency, overlapping, or moving them into a special region. Their positions need not change to express their arithmetic relation.

## 3. Ownership and files

Paths in this section are relative to `tsia-coach-web-nuxt/`. Proposed filenames should be adjusted to repository conventions if necessary; responsibilities should remain separate.

| Owner | Responsibility |
| --- | --- |
| Existing `app/components/rod/scene/rod-arithmetic.ts` | Resolve sign, signed values and totals. Reuse `partSign`, `partSignedValue`, `signField`, and formatting helpers. |
| Proposed `app/components/rod/scene/zero-pair-cancellation.ts` | Pure eligibility, decomposition and replacement planning. No Vue, DOM, timers, or ID allocation. |
| Existing `app/components/rod/scene/rod.scene.types.ts` | Add the cancellation action and explicit capability if required. |
| Existing `app/composables/useRodScene.ts` | Validate current inputs and stale previews; rebuild the plan, validate the complete candidate, and commit atomically. |
| Proposed `app/composables/useCancellationPreview.ts` | Own transient preview session, captured baseline and invalidation. Coordinate opening, confirmation and dismissal. |
| Proposed `app/components/rod/scene/ZeroPairPreview.vue` | Render the equation, explanation, confirmation controls and accessible announcements. No mathematical mutation. |
| Existing `SceneRodLayer.vue`, `SceneRod.vue`, `DraggableRod.vue`, `CuisenaireRod.vue` | Consume preview presentation and draw highlights/ghost decomposition through the existing rod renderer. |
| Existing `useSceneMenu.ts` and shared menu choices | Expose eligibility and open the preview; preserve normal menu/focus behavior. |
| Existing Array playground composition | Enable the capability and connect preview controls to the scene and renderer. |

Keep cancellation rules out of the camera, geometry helpers, color palette, negative-rod tray, and DOM click handlers. Other boards should not need branches naming Array inside their common scene operations. Use scene policy/capability to opt in.

## 4. Mathematical contract

Given magnitudes `p` and `n` for the positive and negative input rods:

```ts
cancelledMagnitude = Math.min(p, n)
signedRemainder = p - n
remainderMagnitude = Math.abs(signedRemainder)
```

Inputs have opposite resolved signs and integer magnitudes 1–10. Their selection order must not affect the answer. The remainder is at most 9, so it is a supported single Cuisenaire rod. Do not cast a signed remainder to a rod magnitude.

Required invariants:

- Signed value is conserved: `beforeSignedTotal === afterSignedTotal`.
- Removed physical magnitude equals `2 * cancelledMagnitude`.
- Every surviving rod has a positive magnitude and a valid sign.
- No zero rod is created.
- Every unselected train remains identical, including metadata and ID.
- No unrelated train moves to make the result fit.
- Geometry continues to use positive magnitude, never net value.

| Inputs | Cancelled pair | Survivor |
| --- | --- | --- |
| +4, -4 | +4, -4 | None |
| +10, -4 | +4, -4 | +6 |
| +4, -10 | +4, -4 | -6 |
| +1, -10 | +1, -1 | -9 |
| +10, -1 | +1, -1 | +9 |

## 5. Pure planner

The planner accepts readonly scene inputs and returns a discriminated allowed/rejected result. Its successful result should contain enough information for both preview and commit:

- Target train IDs, positive/negative input identity, resolved signs and magnitudes.
- Cancelled magnitude and signed remainder.
- Preview decomposition pieces with local offsets and semantic roles such as remainder and cancelling material.
- Replacement scene objects or replacement instructions.
- A structured explanation model; format visible text in the presentation layer using shared signed-number formatting.

Check eligibility before planning: exactly two distinct existing IDs; one part per train; opposite signs; supported orientations; compatible material roles; signed cancellation permitted by the scene; and editing available at the scene boundary. Two positive rods, two negative rods, duplicates, missing IDs, multi-part trains, and towers return specific reasons.

Initially reject role-bearing/layered material rather than interpreting denominator/numerator roles as ordinary signed material. Array's ordinary signed rods have no such role. If another activity later enables cancellation, define its role policy explicitly.

Do not mutate the source trains, selection, or ID counter. Planning the same inputs repeatedly must produce the same geometry and arithmetic result.

## 6. Placement and identity

Preserve the larger rod's train ID and anchor when a remainder exists. Preserve its orientation, sign and applicable metadata. Use the existing sign serialization convention: positive output omits the optional sign field.

Preserve the part's existing local starting offset. For horizontal material, lay the preview remainder first along increasing x, followed by the matching material. For vertical material, use increasing y. Thus a horizontal +10 beginning at local x=0 previews +6 at x=0 and +4 at x=6. The -4 stays at its own location.

After confirmation, the remainder stays where the first preview piece was. The smaller rod is removed. An equal pair removes both train IDs. No new train IDs are needed in this milestone.

The decomposition partitions the original occupied cells exactly; the remainder uses a subset of those cells. Existing candidate validation still checks the entire result for bounds, overlap and policy. Do not pack or compact the board after cancellation.

Clear decomposition-specific metadata such as obsolete `addendGroup` on the newly formed single remainder part; do not copy stale group markers that no longer describe the resulting train. Preserve unrelated train-level metadata according to its existing contract.

Select the surviving remainder after commit. For an equal pair, clear selection and focus the board viewport. Announce which objects were cancelled and the resulting signed value.

## 7. Scene action, stale previews and atomic commit

Use the current build/check/apply architecture. A proposed action shape is:

```ts
{
  type: 'cancel-zero-pair',
  expectedInputs: /* captured descriptors of the two original trains */
}
```

The existing IDs passed to `scene.check(ids, action)` and `scene.apply(ids, action)` remain the targets. Do not accept client-provided candidate trains, cancelled quantities or arithmetic results as authoritative.

`expectedInputs` should capture the complete immutable source state needed to recognize both inputs: IDs, anchors, parts, signs, orientations and relevant metadata. Reuse the repository's canonical snapshot-copy/comparison approach. A sign-only comparison or an array index is insufficient. This is a stale-view guard, not a security token.

On check and apply:

1. Resolve targets from the current committed scene and verify capability/editability.
2. Verify that the inputs still match the preview baseline. Reject with “The rods changed. Preview the zero pair again.” if they do not.
3. Recompute eligibility and the cancellation plan from current data.
4. Construct the complete candidate scene, preserving unselected trains.
5. Validate the candidate through the existing scene validator.
6. Commit trains, selection and message once, only after success.

`check` and failed `apply` allocate no IDs and do not alter the scene. `apply` returns no created IDs for this milestone. Do not reuse the remove/delete action twice: that would expose an intermediate state and make failure atomicity harder to guarantee.

## 8. Preview session and lifecycle

The preview composable owns transient state, not the persisted scene. Suggested state is idle or previewing with target IDs, owned baseline snapshots and the pure plan. A separate “show decomposition/show zero pair” UI phase can present unequal rods without a scene commit.

Before opening, cancel unfinished rod movement/inertia and marquee gestures, then capture the committed inputs and plan. Close the invoking menu. A menu may dispatch a distinct preview request to the coordinator; opening preview is not itself the mathematical scene action. Keep the existing menu action contract clear rather than silently routing a committing action to a mutation-free path.

While the preview is active:

- Block board edits, rod dragging, marquee, deletion, creation and toolbar transforms.
- Keep the two original semantic rod objects in the DOM.
- Draw proposed subdivision/highlighting as decorative overlays or ghost parts using the shared renderer; ghost pieces are `aria-hidden`, unfocusable and pointer-transparent.
- Hide or replace the original larger cap visually only as needed to reveal the ghost decomposition. Do not double-count ghost material in scene readouts, occupancy, object counts or goals.
- Cancel the session if selected targets or source scene change, replacement/import occurs, board dimensions change, the board deactivates, or policy/editability changes.
- Dismiss on camera pan/zoom/reset in this first release; wire into the existing view-change cancellation boundary. Cancellation preview should not leave projected highlights at old coordinates.
- On unmount or lost application focus, dismiss without committing.

Confirm uses the captured descriptors and revalidates. A stale or invalid commit preserves the current scene, clears stale graphics, and announces the reason. Cancelling restores focus to an existing selected source rod; otherwise use the viewport.

Use the existing menu/dialog conventions for focus management. For a modal preview, use an accessible dialog with a title, labelled equation/explanation, trapped focus and Escape support. Keep rods is the safe initial focus. The confirmation label should describe the action, not merely say “OK.”

## 9. Animation and semantics

Use a matched highlight for both cancelling quantities. Distinguish the remainder from matching material through labels and boundaries as well as color. Concave negative styling and top-surface selection indicators remain visible.

An optional animation may briefly pulse or fade the zero pair, but it must not own the commit or delay mathematical correctness until a timer completes. Commit on confirmation; any exit animation uses decorative snapshots with no remaining hit targets. Respect reduced motion and clean up on dismissal/unmount. Use the existing animation infrastructure if animation is added; the initial implementation can ship without it.

Screen-reader explanation examples:

- “Positive 4 and negative 4 make zero. Cancel this pair?”
- “Split positive 10 into positive 6 and positive 4. Positive 4 and negative 4 make zero. Positive 6 will remain.”
- After confirmation: “Zero pair cancelled. Negative 6 remains.”

Equations must be text or semantic markup, not an image or a canvas-only label. Existing rod labels remain authoritative; preview pieces do not create duplicate selectable rods.

## 10. Persistence, goals and coaching

No file format extension is required for the cancellation result: it is an ordinary signed scene using the stages 1–5 contract. Do not serialize a preview, its baseline, or ghost material.

Do not auto-capture or overwrite authored steps. A confirmed cancellation makes the current step dirty through the existing scene comparison. Keep rods leaves it clean if it was previously clean. Capturing or switching steps during a preview must first dismiss it or use the existing guarded workflow; never capture ghost decomposition.

A zero-total occupied pair satisfies signed total 0 before cancellation but fails empty-region. After equal cancellation, the region can satisfy empty-region; signed total remains unchanged. Unequal cancellation reduces occupied physical cells and preserves signed total. Reevaluate goals from committed scene data only.

If coach explanations include cancellation, derive them from structured planner/result data rather than UI animation timing. Existing signed snapshots remain sufficient to represent the final board. Do not claim a durable cancellation history exists unless an event/history contract is separately implemented. Server answer correctness remains server-owned.

## 11. Implementation sequence

1. **Pure planner and invariants.** Add opposite-pair eligibility, deterministic decomposition, placements and replacement instructions. Cover the complete 10 by 10 magnitude table.
2. **Scene action.** Add explicit capability and atomic stale-safe check/apply handling. Verify selection, focus target, ID behavior and preservation of unrelated trains.
3. **Equal-pair preview.** Integrate the menu, accessible preview and explicit confirmation for +a/-a. No animation is required.
4. **Unequal-pair preview.** Show the larger rod's subdivision and signed remainder, then commit through the same action.
5. **Lifecycle and integration.** Connect camera changes, tab switches, editing state, authoring, import/replacement and unmount to session dismissal.
6. **Browser and regression review.** Verify both input orders, mouse/keyboard/touch, both themes, board zoom/pan and existing positive/negative workflows.

Ship the capability only when preview, confirmation and stale-action validation are connected. Keep later many-pair and mixed-train operations disabled until their own rules are implemented.

## 12. Acceptance tests

| Area | Required checks |
| --- | --- |
| Arithmetic | All 100 positive/negative magnitude combinations conserve signed value and remove twice the matched magnitude; test both selection orders. |
| Equal pairs | Both rods disappear, no zero object appears, selection clears, no IDs are allocated, unrelated trains remain unchanged. |
| Unequal pairs | +10/-4 leaves +6; +4/-10 leaves -6; survivor keeps the larger source ID, anchor and orientation; offsets remain valid. |
| Geometry | Horizontal, vertical and differing input orientations; original footprint is exactly partitioned in preview; result stays within it. |
| Rejection | Same-sign, duplicate/missing targets, multi-part trains, towers, role-bearing material and unsupported boards reject without mutation. |
| Preview | Opening and Keep rods/Escape do not change snapshots, goals, dirty state or ID counters. Ghosts are not counted as objects or cells. |
| Staleness | Move, rotate, change sign, delete, replace or resize after planning; applying the stale plan cannot cancel newly changed material. |
| Lifecycle | Zoom/reset/pan, tab switch, edit-disable, blur and unmount dismiss graphics and release any gesture/focus state. |
| Accessibility | Keyboard reaches both actions; safe initial focus; Escape works; equations and remainders are announced; focus returns predictably. |
| Input | Mouse, keyboard multi-select and touch all target the two semantic train objects. Decorative overlays do not intercept events. |
| Goals/files | Total 0 differs from empty before cancellation; result round-trips through existing signed files; saved authored steps are not overwritten. |
| Regression | Positive-only operations, stages 1–5 negative operations, mixed-train regroup rejection, board navigation and other-board isolation still pass. |

Place pure tests beside `zero-pair-cancellation.ts`, scene-action tests beside the existing rod scene tests, and browser tests in a new cancellation spec included by `playwright.playground.config.ts`.

Run from `tsia-coach-web-nuxt/`:

```powershell
pnpm test
pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json
# Run pnpm exec eslint on touched source and test files.
pnpm exec playwright test --config playwright.playground.config.ts
```

Use the installed Playwright runtime, configure `PLAYGROUND_URL` for an existing frontend when appropriate, and write screenshots/traces under `output/playwright/zero-pair-cancellation/`. Add screenshots showing both equal and unequal previews, selected negative concavity, and the resulting remainder. Browser checks should include 25%, 50%, 100% and 200% zoom with nonzero viewport scrolling.

## Completion boundary

Stage 6's first cancellation release is complete when a student can explicitly cancel two independent opposite-sign rods, see the decomposition for unequal magnitudes, and keep or confirm the result without losing semantic HTML, state integrity or value conservation. Broader mixed-train simplification and unrestricted mixed-sign regrouping remain separate follow-up work.
