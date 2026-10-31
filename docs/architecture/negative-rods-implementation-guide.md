# Negative rods implementation guide

Updated: October 31, 2026.
Status: stages 1–5 implemented on the Array Rod Playground (October 31, 2026). Stage 6 (cancellation and mixed-sign arithmetic) is not started.

Implementation notes:

- Shared helpers live in `app/components/rod/scene/rod-arithmetic.ts` (`partSign`, `partSignedValue`, `trainMagnitude`, `trainSignedTotal`, `trainSignKind`, `formatSigned`, `formatAddend`).
- `ScenePolicy.allowNegativeRods` is set only by `ArrayRodPlayground.vue`. It is checked on `create` and in `validateSnapshot`, which also covers replace and level import.
- Positive parts are stored without a `sign` key, so positive scenes and files serialise exactly as before. Signed files use forward-only version 1 compatibility, the same as `materialRole`.
- Labels use the typographic minus (`−10`). Accessible names spell out the sign (“Negative 10 rod”, “Train, signed total -14, physical length 14, 2 parts”).
- `region-total` goals accept negative integers only where the adapter sets `signedRegionTotals` (Array).
- Tests: `app/components/rod/scene/negative-rods.test.ts`, `draggableRod.test.ts`, and `tests/e2e/negative-rods.spec.ts`.

## Intended behavior

A negative rod keeps the positive rod's color and physical magnitude but has a recessed, concave surface and an explicit negative label. A negative ten occupies ten cells horizontally, ten cells vertically, or one ground cell as a tower. Its mathematical contribution is -10.

Preserve semantic HTML, independent trains, keyboard interaction, selection, snapping, pan/zoom, and level authoring. Extend the existing scene and renderer; do not introduce a second board engine or separate negative-rod interaction system.

Initial rollout: Array Rod Playground. Other boards continue accepting positive material until they explicitly opt into signed arithmetic. The physical rendering and arithmetic helpers remain reusable across boards.

Related architecture: [Code structure and patterns](code-structure-and-patterns.md), [Frontend consistency implementation guide](frontend-consistency-implementation-guide.md), and [Coach playground](../coach-playground.md).

## Architectural assessment

The current separation between scene data, pure operations, interaction composables, and presentational components supports this feature. The remaining coupling is that `part.value` supplies both physical magnitude and mathematical contribution. Negative numbers must not become negative widths, offsets, loop lengths, or palette keys.

All source paths below are relative to `tsia-coach-web-nuxt/`.

| Existing owner | Extension |
| --- | --- |
| `app/components/rod/scene/rod.scene.types.ts` | Signed part data, creation intent, and an explicit scene capability. |
| `app/components/rod/scene/part-footprint.ts` | Continue measuring positive physical magnitude; sign has no geometric effect. |
| `app/components/rod/scene/linear-train-operations.ts` | Separate linear span from arithmetic total; preserve sign through supported operations. |
| `app/composables/useRodScene.ts` | Validate capabilities and dispatch signed operations atomically. |
| `app/components/rod/scene/train-view.ts` | Expose separate physical and signed readouts to presentation. |
| `app/components/rod/movement/DraggableRod.vue` | Forward part sign to the visual renderer and produce accessible object labels. |
| `app/components/rod/cuisenaire/CuisenaireRod.vue` | Own the concave visual treatment, using existing surface geometry and palette. |
| `app/components/rod/scene/scene-snapshot.ts` | Copy sign through capture, restore, cloning, and authoring. |
| `app/components/playground/files/level-document.schema.ts` | Parse and validate persisted sign. |
| `app/components/playground/goals/board-goal-adapters.ts` | Distinguish signed region totals from physical occupancy. |
| `app/composables/useBoardCamera.ts` and `app/components/grid/grid-coordinates.ts` | Continue handling view and coordinate conversion independently of arithmetic sign. |

The C# catalog of positive rod magnitudes need not become a catalog of twenty separate lengths. Check any transport or coach-capture schemas that carry scene data before sending signed scenes through them. Backend correctness remains server-owned; frontend arithmetic helpers do not replace server answer validation.

## 1. Establish the signed part contract

Recommended backward-compatible scene representation:

```ts
type RodSign = 1 | -1

type TrainPart = {
  value: CuisenaireRodValue // magnitude: integer 1 through 10
  sign?: RodSign           // absent means positive, for existing scenes/files
  offset: Point
  orientation: 'horizontal' | 'vertical' | 'tower'
}
```

Keep `value` as the magnitude during this migration. Renaming it to `magnitude` can be a separate change if needed. Sign belongs to each part, because a train may eventually contain both positive and negative material. Do not infer sign from color, concavity, material role, position, orientation, or a negative coordinate.

Add pure helpers, for example in `app/components/rod/scene/rod-arithmetic.ts`:

```ts
const partSign = (part: SignedPart): RodSign => part.sign ?? 1
const partSignedValue = (part: SignedPart): number => part.value * partSign(part)
const trainMagnitude = (train: SignedTrain): number =>
  train.parts.reduce((sum, part) => sum + part.value, 0)
const trainSignedTotal = (train: SignedTrain): number =>
  train.parts.reduce((sum, part) => sum + partSignedValue(part), 0)
```

`SignedPart` and `SignedTrain` above are illustrative structural types. Implement helpers against readonly/DeepReadonly-compatible inputs so they work with Vue scene state without casts or copies.

Use names that state the quantity being computed. Replace ambiguous `total` in linear layout with `span` or `magnitudeTotal`. A spatial cursor advances by magnitude. A mathematical readout uses signed value.

| Material | Linear span | Signed total |
| --- | --- | --- |
| +10, +4 | 14 | 14 |
| -10, -4 | 14 | -14 |
| +10, -4 | 14 | 6 |
| +10, -10 | 20 | 0 |

A zero-total train still contains physical material. It must not disappear, collapse its footprint, satisfy an empty-region goal, or be converted into zero parts automatically.

## 2. Add an explicit scene capability

Add an opt-in capability such as `allowNegativeRods?: boolean` to `ScenePolicy`. Enable it for the Array rollout only. Existing boards and old scenes retain their positive-only behavior.

Extend the create action with optional `sign`. The rod tray supplies creation intent; scene code validates it. Reject explicit signs other than 1 or -1, including 0, null, strings, and fractions. Missing sign remains positive.

Apply capability checks at both live action and snapshot/import boundaries. Hiding the negative toggle is not sufficient validation. Keep sign independent from `materialRole`, which already describes denominator/numerator layering.

## 3. Audit every use of rod value

Search before editing:

```powershell
rg -n "part\.value|sum \+|reduce\(|total|cursor" app/components/rod app/components/tabla app/components/playground app/composables
```

Classify each use explicitly:

- Geometry, palette, rod length, offsets, collision, train bounds, and cell occupancy use positive magnitude.
- Arithmetic totals and signed readouts use the signed helpers.
- Fraction and area activities retain their current mathematical meaning until that board opts in and has defined signed semantics.

Review `train-shape`, `train-orientation`, factor/area grouping helpers, goal occupancy, board constraints, and coach capture/readout paths as well as the files listed above. Do not mechanically replace every sum with a signed sum: physical area is not a signed total.

## 4. Preserve sign through scene transformations

Update each reconstruction path, not just creation:

- Snapshot copies and level capture/restore.
- Moving, cloning, and orientation changes.
- Make train and undo train.
- Regroup to ones, addends, and factors.
- View-model construction, scene replacement, and authoring step switching.

Moving and rotating never change sign. Cloning preserves it. Make train preserves every input part's sign; undo train preserves the sign of each released rod. Continue preserving existing metadata such as material role.

Keep operations pure and use the existing candidate-validation-commit boundary in `useRodScene`. Invalid operations must leave trains, selection, and ID allocation unchanged. New independent addend trains receive IDs only when the operation commits.

## 5. Define the first supported arithmetic rules

These are recommended rollout rules, not existing implemented behavior.

### Homogeneous trains

Support positive-only and negative-only trains first.

- Regroup -14 to ones: fourteen negative unit rods, maintaining the current operation's grouping convention.
- Regroup -24 to two independent addends: for example -12 and -12, each containing negative 10 and negative 2.
- Generate a finite set of same-sign addend splits. For -24, offer -1 + -23 through -23 + -1; format negative labels clearly, for example `(-12) + (-12)`.
- Build rod pieces from the absolute magnitude of each addend, then apply its sign. Never pass negative counts to `Array.from`, negative lengths to layout, or negative keys to the palette.
- A homogeneous negative train may use the existing physical factor shapes for its magnitude, with every resulting rod retaining negative sign. Describe an arrangement as “2 rows of negative 7,” whose total is -14. Do not imply that this visual alone models every signed-factor identity.

### Mixed-sign trains

Initially allow representation, movement, cloning, joining, and ungrouping. Disable mathematical regroup-to-ones/addends/factors for mixed-sign trains with a clear reason until cancellation semantics are implemented. Enforce the same restriction in `check`, `apply`, menu availability, and imported activity validation as appropriate.

In particular, do not replace +10 and -4 with a six-cell positive train merely because the net total is 6. That changes both occupied space and the represented material and should be an explicit mathematical operation.

Unrestricted signed addends produce infinitely many choices: 6 = 7 + (-1) = 8 + (-2), and so on. Do not reuse the current finite positive-pair generator without a bounded instructional rule.

### Cancellation is a later operation

Before implementing cancellation, decide the matching rule, whether larger rods decompose first, how the user chooses zero pairs, whether overlapping positive/negative material is permitted, and what visual evidence remains afterward. Keep the current no-overlap policy until a specific signed activity opts into another rule. Concavity does not grant permission to overlap.

## 6. Implement the concave presentation

Pass the resolved sign through the scene view and draggable wrapper to the existing Cuisenaire renderer. Keep color lookup based on magnitude. The renderer consumes sign for appearance; it does not own arithmetic, selection, or mutation.

Create a recessed interior with an outer rim and inward-facing edge shading. Keep a stable magnitude-sized hit surface and an explicit negative number label, such as `-10`. Do not create a negative CSS height or lower the entire clickable rod behind the grid. Use the current rod dimensions and shared CSS 3D conventions to position the recess.

Retain `data-rod-surface` as the surface measurement/input contract. Additional decorative faces must not intercept pointer events or create focus targets. Selection highlighting belongs on the visible rim/top surface and must remain visible against the concave interior. Preserve the existing keyboard-focus indicator.

Test magnitude 1 and 10, horizontal/vertical/tower orientations, both themes, adjacent rods, multi-part trains, and 25–200% board zoom. Flat and flat-unit presentations need an explicit design: for the Array-only rollout use the raised concave presentation, and keep signed material out of other activities until a flat negative appearance is defined.

## 7. Accessible controls and labels

Add an explicit positive/negative creation control using the current tray/toolbar patterns. Announce its state and make the chosen sign clear before creation. Continue using the same tray magnitudes and colors.

Examples of object labels:

- “Negative 10 rod at column 3, row 2.”
- “Train, signed total -14, physical length 14, 2 parts.”
- “Mixed-sign train, signed total 6, physical length 14, 2 parts.”

Do not label a zero-total train as an empty object. A whole train remains the interaction target; decorative rod faces do not become extra controls. Preserve selection announcements, accessible menus, arrow-key movement, and semantic HTML.

## 8. Persistence and compatibility

Add optional sign validation to the strict part schema. Old files with no sign remain positive. Preserve sign explicitly in `copyScene` and every serialization/capture path; verify later authoring steps as well as the active step.

New readers can retain version 1 if the project intentionally accepts forward-only compatibility: older strict readers reject files containing sign. Document that limitation. If older-reader compatibility or an explicit capability marker is required, introduce a versioned document migration before shipping. Do not silently discard sign or export signed rods as positive to satisfy an old reader.

A positive-only board must reject an imported signed scene with an actionable message. Rejected imports remain atomic. Resizing validation must continue checking physical bounds independently of sign and must preserve all authored snapshots and goals.

## 9. Goals and readouts

Current `region-total` goals accept nonnegative integers. For a signed Array activity, extend the schema and editor to accept integer targets, and let the board adapter validate which targets the activity supports. Positive-only activities can continue rejecting negative targets.

Signed Array region totals use `trainSignedTotal`/`partSignedValue`. Occupied area, filled rectangles, empty regions, and physical capacities continue using actual occupied cells. An occupied +10/-10 pair can satisfy total 0 while failing an empty-region goal.

Do not apply signed totals to denominator capacity, fraction comparisons, or fraction-multiplication reference geometry without a separate domain design. Keep their existing guards and positive-only capability until then.

## 10. Delivery sequence and acceptance gates

1. **Arithmetic foundation:** add the optional sign contract and shared helpers; distinguish physical span from signed total. Existing positive tests pass unchanged in meaning.
2. **Persistence and capability:** preserve sign through snapshots/actions/files and reject unsupported boards or malformed signs. Old files still load.
3. **Concave renderer and creation UI:** create, select, move, rotate, clone, and save a negative ten with the same physical footprint as positive ten.
4. **Homogeneous operations and readouts:** support negative-only regrouping, two independent addend trains, and signed Array totals. Mixed-sign mathematical regrouping returns a clear rejection.
5. **Goals and regression review:** signed goals work without changing occupancy, fraction behavior, or resize protection.
6. **Later milestone:** implement cancellation and mixed-sign arithmetic after their instructional rules are specified.

Each stage should leave the positive board usable. Avoid enabling the negative creation control before signed state can survive the full scene/file lifecycle.

## Verification matrix

| Layer | Required evidence |
| --- | --- |
| Pure arithmetic | Missing sign is positive; same magnitude yields identical geometry for either sign; mixed and zero totals are correct. |
| Scene operations | Sign survives movement/orientation/cloning/join/release; -24 becomes two independent -12 trains with local offsets and correct IDs. |
| Atomicity | Invalid sign, unsupported board, invalid requested pair, or blocked arrangement changes neither scene nor selection. |
| Persistence | Old positive files load; signed current and later steps round-trip; malformed sign is rejected without altering working state. |
| Renderer | Same palette and footprint; visible concavity and minus label; top selection ring remains visible; decorative faces do not affect input. |
| Interaction | Mouse, keyboard, touch, menus, zoom, pan, and marquee operate on the same semantic train objects. |
| Goals | +10/-10 yields total 0 but remains occupied; negative region targets work only where supported. |
| Board isolation | Bar/Fraction/MathTabla positive behavior and existing layering rules remain intact. |

Run the relevant existing suites and add targeted tests alongside their owners. Use the repository-installed Playwright runtime and user-writable `output/playwright/` for browser artifacts.

```powershell
pnpm test
pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json
# Lint touched source/test files with pnpm exec eslint.
pnpm exec playwright test --config playwright.playground.config.ts
```

When using an already-running frontend, set `PLAYGROUND_URL` to that origin. API catalog contract suites require their existing API URL configuration; new signed arithmetic tests should not depend on the catalog becoming signed.

## Decisions to confirm before later milestones

- The exact concave cap/rim appearance, particularly for towers and flat material.
- Which instructional activities accept mixed signs and what cancellation action means.
- Whether signed file exports retain forward-only version 1 compatibility or use a versioned migration.
- Which future boards opt into signed arithmetic, and how their goals/readouts interpret it.

These decisions do not prevent building the sign-aware foundation and backward-compatible persistence first.
