# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: board-camera.spec.ts >> importing a level adopts its saved board size
- Location: tests\e2e\board-camera.spec.ts:179:1

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('tabpanel', { name: 'Array Rod Playground', exact: true }).getByRole('button', { name: 'Resize board', exact: true })
    - locator resolved to <button type="submit" data-v-b9c894f3=""> Resize board </button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <vite-error-overlay></vite-error-overlay> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <vite-error-overlay></vite-error-overlay> intercepts pointer events
    - retrying click action
      - waiting 100ms
    55 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <vite-error-overlay></vite-error-overlay> intercepts pointer events
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
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
          - tab "Array Rod Playground" [active] [selected] [ref=e38]
          - tab "Fraction Rod Playground" [ref=e40]
          - tab "MathTabla Playground" [ref=e42]
          - tab "Systems of Equations Playground" [ref=e44]
          - tab "Base ten" [ref=e46]
          - tab "Algebra tiles" [ref=e48]
        - tabpanel "Array Rod Playground" [ref=e50]:
          - generic [ref=e51]:
            - generic [ref=e52]:
              - toolbar "Array rod controls" [ref=e53]:
                - button "Hide rods" [expanded] [ref=e54] [cursor=pointer]
                - button "Negative rods" [ref=e55] [cursor=pointer]
                - button "horizontal" [disabled] [ref=e56]
                - button "vertical" [disabled] [ref=e57]
                - button "tower" [disabled] [ref=e58]
                - button "Remove selected rod" [disabled] [ref=e59]
              - generic [ref=e60]:
                - paragraph [ref=e61]: "New rods: positive"
                - complementary "Rod choices" [ref=e62]:
                  - button "Choose one rod" [ref=e63] [cursor=pointer]:
                    - generic: "1"
                  - button "Choose two rod" [ref=e64] [cursor=pointer]:
                    - generic: "2"
                  - button "Choose three rod" [ref=e65] [cursor=pointer]:
                    - generic: "3"
                  - button "Choose four rod" [ref=e66] [cursor=pointer]:
                    - generic: "4"
                  - button "Choose five rod" [ref=e67] [cursor=pointer]:
                    - generic: "5"
                  - button "Choose six rod" [ref=e68] [cursor=pointer]:
                    - generic: "6"
                  - button "Choose seven rod" [ref=e69] [cursor=pointer]:
                    - generic: "7"
                  - button "Choose eight rod" [ref=e70] [cursor=pointer]:
                    - generic: "8"
                  - button "Choose nine rod" [ref=e71] [cursor=pointer]:
                    - generic: "9"
                  - button "Choose ten rod" [ref=e72] [cursor=pointer]:
                    - generic: "10"
            - form "Board dimensions" [ref=e73]:
              - generic [ref=e74]:
                - text: Columns
                - spinbutton "Columns" [ref=e75]: "100"
              - generic [ref=e76]:
                - text: Rows
                - spinbutton "Rows" [ref=e77]: "100"
              - button "Resize board" [ref=e78]
              - generic [ref=e79]: 24 columns by 12 rows
            - group "Board view" [ref=e80]:
              - button "Zoom out" [ref=e81]: "-"
              - generic [ref=e82]:
                - text: Zoom
                - combobox "Zoom" [ref=e83]:
                  - option "25%"
                  - option "50%"
                  - option "75%"
                  - option "100%" [selected]
                  - option "125%"
                  - option "150%"
                  - option "175%"
                  - option "200%"
              - button "Zoom in" [ref=e84]: +
              - button "Pan board" [ref=e85]
              - button "Reset view" [ref=e86]
              - generic [ref=e87]: Scroll to explore. Turn on Pan board to drag the view.
            - region "Board workspace. Use arrow keys to pan." [ref=e88]:
              - generic "24 columns by 12 rows" [ref=e90]
            - status
            - group "Authoring steps" [ref=e92]:
              - button "Capture step" [ref=e93] [cursor=pointer]
              - button "Update step" [disabled] [ref=e94]
            - status
            - region "Level files" [ref=e95]:
              - generic [ref=e96]:
                - text: Import level
                - button "Import level" [ref=e97]
              - button "Export level" [ref=e98]
              - status
            - status
            - paragraph [ref=e99]: 0 objects on the board · Signed total 0
    - contentinfo [ref=e100]:
      - generic [ref=e101]:
        - paragraph [ref=e102]: TSIA Coach · Built on the MathTabla scaffold system
        - navigation "Footer navigation" [ref=e103]:
          - link "Accessibility" [ref=e104] [cursor=pointer]:
            - /url: "#"
          - link "Privacy" [ref=e105] [cursor=pointer]:
            - /url: "#"
          - link "Contact" [ref=e106] [cursor=pointer]:
            - /url: "#"
  - generic [ref=e107]:
    - button "Toggle Nuxt DevTools" [ref=e108] [cursor=pointer]
    - generic "Page load time" [ref=e112]:
      - generic [ref=e113]: "151"
      - generic [ref=e114]: ms
    - button "Toggle Component Inspector" [ref=e116] [cursor=pointer]
  - region "Notifications (F8)":
    - list
  - generic [ref=e123]:
    - generic [ref=e124]: "[plugin:@tailwindcss/vite:generate:serve] C:/Users/amado/code/TsiaCoach/tsia-coach-web-nuxt/app/components/rod/scene/ZeroPairPreview.vue?direct&vue&type=style&index=0&scoped=03bb451f&lang.css:2:10: Invalid declaration: `computed`"
    - generic [ref=e125]: C:/Users/amado/code/TsiaCoach/tsia-coach-web-nuxt/app/components/rod/scene/ZeroPairPreview.vue
    - generic [ref=e126]: at Te (file:///C:/Users/amado/code/TsiaCoach/tsia-coach-web-nuxt/node_modules/.pnpm/tailwindcss@4.3.3/node_modules/tailwindcss/dist/lib.mjs:3:5329) at zf (file:///C:/Users/amado/code/TsiaCoach/tsia-coach-web-nuxt/node_modules/.pnpm/tailwindcss@4.3.3/node_modules/tailwindcss/dist/lib.mjs:38:1384) at fu (file:///C:/Users/amado/code/TsiaCoach/tsia-coach-web-nuxt/node_modules/.pnpm/@tailwindcss+node@4.3.3/node_modules/@tailwindcss/node/dist/index.mjs:10:3464) at z.generate (file:///C:/Users/amado/code/TsiaCoach/tsia-coach-web-nuxt/node_modules/.pnpm/@tailwindcss+vite@4.3.3_vit_52afbf99da207526c70b0ca5122a3ec7/node_modules/@tailwindcss/vite/dist/index.mjs:1:6019) at TransformPluginContext.handler (file:///C:/Users/amado/code/TsiaCoach/tsia-coach-web-nuxt/node_modules/.pnpm/@tailwindcss+vite@4.3.3_vit_52afbf99da207526c70b0ca5122a3ec7/node_modules/@tailwindcss/vite/dist/index.mjs:1:3141) at file:///C:/Users/amado/code/TsiaCoach/tsia-coach-web-nuxt/node_modules/.pnpm/vite-plugin-inspect@11.4.1__d21502c789c047f0ddfefd56c922662b/node_modules/vite-plugin-inspect/dist/shared/vite-plugin-inspect.Fv_Ybe1U.mjs:403:26 at hook.handler (file:///C:/Users/amado/code/TsiaCoach/tsia-coach-web-nuxt/node_modules/.pnpm/vite-plugin-inspect@11.4.1__d21502c789c047f0ddfefd56c922662b/node_modules/vite-plugin-inspect/dist/shared/vite-plugin-inspect.Fv_Ybe1U.mjs:376:14) at EnvironmentPluginContainer.transform (file:///C:/Users/amado/code/TsiaCoach/tsia-coach-web-nuxt/node_modules/.pnpm/vite@8.2.2_@types+node@26.3_b73b73c59c8f212a9ec2fbff6e515246/node_modules/vite/dist/node/chunks/node.js:30932:51) at loadAndTransform (file:///C:/Users/amado/code/TsiaCoach/tsia-coach-web-nuxt/node_modules/.pnpm/vite@8.2.2_@types+node@26.3_b73b73c59c8f212a9ec2fbff6e515246/node_modules/vite/dist/node/chunks/node.js:20671:48) at async viteTransformMiddleware (file:///C:/Users/amado/code/TsiaCoach/tsia-coach-web-nuxt/node_modules/.pnpm/vite@8.2.2_@types+node@26.3_b73b73c59c8f212a9ec2fbff6e515246/node_modules/vite/dist/node/chunks/node.js:25205:20)
    - generic [ref=e127]:
      - text: Click outside, press Esc key, or fix the code to dismiss.You can also disable this overlay by setting
      - code [ref=e128]: server.hmr.overlay
      - text: to
      - code [ref=e129]: "false"
      - text: in
      - code [ref=e130]: vite.config.js
      - text: .
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | import { Touch } from './fixtures/playground-fixture'
  3   | 
  4   | const arrayName = 'Array Rod Playground'
  5   | const part = (value: number, x = 0) => ({ value, orientation: 'horizontal', offset: { x, y: 0 } })
  6   | const document = (trains: unknown[]) => ({ version: 1, board: { kind: 'array', config: { columns: 100, rows: 100 } }, steps: [{ id: 'step', title: 'Large board', prompt: '', goal: null, trains }] })
  7   | 
  8   | test.beforeEach(async ({ page }) => {
  9   |   await page.goto('/dev/playground')
  10  |   await expect(page.locator('[data-ready="true"]').first()).toBeVisible()
  11  |   await page.getByRole('tab', { name: arrayName, exact: true }).click()
  12  |   const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
> 13  |   await panel.getByRole('button', { name: 'Resize board', exact: true }).click()
      |                                                                          ^ Error: locator.click: Test timeout of 30000ms exceeded.
  14  |   await expect(panel.locator('[data-grid-world]')).toHaveAttribute('data-grid-columns', '100')
  15  | })
  16  | 
  17  | for (const zoom of ['0.25', '0.5', '1', '2']) {
  18  |   test(`large HTML board snaps and opens menus at zoom ${zoom}`, async ({ page }) => {
  19  |     const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
  20  |     await panel.locator('input[type=file]').setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document([
  21  |       { id: 'long', anchor: { x: 2, y: 6 }, parts: [part(10), part(10, 10), part(10, 20)] },
  22  |       { id: 'five', anchor: { x: 2, y: 2 }, parts: [part(5)] },
  23  |     ]))) })
  24  |     await panel.getByRole('group', { name: 'Replace level confirmation' }).getByRole('button', { name: 'Replace', exact: true }).click()
  25  |     await panel.getByLabel('Zoom', { exact: true }).selectOption(zoom)
  26  |     await panel.getByRole('region', { name: /Board workspace/ }).evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0 })
  27  |     await page.evaluate(() => window.scrollTo(0, 0))
  28  |     const rod = panel.locator('[data-piece-id="five"]')
  29  |     await expect(rod).toHaveAttribute('aria-label', /column 2, row 2/)
  30  |     const axes = await panel.locator('[data-grid-world]').evaluate(el => {
  31  |       const read = (name: string) => el.querySelector(`[data-grid-axis="${name}"]`)!.getBoundingClientRect()
  32  |       const o = read('origin'), x = read('x'), y = read('y')
  33  |       return { x: x.left - o.left, y: y.top - o.top }
  34  |     })
  35  |     const surface = rod.locator('[data-rod-surface]')
  36  |     const box = await surface.boundingBox()
  37  |     if (!box) throw new Error('Missing rod surface')
  38  |     await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  39  |     await page.mouse.down()
  40  |     await page.mouse.move(box.x + box.width / 2 + axes.x * 3.2, box.y + box.height / 2 + axes.y * 1.2, { steps: 12 })
  41  |     await page.mouse.up()
  42  |     await expect(rod).toHaveAttribute('aria-label', /column 5, row 3/)
  43  |     await surface.click({ button: 'right' })
  44  |     await page.getByRole('menuitem', { name: 'Regroup to addends', exact: true }).hover()
  45  |     await page.getByRole('menuitem', { name: '2 + 3', exact: true }).click()
  46  |     await expect(panel.locator('[data-piece-id]')).toHaveCount(3)
  47  |     await expect(panel.locator('[data-piece-id="long"] .train-part')).toHaveCount(3)
  48  |     await expect(panel.locator('[data-piece-id="long"]')).toHaveAttribute('aria-label', /value 30/)
  49  |   })
  50  | }
  51  | 
  52  | test('pan, reset and resized level export preserve mathematical coordinates', async ({ page }) => {
  53  |   const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
  54  |   await panel.getByRole('button', { name: 'Choose five rod', exact: true }).click()
  55  |   const rod = panel.locator('[data-piece-id]')
  56  |   const before = await rod.getAttribute('aria-label')
  57  |   const viewport = panel.getByRole('region', { name: /Board workspace/ })
  58  |   await panel.getByRole('button', { name: 'Pan board', exact: true }).click()
  59  |   const box = await viewport.boundingBox()
  60  |   if (!box) throw new Error('Missing viewport')
  61  |   await page.mouse.move(box.x + 350, box.y + 180)
  62  |   await page.mouse.down()
  63  |   await page.mouse.move(box.x + 150, box.y + 80, { steps: 8 })
  64  |   await page.mouse.up()
  65  |   await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBeGreaterThan(100)
  66  |   await expect(rod).toHaveAttribute('aria-label', before!)
  67  |   await viewport.focus()
  68  |   const scroll = await viewport.evaluate(el => el.scrollTop)
  69  |   await page.keyboard.press('ArrowDown')
  70  |   await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBeGreaterThan(scroll)
  71  |   await panel.getByRole('button', { name: 'Reset view', exact: true }).click()
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
  94  |   await panel.getByRole('form', { name: 'Board dimensions' }).getByLabel('Columns', { exact: true }).fill('24')
  95  |   await panel.getByRole('form', { name: 'Board dimensions' }).getByLabel('Rows', { exact: true }).fill('12')
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
```