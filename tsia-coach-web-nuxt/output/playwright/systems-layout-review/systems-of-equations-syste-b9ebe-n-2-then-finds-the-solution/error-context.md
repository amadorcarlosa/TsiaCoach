# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: systems-of-equations.spec.ts >> systems of equations playground >> builds x=8, y=2, tests it against equation 2, then finds the solution
- Location: tests\e2e\systems-of-equations.spec.ts:78:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  getByRole('tabpanel', { name: 'Systems of Equations Playground', exact: true }).getByText('Both x groups are rectangles, but their lengths disagree (3 and 8).')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('tabpanel', { name: 'Systems of Equations Playground', exact: true }).getByText('Both x groups are rectangles, but their lengths disagree (3 and 8).')
    14 × locator resolved to <li data-v-0c8325b9="">Both x groups are rectangles, but their lengths d…</li>
       - unexpected value "hidden"

```

```yaml
- banner:
  - link "TSIA Coach home":
    - /url: /
    - text: TSIA Coach
  - navigation:
    - list:
      - listitem:
        - link "How it works":
          - /url: /#how
      - listitem:
        - link "Practice":
          - /url: /sample-Items
      - listitem:
        - link "What's on the test":
          - /url: /#areas
  - button "Toggle color mode"
  - link "Log in":
    - /url: "#"
  - button "Start free"
- main:
  - tablist:
    - tab "Bar Rod Playground"
    - tab "Array Rod Playground"
    - tab "Fraction Rod Playground"
    - tab "MathTabla Playground"
    - tab "Systems of Equations Playground" [selected]
    - tab "Base ten"
    - tab "Algebra tiles"
  - tabpanel "Systems of Equations Playground":
    - region "Equations":
      - list:
        - listitem:
          - strong: "Equation 1: 3x + 5y = 34"
        - listitem:
          - strong: "Equation 2: 4x + 2y = 22"
    - toolbar "Systems rod controls":
      - button "Hide rods" [expanded]
      - button "horizontal"
      - button "vertical" [disabled]
      - button "tower" [disabled]
      - button "Remove selected rod"
    - complementary "Rod choices":
      - button "Choose one rod"
      - button "Choose two rod"
      - button "Choose three rod"
      - button "Choose four rod"
      - button "Choose five rod"
      - button "Choose six rod"
      - button "Choose seven rod"
      - button "Choose eight rod"
      - button "Choose nine rod"
      - button "Choose ten rod"
    - group "Rod destination":
      - text: Add rods to
      - combobox "Rod destination":
        - 'option "Eq 1: x (3 rows)"'
        - 'option "Eq 1: y (5 rows)" [selected]'
        - 'option "Eq 2: x (4 rows)"'
        - 'option "Eq 2: y (2 rows)"'
        - option "Staging"
    - text: Problem
    - combobox "Problem":
      - option "3x + 5y = 34, 4x + 2y = 22" [selected]
      - option "2x + y = 32, x + 3y = 26"
    - group: Board options
    - group "Board view":
      - button "Zoom out": "-"
      - text: Zoom
      - combobox "Zoom":
        - option "25%"
        - option "50%"
        - option "75%"
        - option "100%" [selected]
        - option "125%"
        - option "150%"
        - option "175%"
        - option "200%"
      - button "Zoom in": +
      - button "Pan board"
      - button "Reset view"
      - text: Scroll to explore. Turn on Pan board to drag the view.
    - region "Board workspace. Use arrow keys to pan.":
      - button "10-rod at column 2, row 16. Use arrow keys to move."
      - button "4-rod at column 13, row 16. Use arrow keys to move."
      - button "5-rod at column 18, row 16. Use arrow keys to move."
      - button "3-rod at column 2, row 17. Use arrow keys to move."
      - button "8-rod at column 2, row 9. Use arrow keys to move."
      - button "8-rod at column 2, row 10. Use arrow keys to move."
      - button "8-rod at column 2, row 11. Use arrow keys to move."
      - button "8-rod at column 2, row 12. Use arrow keys to move."
      - button "2-rod at column 2, row 13. Use arrow keys to move."
      - button "2-rod at column 2, row 14. Use arrow keys to move."
      - button "3-rod at column 2, row 0. Selected. Use arrow keys to move."
      - button "3-rod at column 2, row 1. Selected. Use arrow keys to move."
      - button "3-rod at column 2, row 2. Selected. Use arrow keys to move."
      - button "5-rod at column 2, row 3. Selected. Use arrow keys to move."
      - button "5-rod at column 2, row 4. Selected. Use arrow keys to move."
      - button "5-rod at column 2, row 5. Selected. Use arrow keys to move."
      - button "5-rod at column 2, row 6. Selected. Use arrow keys to move."
      - button "5-rod at column 2, row 7. Selected. Use arrow keys to move."
    - status: "Redistribute this equation’s area: done."
    - region "Constraint feedback":
      - paragraph: "Equation 1: 34 of 34 cells. Both groups form rectangles."
      - paragraph: "Equation 2: 36 of 22 cells; 14 excess. Both groups form rectangles."
      - group: Shape and agreement feedback
      - status: 1 of 2 equations hold.
    - group "Authoring steps":
      - button "Capture step"
      - button "Update step" [disabled]
    - status
    - region "Level files":
      - text: Import level
      - button "Import level"
      - button "Export level"
      - status
    - status
    - paragraph: "18 objects on the board · Staging: 22 cells, not counted"
- contentinfo:
  - paragraph: TSIA Coach · Built on the MathTabla scaffold system
  - navigation "Footer navigation":
    - link "Accessibility":
      - /url: "#"
    - link "Privacy":
      - /url: "#"
    - link "Contact":
      - /url: "#"
- region "Notifications (F8)":
  - list
- img
- button "Toggle Nuxt DevTools":
  - img
- text: 151 ms
- button "Toggle Component Inspector":
  - img
```

# Test source

```ts
  16  | 
  17  | async function destination(panel: Locator, label: string) {
  18  |   await panel.getByRole('combobox', { name: 'Rod destination', exact: true }).selectOption({ label })
  19  | }
  20  | 
  21  | /** Adds a rod to the current destination and returns the new piece. */
  22  | async function add(panel: Locator, name: string) {
  23  |   const choice = panel.getByRole('button', { name: `Choose ${name} rod`, exact: true })
  24  |   if (!await choice.isVisible()) await panel.getByRole('button', { name: /show rods/i }).click()
  25  |   const pieces = panel.locator('[data-piece-id]')
  26  |   const ids = () => pieces.evaluateAll(elements => elements.map(el => (el as HTMLElement).dataset.pieceId!))
  27  |   const before = new Set(await ids())
  28  |   await choice.click()
  29  |   await expect(pieces).toHaveCount(before.size + 1)
  30  |   const id = (await ids()).find(value => !before.has(value))!
  31  |   return panel.locator(`[data-piece-id="${id}"]`)
  32  | }
  33  | 
  34  | /** Waits until the window and board stop scrolling; menus close on scroll. */
  35  | async function settleScroll(page: Page) {
  36  |   let last = ''
  37  |   await expect.poll(async () => {
  38  |     const now = await page.evaluate(() => JSON.stringify([window.scrollY,
  39  |       ...[...document.querySelectorAll('.systems-viewport')].map(el => [el.scrollTop, el.scrollLeft])]))
  40  |     const stable = now === last
  41  |     last = now
  42  |     return stable
  43  |   }, { intervals: [100] }).toBe(true)
  44  | }
  45  | 
  46  | async function menuOn(page: Page, rod: Locator) {
  47  |   const surface = rod.locator('[data-rod-surface]').first()
  48  |   await surface.scrollIntoViewIfNeeded()
  49  |   await settleScroll(page)
  50  |   await surface.click({ button: 'right' })
  51  |   const menu = page.getByRole('menu')
  52  |   await expect(menu).toBeVisible()
  53  |   return menu
  54  | }
  55  | 
  56  | async function command(page: Page, rod: Locator, label: string, confirm: string, screenshot?: string) {
  57  |   const menu = await menuOn(page, rod)
  58  |   await menu.getByRole('menuitem', { name: label }).click()
  59  |   const dialog = page.getByRole('dialog')
  60  |   await expect(dialog).toBeVisible()
  61  |   await expect(dialog.getByRole('button', { name: 'Keep rods' })).toBeFocused()
  62  |   if (screenshot) await page.screenshot({ path: `${shots}/${screenshot}.png` })
  63  |   await dialog.getByRole('button', { name: confirm, exact: true }).click()
  64  |   await expect(dialog).toBeHidden()
  65  | }
  66  | 
  67  | /** The first piece in a lane region, by its data-systems-region box. */
  68  | async function pieceIn(panel: Locator, regionId: string) {
  69  |   const region = (await panel.locator(`[data-systems-region="${regionId}"]`).boundingBox())!
  70  |   for (const piece of await panel.locator('[data-piece-id]').all()) {
  71  |     const box = (await piece.boundingBox())!
  72  |     if (box.y >= region.y - 2 && box.y < region.y + region.height - 2) return piece
  73  |   }
  74  |   throw new Error(`No piece in ${regionId}`)
  75  | }
  76  | 
  77  | test.describe('systems of equations playground', () => {
  78  |   test('builds x=8, y=2, tests it against equation 2, then finds the solution', async ({ playground, page }) => {
  79  |     void playground
  80  |     const panel = await openSystems(page)
  81  |     await expect(readout(panel).getByText('Equation 1: 3x + 5y = 34', { exact: true })).toBeVisible()
  82  |     await expect(status(panel)).toHaveText('0 of 2 equations hold.')
  83  |     await page.screenshot({ path: `${shots}/incomplete.png` })
  84  | 
  85  |     // Equation 1: three rows of 8 and five rows of 2, built with Repeat row.
  86  |     await destination(panel, 'Eq 1: x (3 rows)')
  87  |     const eight = await add(panel, 'eight')
  88  |     await command(page, eight, 'Repeat row into this group', 'Repeat row')
  89  |     await destination(panel, 'Eq 1: y (5 rows)')
  90  |     const two = await add(panel, 'two')
  91  |     await command(page, two, 'Repeat row into this group', 'Repeat row')
  92  |     await expect(panel.getByText('Equation 1: 34 of 34 cells. Both groups form rectangles.')).toBeVisible()
  93  | 
  94  |     // Test the candidate in equation 2: preview first, then build it.
  95  |     const row = await pieceIn(panel, 'equation-1:x')
  96  |     const menu = await menuOn(page, row)
  97  |     await menu.getByRole('menuitem', { name: 'Test candidate in other equation' }).click()
  98  |     const dialog = page.getByRole('dialog')
  99  |     await expect(dialog).toContainText('Equation 2 would have 36 of 22 cells: 14 excess.')
  100 |     await expect(panel.locator('[data-systems-ghost]')).toHaveCount(6)
  101 |     await page.screenshot({ path: `${shots}/context-menu-preview.png` })
  102 |     await dialog.getByRole('button', { name: 'Build candidate', exact: true }).click()
  103 |     await expect(panel.getByText('Equation 2: 36 of 22 cells; 14 excess. Both groups form rectangles.')).toBeVisible()
  104 |     await expect(status(panel)).toHaveText('1 of 2 equations hold.')
  105 |     await expect(panel.locator('[data-systems-ghost]')).toHaveCount(0)
  106 |     await page.screenshot({ path: `${shots}/rejected-candidate.png` })
  107 | 
  108 |     // Rearrange equation 1's 34 cells; nothing names the right split.
  109 |     const again = await menuOn(page, await pieceIn(panel, 'equation-1:x'))
  110 |     await again.getByRole('menuitem', { name: 'Redistribute this equation’s area' }).hover()
  111 |     await expect(page.getByRole('menuitem', { name: 'x = 8, y = 2' })).toBeVisible()
  112 |     await page.getByRole('menuitem', { name: 'x = 3, y = 5' }).click()
  113 |     await expect(page.getByRole('dialog')).toContainText('The equation keeps its area.')
  114 |     await page.getByRole('dialog').getByRole('button', { name: 'Redistribute', exact: true }).click()
  115 |     await expect(panel.getByText('Equation 1: 34 of 34 cells. Both groups form rectangles.')).toBeVisible()
> 116 |     await expect(panel.getByText('Both x groups are rectangles, but their lengths disagree (3 and 8).')).toBeVisible()
      |                                                                                                          ^ Error: expect(locator).toBeVisible() failed
  117 | 
  118 |     await command(page, await pieceIn(panel, 'equation-1:x'), 'Test candidate in other equation', 'Build candidate')
  119 |     await expect(status(panel)).toHaveText('Both equations hold with the same x and the same y.')
  120 |     await page.screenshot({ path: `${shots}/solved.png` })
  121 |   })
  122 | 
  123 |   test('long variable: a 10-and-4 train repeats into rows of 14', async ({ playground, page }) => {
  124 |     void playground
  125 |     const panel = await openSystems(page)
  126 |     await panel.getByRole('combobox', { name: 'Problem', exact: true }).selectOption('longVariable')
  127 |     await expect(readout(panel).getByText('Equation 1: 2x + y = 32', { exact: true })).toBeVisible()
  128 | 
  129 |     await destination(panel, 'Eq 1: x (2 rows)')
  130 |     const ten = await add(panel, 'ten')
  131 |     const four = await add(panel, 'four')
  132 |     await ten.locator('[data-rod-surface]').click()
  133 |     await four.locator('[data-rod-surface]').click({ modifiers: ['Shift'] })
  134 |     const join = await menuOn(page, four)
  135 |     await join.getByRole('menuitem', { name: 'Make a train', exact: true }).click()
  136 |     const train = await pieceIn(panel, 'equation-1:x')
  137 |     await expect(train).toHaveAttribute('aria-label', /^Train, value 14, 2 parts/)
  138 |     await command(page, train, 'Repeat row into this group', 'Repeat row', 'long-variable-preview')
  139 | 
  140 |     await destination(panel, 'Eq 1: y (1 row)')
  141 |     await add(panel, 'four')
  142 |     await expect(panel.getByText('Equation 1: 32 of 32 cells. Both groups form rectangles.')).toBeVisible()
  143 |     await command(page, await pieceIn(panel, 'equation-1:x'), 'Test candidate in other equation', 'Build candidate')
  144 |     await expect(status(panel)).toHaveText('Both equations hold with the same x and the same y.')
  145 |     // Every rod stays within the catalog even though x is 14.
  146 |     const values = await panel.locator('[data-part-value]').evaluateAll(parts => parts.map(part => Number((part as HTMLElement).dataset.partValue)))
  147 |     expect(Math.max(...values)).toBeLessThanOrEqual(10)
  148 |     await page.screenshot({ path: `${shots}/long-variable-solved.png` })
  149 |   })
  150 | 
  151 |   test('menus explain refusals; keyboard and background menus work', async ({ playground, page }) => {
  152 |     void playground
  153 |     const panel = await openSystems(page)
  154 |     await destination(panel, 'Eq 1: x (3 rows)')
  155 |     const four = await add(panel, 'four')
  156 | 
  157 |     await four.focus()
  158 |     await four.press('Shift+F10')
  159 |     const menu = page.getByRole('menu')
  160 |     const arrange = menu.getByRole('menuitem', { name: /Arrange as coefficient rows/ })
  161 |     await expect(arrange).toHaveAttribute('aria-disabled', 'true')
  162 |     await expect(arrange).toContainText('This group has 4 cells; 4 cannot form 3 equal whole-number rows.')
  163 |     await page.keyboard.press('Escape')
  164 | 
  165 |     // Joining across groups is refused.
  166 |     await destination(panel, 'Eq 1: y (5 rows)')
  167 |     const two = await add(panel, 'two')
  168 |     await four.locator('[data-rod-surface]').click({ modifiers: ['Shift'] })
  169 |     const join = await menuOn(page, two)
  170 |     await expect(join.getByRole('menuitem', { name: /^Make a train/ })).toContainText('Select rods from one group.')
  171 |     await page.keyboard.press('Escape')
  172 | 
  173 |     // Right-click on an empty lane: choose it as the destination.
  174 |     const laneElement = panel.locator('[data-systems-region="equation-2:y"]')
  175 |     await laneElement.scrollIntoViewIfNeeded()
  176 |     const lane = (await laneElement.boundingBox())!
  177 |     await settleScroll(page)
  178 |     await page.mouse.click(lane.x + lane.width - 20, lane.y + 10, { button: 'right' })
  179 |     await page.getByRole('menu').getByRole('menuitem', { name: /Add rods here/ }).click()
  180 |     await expect(panel.getByRole('combobox', { name: 'Rod destination', exact: true })).toHaveValue('equation-2:y')
  181 | 
  182 |     // Switching problems is refused while the board has work on it.
  183 |     await panel.getByRole('combobox', { name: 'Problem', exact: true }).selectOption('longVariable')
  184 |     await expect(panel.getByText('Clear the board and delete captured steps before switching problems.')).toBeVisible()
  185 |     await expect(readout(panel).getByText('Equation 1: 3x + 5y = 34', { exact: true })).toBeVisible()
  186 |   })
  187 | 
  188 |   for (const zoom of ['0.25', '0.5', '1', '2']) {
  189 |     test(`menu anchors to the rod at ${Number(zoom) * 100}% zoom on a scrolled board`, async ({ playground, page }) => {
  190 |       void playground
  191 |       const panel = await openSystems(page)
  192 |       await destination(panel, 'Eq 1: x (3 rows)')
  193 |       const rod = await add(panel, 'three')
  194 |       await panel.getByLabel('Zoom', { exact: true }).selectOption(zoom)
  195 |       const viewport = panel.locator('.systems-viewport')
  196 |       // Scroll whenever the board overflows; at small zoom it fits and cannot.
  197 |       const scrolled = await viewport.evaluate(element => {
  198 |         element.scrollLeft = 8
  199 |         element.scrollTop = 8
  200 |         return { overflows: element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth,
  201 |           offset: element.scrollLeft + element.scrollTop }
  202 |       })
  203 |       if (scrolled.overflows) expect(scrolled.offset).toBeGreaterThan(0)
  204 |       const menu = await menuOn(page, rod)
  205 |       const box = (await rod.locator('[data-rod-surface]').boundingBox())!
  206 |       const anchored = (await menu.boundingBox())!
  207 |       expect(Math.abs(anchored.x - box.x)).toBeLessThan(80)
  208 |       // Below the rod, or flipped above it near the bottom of the window.
  209 |       const below = anchored.y - (box.y + box.height)
  210 |       const above = box.y - (anchored.y + anchored.height)
  211 |       // A raised rod's lean lifts its cap a few pixels past its footprint.
  212 |       expect((below > -12 && below < 60) || (above > -12 && above < 60)).toBe(true)
  213 |       await page.keyboard.press('Escape')
  214 |     })
  215 |   }
  216 | })
```