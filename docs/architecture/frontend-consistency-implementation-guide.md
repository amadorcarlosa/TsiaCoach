# Frontend Consistency Implementation Guide

## Objective and order

Complete the fraction-multiplication layering feature consistently across rendering, creation, validated placement, coverage, interactions, and saved scenes. Preserve every other activity's existing behavior.

1. Stabilize the current type declarations and establish a passing baseline.
2. Connect one mode boundary and explicit mathematical roles through the existing helpers.
3. Correct unit-cell geometry.
4. Verify both editing layers and persistence in a real browser.

This guide follows the October 21 consistency addendum in frontend-pattern-audit.md. It specifies implementation work; it does not claim that the fixes have been applied.

## Baseline before editing

Record HEAD, git status, and the relevant working-tree diff. Existing work already adds MaterialRole, layered placement helpers, role copying, and optional role-based readouts. Reuse it rather than implementing a second system.

Inspect rod.scene.types.ts. The validation run found a parse error where a newline separated as const from satisfies. Keep the declaration as a single valid expression, for example:

    export const materialRoles = ['denominator', 'numerator'] as const satisfies readonly MaterialRole[]

Rerun the focused tests and typecheck before attributing new failures to integration work. If a concurrent edit has already corrected this, do not reapply it.

## A. One explicit activity mode

In MathTablaPlayground.vue, obtain the activity mode from its owning page or activity configuration. Add an explicit typed input if none exists. Do not introduce a mode toggle and an unrelated policy flag that can disagree.

Derive one predicate for fraction multiplication. Use it for:

- Availability of denominator-tile/numerator-rod creation choices.
- Scene layeredRoles.enabled().
- Role-based flat/raised presentation and rendering order.
- Readouts' layered option and the selected-coverage field displayed.
- Editing-layer selection and hit testing.
- Mode-aware restoration/import validation.

When the predicate is false, retain existing rendering, controls, collision checks, and coverage semantics. Persisted roles do not enable overlap by themselves. Keep an explicit compatibility branch for ordinary MathTabla; do not indiscriminately change every central object to raised or flat.

Test missing/unknown mode handling: use the ordinary policy, never permissive layering.

## B. Roles must mean the same thing at every boundary

Use the existing materialRole model for central objects. Reference roles derive from the D/N tracks. Color and current central coordinates do not distinguish numerator from denominator.

In fraction multiplication:

| Object | Appearance | Selected coverage |
| --- | --- | --- |
| Central denominator material | Flat unit-divided groups | Excluded |
| Central numerator material | Raised rods | Unique occupied cells inside the whole |
| D references | Flat strips | Excluded |
| N references | Raised references | Excluded |

Creation must pass explicit intent into scene.apply. Moving a central object preserves its role. A deliberate role conversion uses a validated action, not a CSS map update.

Inspect each operation: clone, regroup to factors, regroup area, regroup ones/addends, ungroup, and make-train. Preserve role when deriving pieces; reject grouping different roles together. Copy role through train views and snapshots as needed. Do not add presentation fields to mathematical scene data.

Existing unlabelled central objects keep a documented legacy meaning. Current helpers default them to numerator in layered mode; keep that consistent across placement, rendering, and counting or implement one shared resolver. Do not silently reclassify old selections as denominator tiles.

## C. Connect the existing validated layering policy

Supply layeredRoles to useRodScene only through the explicit mode condition. Use the candidate scene's D references to derive the whole, so reference edits are checked against existing numerator pieces.

Allow cross-role overlap only between distinct numerator/denominator objects in the designated central region. Reject same-role overlap, internal train-part overlap, reference collisions, and ordinary-mode overlap. Retain board and region checks.

Use the same validator for check(), apply(), move previews, creation/spawn search, rotation, clone, role conversion, regroup, and import. A z-index change alone is insufficient.

Apply the activity's documented whole-containment rule consistently. Reject denominator reference changes that strand existing numerator pieces outside the whole rather than silently moving or deleting them.

## D. Correct the displayed coverage

mathtabla.readouts.ts already provides occupiedCells, numeratorCells, and denominatorCells with an optional layered flag. Wire that flag to the mode predicate.

In fraction multiplication, display numeratorCells for selected coverage; denominatorCells is optional tiling progress. Whole value remains the D-defined area. A fully tiled 24-cell denominator with no numerator must report 0 of 24 selected cells.

Outside that mode, keep the previous occupiedCells readout. Do not globally substitute numeratorCells, which is zero when layered counting is disabled.

## E. Exact unit-grid alignment

In CuisenaireRod.vue, remove the layout-consuming 2px border from the flat-units surface. Preserve the 2px visual perimeter using an inset shadow or absolutely positioned pointer-transparent overlay. Ensure the inherited 1px shared border is also overridden for this variant.

The units container must occupy the full W×H board footprint. Keep each unit boundary separated from the group perimeter; decorative cells remain noninteractive.

At cell size 36:

- Horizontal four: outer footprint 144×36, grid 144×36, each cell 36×36.
- Vertical four: outer footprint 36×144, grid 36×144, each cell 36×36.

Do not assert raw screen-space bounding boxes are square after the board's perspective/tilt transform. Measure untransformed layout dimensions and separately compare transformed boundary positions against board-axis markers with a small subpixel tolerance. Do not allow a 4px layout shrinkage as “close enough.”

## F. Consistent layered interaction

Preserve data-rod-surface as the shared pointer target. Do not require .face.top on flat objects. Keep focus and accessible naming on the interactive train wrapper; unit cells remain decorative.

Add an explicit editing role/layer control inside fraction multiplication mode. In numerator editing, underlying denominator pieces should not steal input. In denominator editing, provide access beneath numerator rods without deleting or moving those rods. Apply the choice to pointer eligibility, marquee selection, keyboard traversal, and context menus together.

Cancel any held drag before changing activity or editing layer. Preserve rejected-action state and selection. Render a visible keyboard focus indicator on both presentations.

Render denominator below numerator by ordering render views, without changing mathematical snapshot ordering or IDs.

## G. Mode-aware saved scenes

Persist activity context at the level/activity boundary if not already supplied there. Restore that context before validating its scene. Role metadata alone must never authorize overlap in an ordinary activity.

Inspect strict schemas, snapshot copying, authoring capture/restore, export/import, and goal adapters. Adopt an explicit schema compatibility strategy before adding fields; old strict readers may reject new documents.

Keep separate scenes per activity mode or validate a target scene before switching. Do not leak a layered scene into ordinary mode and bypass collision checks. Do not silently delete material to make a mode switch pass.

## Validation matrix

| Scenario | Required result |
| --- | --- |
| Ordinary mode, role-bearing objects overlap | Rejected under ordinary rules |
| Fraction multiplication, denominator/numerator share cells | Accepted |
| Fraction multiplication, two numerators share cells | Rejected |
| Overlapping parts of one train | Rejected |
| Entire denominator tiled, no numerator | Selected count 0 |
| Three numerator fours above 4×6 whole | Selected count 12 of 24 |
| Clone/regroup/ungroup and restoration | Role, geometry, identity rules preserved |
| Group two different roles | Rejected without mutation |
| Horizontal/vertical flat four | Four exact board-sized cells |
| Switch editing layer | Underlying role is selectable and keyboard reachable |
| Switch activity/import invalid layered scene | No policy bypass or silent deletion |
| Other playgrounds and modes | Existing behavior unchanged |

Run focused renderer, scene, role, readout, and file tests; then the default Vitest suite and typecheck. Run targeted Playwright flows using repo-installed Playwright and the playground configuration against a stable running server. Contract tests require their own configured API; do not present skipped contract/build checks as passes.

Visually inspect light/dark themes and desktop/mobile landscape. Record exactly which commands passed and which snapshot they tested. Do not combine an earlier passing full suite with a later changed tree as a single verified result.

## Delivery criterion

The feature is consistent when one authorized activity mode supplies the same role interpretation to every subsystem, the user can place and edit either visual layer, unit boundaries match the board, and ordinary activities remain unaffected.
