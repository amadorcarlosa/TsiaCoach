# Coach playground

Open **Admin → Coach playground** (`/admin/chat`). This replaces the old admin
chat setup screen with a math board and AI experiment controls.

1. Choose **Bar rods** or **MathTabla**, then add and arrange rods. Switching boards
   preserves each arrangement. On a portrait phone, rotate to landscape to edit.
2. Describe the task and an optional student message.
3. Select a configured model and choose **Structured decision** or **Coaching
   response**. Expand **Coach instructions** to edit the system prompt.
4. Select **Capture board & run**. The current board is copied into the request;
   subsequent board edits do not change previous runs.
5. Inspect the response, request snapshot, instructions, latency, and token counts.

Each run is independent, without conversation history. Up to 20 runs are retained
in page memory; navigation or reload clears them. Clearing a board requires
confirmation and does not change captured runs.

Structured decisions call **Jev 1.13** through OpenRouter's Decisions API for an
`observe`, `ask`, `hint`, or `demonstrate` choice. The inspector shows its reported
confidence and probabilities, exact request, raw response, timing, and usage.
Jev returns no generated message. Explanatory UI text is app-authored. The backend
validates allowed choices and probability ranges, not mathematical correctness.
Responses never execute board actions. Coaching response mode continues using
the selected chat model. Configuration follows [OpenRouter setup](openrouter.md).

Validation:

```powershell
cd tsia-coach-web-nuxt
pnpm test
pnpm exec nuxt typecheck
pnpm exec playwright test --config playwright.coach-playground.config.ts
```

The dedicated browser tests use the real boards and mocked model/agent endpoints;
they make no paid AI calls and require no API key.
