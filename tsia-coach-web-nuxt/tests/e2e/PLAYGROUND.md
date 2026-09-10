# Playground regression tests

Run from `tsia-coach-web-nuxt`:

```powershell
pnpm exec vitest run app/components/rod/rod.placement.test.ts app/composables/useRodBoard.test.ts app/composables/useArrayRodBoard.test.ts
pnpm exec playwright test --config playwright.playground.config.ts
```

The Playwright config starts a Nuxt server at port 3117 and visits `/dev/playground`.
It does not need the rod-catalog API: these playgrounds use the local tray definitions.
To use an already-running development server instead:

```powershell
$env:PLAYGROUND_URL = 'http://localhost:54360'
pnpm exec playwright test --config playwright.playground.config.ts
Remove-Item Env:PLAYGROUND_URL
```

## Ownership and isolation

- `fixtures/playground-fixture.ts` owns tab selection, tray creation, stable rod locators, menu opening, grid-axis measurements, and pointer dragging.
- Every test uses a fresh Playwright page/context and navigates to an empty board. Tests never modify Vue state through browser evaluation.
- Browser evaluation reads rendered dimensions, positions, and temporary transforms. Rejected movement must preserve the committed coordinates **and** reset the temporary transform.
- The default context requests reduced motion for predictable drop destinations. The inertia group explicitly requests normal motion.
- Unit tests cover board bounds, overlap, edge contact, free-space creation, independent instances, orientation footprints, and state preservation on rejection.

## Browser coverage

1. Bar menu offers removal only; right-clicking a different rod targets that instance.
2. Array keyboard/pointer menus change vertical/tower orientation independently; both tabs retain their own rods.
3. Invalid array orientation and pointer drop preserve the accepted geometry; valid dragging also works.
4. Portrait closes a menu, disables editing, preserves rods, and restores keyboard menu access after returning to desktop.
5. Portrait hides rods beyond the preview without removing them from the board.
6. An out-of-bounds throw with inertia enabled returns to its accepted position; keyboard removal remains usable afterward.
7. Array selects each newly created rod; Bar leaves creation unselected and keeps the existing selection.
8. Scene contents and selection stay independent across tabs, including after a deletion in one tab.
9. Returning to a tab shows unchanged committed positions with no leftover preview transforms.
10. Switching tabs cancels movement: keyboard activation during a held group drag, keyboard activation during inertia, and pointer-down on a tab during inertia (before the pointer is released).

Failures produce screenshots and traces under `output/playwright/playground`.
These Chromium tests verify responsive viewport behavior, not physical-device touch/long-press behavior or tower clearance above the grid.
