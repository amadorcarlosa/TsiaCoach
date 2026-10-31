# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: board-camera.spec.ts >> shrinking also validates saved goals against the new capacity
- Location: tests\e2e\board-camera.spec.ts:166:1

# Error details

```
Error: locator.fill: Error: strict mode violation: getByRole('tabpanel', { name: 'Array Rod Playground', exact: true }).getByLabel('Columns', { exact: true }) resolved to 2 elements:
    1) <input min="1" max="500" value="100" required="" type="number" data-v-b9c894f3=""/> aka getByRole('form', { name: 'Board dimensions' }).getByLabel('Columns')
    2) <input min="1" step="1" type="number" data-v-5364a4c2=""/> aka getByRole('group', { name: 'Condition' }).getByLabel('Columns')

Call log:
  - waiting for getByRole('tabpanel', { name: 'Array Rod Playground', exact: true }).getByLabel('Columns', { exact: true })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e6]:
      - generic [ref=e7]:
        - link "TSIA Coach home" [ref=e9] [cursor=pointer]:
          - /url: /
          - generic [ref=e10]: TSIA
          - generic [ref=e11]: Coach
        - navigation [ref=e13]:
          - list [ref=e15]:
            - listitem [ref=e16]:
              - link "How it works" [ref=e17] [cursor=pointer]:
                - /url: /#how
            - listitem [ref=e19]:
              - link "Practice" [ref=e20] [cursor=pointer]:
                - /url: /sample-Items
            - listitem [ref=e22]:
              - link "What's on the test" [ref=e23] [cursor=pointer]:
                - /url: /#areas
        - generic [ref=e25]:
          - button "Toggle color mode" [ref=e26]
          - link "Log in" [ref=e28] [cursor=pointer]:
            - /url: "#"
          - button "Start free" [ref=e29]
    - main [ref=e31]:
      - generic [ref=e33]:
        - tablist [ref=e34]:
          - tab "Bar Rod Playground" [ref=e36]
          - tab "Array Rod Playground" [selected] [ref=e38]
          - tab "Fraction Rod Playground" [ref=e40]
          - tab "MathTabla Playground" [ref=e42]
          - tab "Base ten" [ref=e44]
          - tab "Algebra tiles" [ref=e46]
        - tabpanel "Array Rod Playground" [ref=e48]:
          - generic [ref=e49]:
            - generic [ref=e50]:
              - toolbar "Array rod controls" [ref=e51]:
                - button "Hide rods" [expanded] [ref=e52] [cursor=pointer]
                - button "horizontal" [disabled] [ref=e53]
                - button "vertical" [disabled] [ref=e54]
                - button "tower" [disabled] [ref=e55]
                - button "Remove selected rod" [disabled] [ref=e56]
              - complementary "Rod choices" [ref=e58]:
                - button "Choose one rod" [ref=e59] [cursor=pointer]:
                  - generic: "1"
                - button "Choose two rod" [ref=e60] [cursor=pointer]:
                  - generic: "2"
                - button "Choose three rod" [ref=e61] [cursor=pointer]:
                  - generic: "3"
                - button "Choose four rod" [ref=e62] [cursor=pointer]:
                  - generic: "4"
                - button "Choose five rod" [ref=e63] [cursor=pointer]:
                  - generic: "5"
                - button "Choose six rod" [ref=e64] [cursor=pointer]:
                  - generic: "6"
                - button "Choose seven rod" [ref=e65] [cursor=pointer]:
                  - generic: "7"
                - button "Choose eight rod" [ref=e66] [cursor=pointer]:
                  - generic: "8"
                - button "Choose nine rod" [ref=e67] [cursor=pointer]:
                  - generic: "9"
                - button "Choose ten rod" [ref=e68] [cursor=pointer]:
                  - generic: "10"
            - form "Board dimensions" [ref=e69]:
              - generic [ref=e70]:
                - text: Columns
                - spinbutton "Columns" [ref=e71]: "100"
              - generic [ref=e72]:
                - text: Rows
                - spinbutton "Rows" [ref=e73]: "100"
              - button "Resize board" [ref=e74]
              - generic [ref=e75]: 100 columns by 100 rows
            - status [ref=e76]: Board resized to 100 columns by 100 rows.
            - group "Board view" [ref=e77]:
              - button "Zoom out" [ref=e78]: "-"
              - generic [ref=e79]:
                - text: Zoom
                - combobox "Zoom" [ref=e80]:
                  - option "25%"
                  - option "50%"
                  - option "75%"
                  - option "100%" [selected]
                  - option "125%"
                  - option "150%"
                  - option "175%"
                  - option "200%"
              - button "Zoom in" [ref=e81]: +
              - button "Pan board" [ref=e82]
              - button "Reset view" [ref=e83]
              - generic [ref=e84]: Scroll to explore. Turn on Pan board to drag the view.
            - region "Board workspace. Use arrow keys to pan." [ref=e85]:
              - generic "100 columns by 100 rows" [ref=e87]
            - group "Authoring steps" [ref=e89]:
              - button "Capture step" [ref=e90] [cursor=pointer]
              - button "Update step" [disabled] [ref=e91]
              - button "Large board" [pressed] [ref=e92] [cursor=pointer]
            - group "Step details" [ref=e93]:
              - generic [ref=e95]:
                - generic [ref=e96]: Title
                - textbox "Title" [ref=e97]: Large board
              - generic [ref=e98]:
                - generic [ref=e99]: Prompt
                - textbox "Prompt" [ref=e100]
              - group "Goal" [ref=e101]:
                - group "Condition 1" [ref=e103]:
                  - generic [ref=e105]:
                    - text: Condition type
                    - combobox "Condition type" [ref=e106]:
                      - option "Empty region"
                      - option "Region total"
                      - option "Occupied area"
                      - option "Filled rectangle" [selected]
                  - generic [ref=e107]:
                    - text: Region
                    - combobox "Region" [ref=e108]:
                      - option "Array" [selected]
                  - generic [ref=e109]:
                    - text: X
                    - spinbutton "X" [ref=e110]: "80"
                  - generic [ref=e111]:
                    - text: "Y"
                    - spinbutton "Y" [ref=e112]: "80"
                  - generic [ref=e113]:
                    - text: Columns
                    - spinbutton "Columns" [ref=e114]: "10"
                  - generic [ref=e115]:
                    - text: Rows
                    - spinbutton "Rows" [ref=e116]: "10"
                  - button "Remove condition" [ref=e117]
                - button "Add condition" [ref=e118]
                - button "Apply goal" [ref=e119]
                - button "Clear goal" [ref=e120]
              - generic [ref=e121]:
                - button "Move earlier" [disabled] [ref=e122]
                - button "Move later" [disabled] [ref=e123]
                - button "Delete step" [ref=e124] [cursor=pointer]
            - status
            - region "Level files" [ref=e125]:
              - generic [ref=e126]:
                - text: Import level
                - button "Import level" [ref=e127]
              - button "Export level" [ref=e128]
              - status
            - status
            - paragraph [ref=e129]: 0 objects on the board
    - contentinfo [ref=e130]:
      - generic [ref=e131]:
        - paragraph [ref=e132]: TSIA Coach · Built on the MathTabla scaffold system
        - navigation "Footer navigation" [ref=e133]:
          - link "Accessibility" [ref=e134] [cursor=pointer]:
            - /url: "#"
          - link "Privacy" [ref=e135] [cursor=pointer]:
            - /url: "#"
          - link "Contact" [ref=e136] [cursor=pointer]:
            - /url: "#"
  - generic [ref=e137]:
    - button "Toggle Nuxt DevTools" [ref=e138] [cursor=pointer]
    - generic "Page load time" [ref=e142]:
      - generic [ref=e143]: "131"
      - generic [ref=e144]: ms
    - button "Toggle Component Inspector" [ref=e146] [cursor=pointer]
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  72  |   await expect.poll(() => viewport.evaluate(el => [el.scrollLeft, el.scrollTop])).toEqual([0, 0])
  73  |   await expect(panel.getByLabel('Zoom', { exact: true })).toHaveValue('1')
  74  |   await panel.getByRole('button', { name: 'Capture step', exact: true }).click()
  75  |   const pending = page.waitForEvent('download')
  76  |   await panel.getByRole('button', { name: 'Export level', exact: true }).click()
  77  |   const download = await pending
  78  |   const { readFile } = await import('node:fs/promises')
  79  |   const saved = JSON.parse(await readFile((await download.path())!, 'utf-8'))
  80  |   expect(saved.board.config).toEqual({ columns: 100, rows: 100 })
  81  |   expect(saved.steps[0].trains[0].anchor).toEqual({ x: 0, y: 0 })
  82  | })
  83  | 
  84  | test('shrinking checks saved steps even when the working board is empty', async ({ page }) => {
  85  |   const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
  86  |   await panel.locator('input[type=file]').setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document([
  87  |     { id: 'far', anchor: { x: 60, y: 60 }, parts: [part(10)] },
  88  |   ]))) })
  89  |   await panel.getByRole('group', { name: 'Replace level confirmation' }).getByRole('button', { name: 'Replace', exact: true }).click()
  90  |   const rod = panel.locator('[data-piece-id="far"]')
  91  |   await rod.scrollIntoViewIfNeeded()
  92  |   await rod.locator('[data-rod-surface]').click({ button: 'right' })
  93  |   await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  94  |   await panel.getByLabel('Columns', { exact: true }).fill('24')
  95  |   await panel.getByLabel('Rows', { exact: true }).fill('12')
  96  |   await panel.getByRole('button', { name: 'Resize board', exact: true }).click()
  97  |   await expect(panel).toContainText('Cannot resize:')
  98  |   await expect(panel.locator('[data-grid-world]')).toHaveAttribute('data-grid-columns', '100')
  99  | })
  100 | 
  101 | 
  102 | test('marquee selection uses board coordinates after zoom and pan', async ({ page }) => {
  103 |   const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
  104 |   await panel.locator('input[type=file]').setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document([
  105 |     { id: 'one', anchor: { x: 20, y: 15 }, parts: [part(5)] },
  106 |     { id: 'two', anchor: { x: 27, y: 15 }, parts: [part(3)] },
  107 |   ]))) })
  108 |   await panel.getByRole('group', { name: 'Replace level confirmation' }).getByRole('button', { name: 'Replace', exact: true }).click()
  109 |   await panel.getByLabel('Zoom', { exact: true }).selectOption('0.5')
  110 |   await page.evaluate(() => window.scrollTo(0, 0))
  111 |   await panel.getByRole('region', { name: /Board workspace/ }).evaluate(el => { el.scrollLeft = 180; el.scrollTop = 180 })
  112 |   const bounds = await panel.locator('[data-grid-world]').evaluate(el => {
  113 |     const read = (name: string) => el.querySelector(`[data-grid-axis="${name}"]`)!.getBoundingClientRect()
  114 |     const o = read('origin'), x = read('x'), y = read('y')
  115 |     return { x: o.left, y: o.top, dx: x.left - o.left, dy: y.top - o.top }
  116 |   })
  117 |   await page.mouse.move(bounds.x + bounds.dx * 19, bounds.y + bounds.dy * 14)
  118 |   await page.mouse.down()
  119 |   await page.mouse.move(bounds.x + bounds.dx * 31, bounds.y + bounds.dy * 17, { steps: 12 })
  120 |   await page.mouse.up()
  121 |   await expect(panel.locator('.draggable-rod--selected')).toHaveCount(2)
  122 |   const rod = panel.locator('[data-piece-id="one"]')
  123 |   await rod.focus()
  124 |   await page.keyboard.press('ArrowRight')
  125 |   await expect(rod).toHaveAttribute('aria-label', /column 21, row 15/)
  126 |   await expect(panel.locator('[data-piece-id="two"]')).toHaveAttribute('aria-label', /column 28, row 15/)
  127 | })
  128 | 
  129 | 
  130 | test.describe('touch board navigation', () => {
  131 |   test.use({ contextOptions: { hasTouch: true, reducedMotion: 'reduce' } })
  132 |   test('pan mode captures touch without creating a selection', async ({ page }) => {
  133 |     const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
  134 |     const viewport = panel.getByRole('region', { name: /Board workspace/ })
  135 |     await panel.getByRole('button', { name: 'Pan board', exact: true }).tap()
  136 |     await page.evaluate(() => window.scrollTo(0, 0))
  137 |     const box = await viewport.boundingBox()
  138 |     if (!box) throw new Error('Missing viewport')
  139 |     const touch = new Touch(page)
  140 |     await touch.down(1, { x: box.x + 300, y: box.y + 150 })
  141 |     await touch.move(1, { x: box.x + 100, y: box.y + 75 })
  142 |     await touch.up(1)
  143 |     await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBeGreaterThan(100)
  144 |     await expect(panel.locator('[data-piece-id]')).toHaveCount(0)
  145 |     await panel.getByRole('button', { name: 'Reset view', exact: true }).tap()
  146 |     await expect.poll(() => viewport.evaluate(el => [el.scrollLeft, el.scrollTop])).toEqual([0, 0])
  147 |   })
  148 | })
  149 | 
  150 | 
  151 | test('zooming cancels an unfinished drag without moving the rod', async ({ page }) => {
  152 |   const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
  153 |   await panel.getByRole('button', { name: 'Choose five rod', exact: true }).click()
  154 |   const rod = panel.locator('[data-piece-id]')
  155 |   const box = await rod.locator('[data-rod-surface]').boundingBox()
  156 |   if (!box) throw new Error('Missing rod')
  157 |   await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  158 |   await page.mouse.down()
  159 |   await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 60, { steps: 8 })
  160 |   await panel.getByLabel('Zoom', { exact: true }).selectOption('0.5')
  161 |   await page.mouse.up()
  162 |   await expect(rod).toHaveAttribute('aria-label', /column 0, row 0/)
  163 |   await expect.poll(() => rod.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)).toBe(0)
  164 | })
  165 | 
  166 | test('shrinking also validates saved goals against the new capacity', async ({ page }) => {
  167 |   const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
  168 |   const level = document([])
  169 |   Object.assign(level.steps[0]!, { goal: { type: 'all', conditions: [{ type: 'filled-rectangle', regionId: 'array', x: 80, y: 80, columns: 10, rows: 10 }] } })
  170 |   await panel.locator('input[type=file]').setInputFiles({ name: 'goal.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(level)) })
  171 |   await panel.getByRole('group', { name: 'Replace level confirmation' }).getByRole('button', { name: 'Replace', exact: true }).click()
> 172 |   await panel.getByLabel('Columns', { exact: true }).fill('24')
      |                                                      ^ Error: locator.fill: Error: strict mode violation: getByRole('tabpanel', { name: 'Array Rod Playground', exact: true }).getByLabel('Columns', { exact: true }) resolved to 2 elements:
  173 |   await panel.getByLabel('Rows', { exact: true }).fill('12')
  174 |   await panel.getByRole('button', { name: 'Resize board', exact: true }).click()
  175 |   await expect(panel).toContainText('Cannot resize:')
  176 |   await expect(panel.locator('[data-grid-world]')).toHaveAttribute('data-grid-columns', '100')
  177 | })
  178 | 
```