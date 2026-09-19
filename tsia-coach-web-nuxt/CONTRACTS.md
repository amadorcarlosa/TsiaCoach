# Frontend synchronization gate

`pnpm dev`, `pnpm build`, and `pnpm generate` first run `pnpm test:sync`.
That command runs the frontend unit tests followed by the live C# catalog contract
tests for rods, base-10 blocks, and algebra tiles. Any failure returns a nonzero
exit code and prevents Nuxt from starting or building.

Start the C# API containing the current changes first. Set `NUXT_API_URL` to its
origin in the shell or the frontend `.env` file, then run the usual frontend command:

```powershell
$env:NUXT_API_URL = 'http://localhost:<api-port>'
pnpm dev
```

Missing configuration, an unreachable API, invalid JSON, missing/duplicate catalog
entries, or mismatched definitions fail the gate. There is no fixture fallback.
Individual suites also support `ROD_API_URL`, `BASE10_API_URL`, and
`ALGEBRA_TILE_API_URL`; use `NUXT_API_URL` to check all catalogs against one API.
CI builds must provision the API and supply the same configuration.

The algebra tile playground follows the base-10 structure: generated OpenAPI type
aliases, a Nuxt API proxy, a Zod schema, a local catalog and appearance mapping,
scene/interaction composables, and separate visual, draggable, tray, and menu
components. Its presentation reuses the rods' `useBoardLayout`, `GridSurface`,
`CuisenaireRod` renderer, and tray styles: a 24-by-12 board with a 15-degree tilt.
Contract tests compare the local signed definitions with C#.
The drawn lengths for x and y affect layout only, not symbolic values.

This is a startup/build gate. A dev server already running is not stopped by a
later backend change; rerun `pnpm test:sync` or restart it to check synchronization.
