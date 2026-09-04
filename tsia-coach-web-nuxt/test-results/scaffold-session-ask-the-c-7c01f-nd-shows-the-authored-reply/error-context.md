# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scaffold-session.spec.ts >> ask the coach sends only the step id and the question, and shows the authored reply
- Location: tests\e2e\scaffold-session.spec.ts:165:1

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: locator.fill: Test timeout of 90000ms exceeded.
Call log:
  - waiting for getByLabel('Your question for the coach')

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
      - generic [ref=e32]:
        - complementary [ref=e33]:
          - generic [ref=e34]:
            - generic [ref=e35]: Q
            - generic [ref=e36]:
              - paragraph [ref=e37]: Original question
              - text: Keep the words beside the model.
          - paragraph [ref=e38]: If n is the least of two consecutive odd integers, which of the following represents the sum of the two integers?
          - generic [ref=e41]:
            - text: "Words in focus:"
            - strong [ref=e42]: two consecutive odd integers
        - main [ref=e43]:
          - generic "Walkthrough progress" [ref=e44]:
            - generic [ref=e45]: Step 1 of 8
            - button "Ask the coach" [active] [ref=e47]
          - 'heading "Build every rod out of twos and ones. Drag red twos and white ones on top of each rod, from 1 to 10, until it is covered exactly. Rule: put down as many twos as will fit. Only use a white one when a two won''t fit." [level=2] [ref=e51]'
          - region "Rod grid, 0 pieces placed" [ref=e52]:
            - generic "Piece supply" [ref=e53]:
              - generic [ref=e54]: Drag onto a rod
              - button "red rod, length 2" [ref=e55]:
                - generic [ref=e56]: "2"
              - button "white rod, length 1" [ref=e57]:
                - generic [ref=e58]: "1"
            - generic [ref=e60]:
              - generic [ref=e61]: "1"
              - generic [ref=e63]: "2"
              - generic [ref=e65]: "3"
              - generic [ref=e67]: "4"
              - generic [ref=e69]: "5"
              - generic [ref=e71]: "6"
              - generic [ref=e73]: "7"
              - generic [ref=e75]: "8"
              - generic [ref=e77]: "9"
              - generic [ref=e79]: "10"
            - paragraph [ref=e81]: Every drop is checked. A piece that breaks the rule comes back.
    - contentinfo [ref=e82]:
      - generic [ref=e83]:
        - paragraph [ref=e84]: TSIA Coach · Built on the MathTabla scaffold system
        - navigation "Footer navigation" [ref=e85]:
          - link "Accessibility" [ref=e86] [cursor=pointer]:
            - /url: "#"
          - link "Privacy" [ref=e87] [cursor=pointer]:
            - /url: "#"
          - link "Contact" [ref=e88] [cursor=pointer]:
            - /url: "#"
  - generic [ref=e89]:
    - button "Toggle Nuxt DevTools" [ref=e90] [cursor=pointer]
    - generic "Page load time" [ref=e94]:
      - generic [ref=e95]: "158"
      - generic [ref=e96]: ms
    - button "Toggle Component Inspector" [ref=e98] [cursor=pointer]
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  94  |   const attempt = await started.json() as { attemptId: string }
  95  | 
  96  |   await page.goto(`/scaffolds/${attempt.attemptId}`)
  97  |   await waitForNuxtHydration(page)
  98  |   await expect(page.locator('[data-step-id="step-rebuild-from-twos-and-ones"]')).toBeVisible()
  99  | })
  100 | 
  101 | async function dragPiece(page: Page, length: number, targetX: number, targetY: number) {
  102 |   const supply = page.locator(`[data-step-id="step-rebuild-from-twos-and-ones"] .supply-piece[data-length="${length}"]`)
  103 |   const box = await supply.boundingBox()
  104 |   if (!box) throw new Error('supply piece not visible')
  105 |   await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  106 |   await page.mouse.down()
  107 |   await page.mouse.move(box.x + box.width / 2 + 40, box.y + 40, { steps: 4 })
  108 |   await page.mouse.move(targetX, targetY, { steps: 12 })
  109 |   await page.mouse.up()
  110 | }
  111 | 
  112 | test('a legal drop stays, a rule-breaking drop reverts, and the board survives a reload', async ({ page, request }) => {
  113 |   const started = await request.post('/api/attempts', {
  114 |     data: { practiceItemId: 'practice-item-sample-1' },
  115 |   })
  116 |   expect(started.ok()).toBeTruthy()
  117 |   const attempt = await started.json() as { attemptId: string }
  118 | 
  119 |   await page.goto(`/scaffolds/${attempt.attemptId}`)
  120 |   await waitForNuxtHydration(page)
  121 |   const board = page.locator('[data-step-id="step-rebuild-from-twos-and-ones"]')
  122 |   await expect(board).toBeVisible()
  123 |   const grid = await board.locator('.grid').boundingBox()
  124 |   if (!grid) throw new Error('grid not visible')
  125 |   const unit = 28
  126 | 
  127 |   // A red two on the 4, from column 1: legal and accepted.
  128 |   const accepted = page.waitForResponse('**/checks')
  129 |   await dragPiece(page, 2, grid.x + 1 * unit + unit, grid.y + 4 * unit + unit / 2)
  130 |   await accepted
  131 |   await expect(board.locator('[data-role="placed"][data-length="2"][data-y="4"]')).toHaveCount(1)
  132 | 
  133 |   // A white on the 4 breaks "as many twos as fit": shown, then taken back.
  134 |   const rejected = page.waitForResponse('**/checks')
  135 |   await dragPiece(page, 1, grid.x + 3 * unit + unit / 2, grid.y + 4 * unit + unit / 2)
  136 |   await rejected
  137 |   await expect(board.locator('[data-role="placed"][data-length="1"]')).toHaveCount(0, { timeout: 3000 })
  138 |   await expect(board.locator('[data-role="placed"]')).toHaveCount(1)
  139 | 
  140 |   await page.reload()
  141 |   await waitForNuxtHydration(page)
  142 |   await expect(page.locator('[data-step-id="step-rebuild-from-twos-and-ones"] [data-role="placed"][data-length="2"][data-y="4"]')).toHaveCount(1)
  143 | })
  144 | 
  145 | test('an item without a scaffold shows a safe error', async ({ page, request }) => {
  146 |   const started = await request.post('/api/attempts', {
  147 |     data: { practiceItemId: 'practice-item-sample-2' },
  148 |   })
  149 |   expect(started.ok()).toBeTruthy()
  150 |   const attempt = await started.json() as { attemptId: string }
  151 | 
  152 |   const checked = await request.post(`/api/attempts/${attempt.attemptId}/checks`, {
  153 |     data: { selectedAnswerId: 'answer-b' },
  154 |   })
  155 |   expect(checked.ok()).toBeTruthy()
  156 | 
  157 |   await page.goto(`/scaffolds/${attempt.attemptId}`)
  158 |   await waitForNuxtHydration(page)
  159 |   const alert = page.getByTestId('scaffold-safe-error')
  160 |   await expect(alert).toBeVisible()
  161 |   await expect(alert).toContainText('not available yet')
  162 |   await expect(alert).not.toContainText('stopped-at-this-year')
  163 | })
  164 | 
  165 | test('ask the coach sends only the step id and the question, and shows the authored reply', async ({ page, request }) => {
  166 |   const started = await request.post('/api/attempts', {
  167 |     data: { practiceItemId: 'practice-item-sample-1' },
  168 |   })
  169 |   expect(started.ok()).toBeTruthy()
  170 |   const attempt = await started.json() as { attemptId: string }
  171 | 
  172 |   const captured: Record<string, unknown>[] = []
  173 |   await page.route('**/api/attempts/*/coach', async (route) => {
  174 |     captured.push(route.request().postDataJSON() as Record<string, unknown>)
  175 |     await route.fulfill({
  176 |       status: 200,
  177 |       contentType: 'application/json',
  178 |       body: JSON.stringify({
  179 |         move: {
  180 |           type: 'answerQuestion',
  181 |           message: 'A piece comes back when it breaks the rule.',
  182 |           focusPhraseIds: [],
  183 |           stepId: 'step-rebuild-from-twos-and-ones',
  184 |         },
  185 |       }),
  186 |     })
  187 |   })
  188 | 
  189 |   await page.goto(`/scaffolds/${attempt.attemptId}`)
  190 |   await waitForNuxtHydration(page)
  191 |   await expect(page.locator('[data-step-id="step-rebuild-from-twos-and-ones"]')).toBeVisible()
  192 | 
  193 |   await page.getByTestId('ask-coach').click()
> 194 |   await page.getByLabel('Your question for the coach').fill('why did my white come back?')
      |                                                        ^ Error: locator.fill: Test timeout of 90000ms exceeded.
  195 |   await page.getByTestId('coach-send').click()
  196 | 
  197 |   await expect(page.getByTestId('coach-reply')).toContainText('A piece comes back when it breaks the rule.')
  198 |   expect(captured).toEqual([{
  199 |     event: 'stepQuestionAsked',
  200 |     stepId: 'step-rebuild-from-twos-and-ones',
  201 |     question: 'why did my white come back?',
  202 |   }])
  203 |   // The student stays on the step: a question never routes.
  204 |   await expect(page.locator('[data-step-id="step-rebuild-from-twos-and-ones"]')).toBeVisible()
  205 | })
  206 | 
```