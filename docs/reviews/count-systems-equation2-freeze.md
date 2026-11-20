# Count Systems: Equation 2 stops updating

Found on 2026-11-20 while reproducing a bug in the `rod-count-systems` playground.
Turso session: `bceeb3fdc53f4968b673d592a3aeddf0` (42 events).

## What you saw

In Equation 1 (3x + 8y = 71) you moved and rotated x rods. The bottom
rectangle (Equation 2, 9x + 4y = 73) did not change. It showed:

> Previous candidate (x = 21, y = 1) — current material is unfinished

## What the event log shows

| Events | Action | Result |
|---|---|---|
| 0–19 | Added 20 x rods (`count.rod-added`) | 21 x rods + 1 y rod: 3(21) + 8(1) = 71. A valid candidate, so Equation 2 checked x = 21, y = 1 |
| 20–29 | Moved rods around | Still counted |
| 30, 33, 37 | **Rotated rods to `horizontal`** | Those rods stop counting |
| 38–41 | Stacked the lying rods next to the 8-rod | Board now has 16 upright x rods + 5 lying rods |

The last event's `sceneSummary` was `{"trains":22,"total":71,"rod-3":21,"rod-8":1}`.
It does not show that 5 of the rods no longer count.

## Why it happens (this is the current design)

1. **Only upright rods count.** `classifyCountMaterial` in
   `app/components/systems/systems.count-layout.ts` marks a lying x or y rod as
   *unassigned* (`reason: 'orientation'`). The test
   *"counts lying x rods as unassigned until they stand up"* in
   `systems.count.test.ts` locks this in.
2. **The board is "unfinished" while anything is unassigned.** `evaluateCountSystem`
   in `systems.count-evaluate.ts` sets `clean = false`, so there are no current
   counts to check.
3. **Equation 2 keeps the last good answer.** `app/composables/useSystemsCountActivity.ts`
   shows the last valid candidate with the label "Previous candidate … unfinished"
   (display kind `previous`) instead of the live counts.

So the code is doing what it was written to do. The problem is that a learner
can't tell why: the rectangle looks broken.

**Workaround today:** stand the 5 lying rods back up, or remove them. Equation 2
then updates right away.

## Options

### Option A: Lying rods count too

Treat a rotated x or y rod as the same variable as an upright one, since a 3-rod
has area 3 either way.

- **Change:** `classifyCountMaterial` stops sending orientation mismatches to
  `unassigned`. Update the test named above.
- **Good:** matches what you expected; Equation 2 always reacts.
- **Risk:** the activity may *want* rods upright, so the area picture (a row of
  columns) matches Equation 2's layout. Exchange and "arrange" in
  `systems.count-operations.ts` may assume upright rods and need checking.

### Option B: Keep the rule, explain it better

Keep "upright only", but make it obvious.

- **B1.** Change the Equation 2 banner to say what to do, for example:
  *"Equation 2 is paused: 5 rods are lying down. Stand them up to update."*
- **B2.** Highlight the lying rods more strongly (they already get grey hatching).
- **B3.** Optionally stop rotation of x or y rods in Equation 1 altogether, so
  this state can't happen.
- **Good:** small change, keeps the teaching intent.
- **Risk:** B3 takes away a move the learner may want.

### Option C: Better logging for agents (works with A or B)

Today an agent reading the log can't see why Equation 2 froze.

- Add the count evaluation to each event's `sceneSummary` for this playground,
  for example `{ "xCount": 16, "yCount": 1, "unassigned": 15, "equation2Paused": 1 }`.
- **Where:** `app/components/playground/events/scene-events.ts` already accepts a
  `summarize` callback (around line 249). The count activity can pass one built
  from `evaluation` and `display`.
- **Limit:** `sceneSummary` values must be whole numbers, with at most 40 keys
  (`shared/effect/playground-events.ts`). These fit.

## Recommendation

**B1 + C.** Keep the teaching rule, but make the banner say exactly what's wrong
and how to fix it, and record the reason in the log. Choose **A** instead if lying
rods *should* count in this activity; that's a teaching decision.

## Decision

- [ ] A: lying rods count
- [ ] B1: clearer banner
- [ ] B2: stronger highlight
- [ ] B3: block rotation in Equation 1
- [ ] C: log the evaluation in `sceneSummary`
