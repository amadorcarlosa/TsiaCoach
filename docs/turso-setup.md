# Set up the Turso database for playground events

This guide connects the playground action log to a Turso Cloud database. The free
Turso plan is enough for development. For more on the design, see the
[playground event log plan](architecture/playground-event-log-plan.md).

## 1. Create the database

In the Turso dashboard, click **Create Database**:

- **Name:** `tsia-playground-dev`. Use separate databases for production
  (`tsia-playground-prod`) and for tests.
- **Location:** the region closest to you or your API host.
- **Engine:** turn on the toggle **"Run this database on TursoDB, the Rust rewrite of
  SQLite"**. That's the new engine, which the plan uses. If the toggle is greyed out, click
  **Enable concurrent writes for this organization** below it first, then turn it on.
  The standard libSQL engine (toggle off) also works.

## 2. Get the URL and a token

1. Open the database and copy its URL. It looks like
   `libsql://tsia-playground-dev-<org>.<region>.turso.io`. The API accepts `libsql://`
   and switches it to HTTPS.
2. Create a database token with read/write access. Only the API uses it, so it needs
   no wider rights. Copy it right away; it's shown once.

## 3. Store them as Aspire secrets

Run these from the repository root:

```powershell
aspire secret set "Parameters:turso-url" "libsql://YOUR-DB-URL"
aspire secret set "Parameters:turso-auth-token" "YOUR_TOKEN"
```

Never put the token in code, docs, or chat. AppHost secrets are stored per machine,
so repeat this step on each computer you work on.

## 4. Turn on the log and start Aspire

The web app records nothing unless the AppHost parameter `playground-events-enabled` is
`true` (default `false`). Aspire passes it to Nuxt as `NUXT_PUBLIC_PLAYGROUND_EVENTS_ENABLED`.

```powershell
aspire secret set "Parameters:playground-events-enabled" "true"
aspire start
```

## 5. Check that it works

1. In the Aspire dashboard, the `web-nuxt` resource should show
   `NUXT_PUBLIC_PLAYGROUND_EVENTS_ENABLED = true`, and the API logs should no longer show
   "Playground events use in-memory storage".
2. Open a playground. Click **granted** on the consent notice, then do a few actions.
3. In the browser dev tools Network tab, look for `POST /api/playground-sessions` (201)
   and `POST /api/playground-sessions/<id>/events` (200).
4. In the Turso dashboard, check that `playground_sessions` and `playground_events`
   have rows. The API creates both tables on first use.

To check from the command line, run this smoke test against the API's HTTP endpoint (port
from the Aspire dashboard). It creates a session, saves one event, reads it back, and
deletes it:

```powershell
$base = "http://localhost:5145/api/playground-sessions"
$s = Invoke-RestMethod -Method Post -Uri $base -ContentType 'application/json' `
    -Body (@{ playground = 'base-ten'; consent = 'granted' } | ConvertTo-Json)
$evt = @{ sessionId = $s.sessionId; events = @(@{
    id = [guid]::NewGuid().ToString(); sessionId = $s.sessionId; playground = 'base-ten'; seq = 0
    at = (Get-Date).ToUniversalTime().ToString('o'); type = 'block.placed'; outcome = 'applied'
    data = @{ denomination = 'tens' } }) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri "$base/$($s.sessionId)/events" -ContentType 'application/json' -Body $evt
Invoke-RestMethod -Uri "$base/$($s.sessionId)/events"
Invoke-WebRequest -Method Delete -Uri "$base/$($s.sessionId)" -UseBasicParsing
```

Expect `accepted: 1`, then the event, then status `204`. `aspire describe api` should
show `PlaygroundEvents__Store` set to `Turso`.

## Optional: run the store tests against Turso

Point the tests at a separate, disposable test database, never the dev or production one:

```powershell
$env:TSIA_TEST_TURSO_URL = "libsql://YOUR-TEST-DB-URL"
$env:TSIA_TEST_TURSO_TOKEN = "TEST_TOKEN"
dotnet test --project TsiaCoach.WebApi.Tests
```

Without these variables, the Turso store tests are skipped and the suite uses in-memory storage.

## Deployment

Aspire publish and deploy ask for the `turso-url` and `turso-auth-token` parameters.
For non-interactive deploys, set them as environment variables on the `aspire deploy`
process (`Parameters__turso-url`, `Parameters__turso-auth-token`). `aspire secret set`
is for local development only.
