# Frontend Pattern Audit

Date: October 21, 2026.

The current uncommitted frontend changes largely follow the architecture described in [TsiaCoach Code Structure and Patterns](C:/Users/amado/code/TsiaCoach/docs/architecture/code-structure-and-patterns.md). Board-specific presentation is derived from live scene geometry, reusable components render it, and scene state remains separate from appearance. No architectural blocker was identified within the original presentation-only scope. The consistency review below identifies a mode-boundary defect, incomplete integration of mathematical roles, and visual alignment and interaction-verification gaps. These qualify approval of the current feature.

## Scope

This audit covers the working tree changes present during review, rather than a historical comparison between releases. The main change adds a `flat-units` rod presentation for material in the MathTabla central array, while denominator references remain flat and numerator references remain raised.

| Reviewed file | Change |
| --- | --- |
| `app/components/playground/MathTablaPlayground.vue` | Derives a presentation map from train containment in board regions. |
| `app/components/rod/rod.types.ts` | Adds `flat-units` to the presentation alternatives. |
| `app/components/rod/scene/SceneRodLayer.vue` | Passes per-piece presentation to the rod renderer with a raised default. |
| `app/components/rod/cuisenaire/CuisenaireRod.vue` | Draws decorative unit cells on a flat footprint. |
| `app/components/rod/movement/DraggableRod.vue` | Describes divided groups in the existing accessible name. |
| `app/components/rod/cuisenaire/cuisenaireRod.test.ts` | Adds rendering and unit-division checks. |
| `app/components/rod/movement/draggableRod.test.ts` | Adds component checks for presentation, identity, and accessible labels. |
| `tests/e2e/fixtures/playground-fixture.ts` | Uses the first part surface when dragging a train. |
| `tests/e2e/mathtabla.spec.ts` | Expands coverage for presentation, regrouping, restoration, and viewport changes. |

Paths in this table are relative to `tsia-coach-web-nuxt`. The index also contains an empty `server/api/base10block.get.ts` addition that is deleted in the working tree. Its current net change against HEAD adds no endpoint behavior.

## Assessment against the documented patterns

| Pattern | Assessment | Evidence and implication |
| --- | --- | --- |
| Scene state has a clear owner | Follows the pattern | Presentation reads `scene.trains` without adding presentation fields to scene state or snapshots. |
| Playground components compose board policy | Follows the pattern | MathTabla chooses appearance using its own board regions and the existing `trainFitsRegion` helper. |
| Reusable renderers receive explicit inputs | Follows the pattern | `SceneRodLayer` accepts a typed presentation map; `CuisenaireRod` renders the selected alternative without knowing MathTabla region names. |
| Geometry and rendering remain separate | Follows the pattern with a visual defect | Unit counts derive from dimensions. The border currently reduces the rendered cell area, as described below. |
| Interaction remains separate from decoration | Follows the pattern | Unit cells are decorative and do not introduce independent drag targets or selection state. Existing interaction composables remain in use. |
| Defaults preserve other consumers | Follows the pattern | Pieces omitted from the presentation map default to `raised`. |
| Accessible descriptions belong to the interactive wrapper | Follows the pattern | `DraggableRod` describes the group total; visual part wrappers and decorative cells are hidden from assistive technology. Browser accessibility behavior was not independently exercised. |
| Server owns learner correctness | No boundary change in this diff | The reviewed changes concern playground presentation and tests; they introduce no answer checking or scaffold progress logic. |

Keeping the small presentation computation in `MathTablaPlayground.vue` is consistent with its composition role. The current scope does not require extracting a new composable or moving board-specific region decisions into the generic rod renderer.

## Open finding

### P3 Unit cells do not exactly match the board lattice

Location: [CuisenaireRod.vue](C:/Users/amado/code/TsiaCoach/tsia-coach-web-nuxt/app/components/rod/cuisenaire/CuisenaireRod.vue:126).

The shared strip styles use `box-sizing: border-box`. The new unit-divided strip adds a 2px border, while its absolutely positioned `.units` child uses `inset: 0`. Consequently, the unit grid fills the area inside that border, which is 4px smaller than the rod footprint along each axis.

For a horizontal four at 36px per board cell, the outer footprint is 144 by 36px. Its internal unit grid is 140 by 32px, producing four cells of 35 by 32px. The cells are therefore rectangular and their divisions do not all coincide with the board lattice. This calculation follows the CSS sizing rules; a browser measurement was not performed during the audit.

The issue affects visual precision rather than scene coordinates, rod value, or server evaluation. It is a low-priority finding, not an architectural blocker.

Recommended correction: preserve the full footprint for the unit grid and draw the perimeter with an inset shadow or separate overlay. Then verify cell dimensions and internal division positions against the board spacing in both horizontal and vertical orientations. Existing browser assertions allow a small size difference and do not establish exact lattice alignment.

Status: open. No implementation fix was made as part of this audit.

## Verification

The following commands ran from `C:/Users/amado/code/TsiaCoach/tsia-coach-web-nuxt` during the audit:

```powershell
pnpm exec vitest run app/components/rod/cuisenaire/cuisenaireRod.test.ts app/components/rod/movement/draggableRod.test.ts app/components/tabla/mathtabla.geometry.test.ts app/components/tabla/mathtabla.readouts.test.ts app/composables/useRodScene.test.ts
pnpm test
```

| Check | Result |
| --- | --- |
| Focused rendering, geometry, readout, and scene tests | 85 tests passed across 5 files. |
| Full default Vitest suite | 512 tests passed across 44 files. |
| Playwright browser tests | Reviewed as source; not run. |
| Separate contract integration suite | Not run. |
| Build, lint, and type checking | Not run. |

The focused tests are included in the full suite; these counts are not additive. The passing results establish the tested component and logic behavior, but do not establish browser layout accuracy, dark-theme contrast, or complete pointer and touch behavior.

## Follow up

Correct the border-induced unit-grid shrinkage and verify alignment in the browser. Retain the current separation between board-specific presentation choices, shared rendering, scene state, and interaction logic.

## Consistency review addendum — October 21, 2026

### Scope and evidence

The original assessment above is retained as a record of its presentation-only review. It is not approval of the later fraction-multiplication layering work. The working tree changed during validation: materialRole, role-aware placement, snapshot copying, and readout support now exist, while the inspected playground still uses location-only presentation and does not supply the layered policy. Re-read current files before applying fixes; do not duplicate partially implemented work.

The documented architecture is structurally consistent: playground composition owns board policy, scene code owns validated state, and reusable renderers receive explicit presentation inputs. Behavioral consistency requires additional checks across these boundaries.

### P2 Mode restriction is not enforced by the presentation owner

Location: app/components/playground/MathTablaPlayground.vue, piecePresentations and scene policy construction.

The presentation map assigns flat-units to every train contained in the central array, with no explicit fraction-multiplication condition. The inspected scene construction does not connect the new layeredRoles policy. This does not satisfy the requested restriction that flat denominator/raised numerator overlap operates only in fraction multiplication mode.

Required correction: one explicit activity-mode predicate must govern presentation, controls, placement previews, committed operations, readouts, and restoration. Other modes retain their established behavior. Board identity, color, and saved role metadata must not activate the feature.

Status: open in the inspected composition code. Lower-level helpers are partially implemented; this is not evidence that all mode behavior is absent.

### P2 Mathematical roles are not consistently integrated end to end

Locations: MathTablaPlayground.vue; rod.scene.types.ts; rod-scene.placement.ts; scene-snapshot.ts; mathtabla.readouts.ts.

The role model and role-aware helper work exist, including materialRole copying and optional layered readouts. However, the inspected playground still renders all central material flat based on location and calls ordinary readouts/policy. A numerator above a denominator requires role-aware rendering and validated overlap, plus numerator-only selected coverage. Separate correct helpers do not establish that the user flow uses them.

Required correction: connect creation intent, role propagation, policy, rendering, counting, and saved activity context. Verify that a tiled denominator alone reports zero numerator coverage, and that a raised numerator can overlap it only in the authorized mode. Persist roles and reject mixed-role grouping.

Status: integration incomplete at the inspected composition boundary; inspect current action/schema changes before concluding which individual paths remain missing.

### P3 Board-cell alignment confirmed

The earlier border finding is confirmed with an isolated Chromium layout using matching CSS: a 144×36px border-box surface with a 2px border yields a 140×32px inner grid and 35×32px cells for four columns. This is a browser measurement of matching isolated CSS, not a successful live-app measurement.

Required correction: preserve full-size unit-grid layout; draw its perimeter without consuming that layout space. Test both orientations and actual board transforms.

Status: open; the inspected CuisenaireRod.vue still uses the shrinking border.

### Interaction consistency: verification gap

Flat and raised pieces share data-rod-surface, existing interaction composables, and wrapper-level accessible descriptions. That is consistent structurally. It does not establish that two overlapped roles can be independently selected, dragged, reached by keyboard, or opened through a context menu. A numerator may intercept input intended for the denominator below it.

Required correction: define an explicit editing-layer policy and apply it consistently to pointer targets, keyboard navigation, marquee selection, previews, and menus. Verify the user can edit either role without deleting the other. Do not add independent drag state to decorative cells.

Status: unverified for layered scenes, not a demonstrated interaction failure.

### Validation update and limitations

- Full default Vitest run reproduced 512 passing tests across 44 files.
- A subsequent focused run passed 32 tests in four files, but useRodScene.test.ts could not load because rod.scene.types.ts:19 produced a parse error at the newline before satisfies. This contradicts treating the earlier 85-test result as a guarantee for the later working tree.
- The earlier original focused result remains historical evidence, not a newly reproduced pass.
- Live browser inspection timed out waiting for the playground readiness marker. No live layered-interaction or accessibility pass is claimed.
- Isolated CSS measurement confirmed the alignment defect.
- Contract integration, build, lint, and type checking were not rerun during validation.

Record commit identity plus a diff fingerprint, or otherwise freeze the reviewed snapshot, before making release-wide claims. Treat any concurrent changes as a new validation target.

### Follow-up guide

See Frontend Consistency Implementation Guide in docs/architecture/frontend-consistency-implementation-guide.md. Fix the mode and role integration first, then grid precision and interaction coverage. Keep server correctness and scaffold progression outside this presentation/interaction change.
