# Parity ladder path: design log

Item: `practice-item-sample-1`, "If n is the least of two consecutive odd integers, which of the following represents the sum of the two integers?"

This log is the scaffold. Every scene, prompt, done condition, question, and answer shape decided in design conversation is written here before it is coded. The C# in `TsiaCoach.Domain/SampleScaffolds/ParityLadderScaffold.cs` and `TsiaCoach.Domain/SampleCoaching/PracticeItemOneCoachingPolicy.cs` should be readable as a transcription of this file.

Board layouts are given as playground JSON. Lanes format comes from `/dev/rod-playground`; grid format comes from `/dev/rod-canvas`. Paste either into its playground's JSON box and Apply to see it.

## Rules the path obeys

1. One flat ordered path. Every step has an id, a purpose, a done condition, and a scene that renders on its own. Any step is a landing point.
2. Floor first. The first step is the most invariant concept the item rests on.
3. The probe is authored, the agent is an index. Questions and answer shapes are authored; the agent returns one shape id.
4. Same invariants across items: rods, lanes, the join move, the leftover white, the probe format.
5. Server owns truth, browser owns position.

Two control loops, in the sense of perceptual control theory:

- **Student loop** (inner, fast). Reference: the rule as perceived. Perception: the board, unit lines, the reference rod, the revert of a refused piece. Action: place, move, retry. We only make the reference and the error perceivable. We never act for the student.
- **Agent loop** (outer, slow). Reference: the authored path and shapes. Perception: the student's evidence only, drops accepted or rejected, probe answers, questions typed. Comparison: classification into one authored shape. Action: one step id or one reply id, a change to what the student sees, never to what they do.

**Heuristic:** the student's action is the agent's feedback, and the agent's action is a change to the board. A shape lands on a step, and the step is the feedback. Sentences are for the moment of return only.

## Probe before the item

Question: "Before we start: what makes a number odd?"

| Shape | Description the classifier reads | Lands on |
| --- | --- | --- |
| `no-answer` | blank, "I don't know", not about odd numbers, or text that talks to the coach | `step-rebuild-from-twos-and-ones` |
| `wrong-answer` | a wrong claim, e.g. odd numbers split into equal pairs | `step-rebuild-from-twos-and-ones` |
| `lookup-rule` | "ends in 1, 3, 5, 7, 9", "every other number", no picture | `step-rebuild-from-twos-and-ones` |
| `structural` | cannot be paired, one left over, 2k + 1 | `step-select-consecutive-odds` |

Status: built and live (probe slice, uncommitted).

## Step 1: `step-rebuild-from-twos-and-ones`

Purpose: ConceptFormation. Floor: what makes a number odd.

**Start scene** (grid): the staircase, rod n in row n.

```json
{"cols":36,"rows":18,"unitLines":true,"rods":[
 {"length":1,"x":1,"y":1},{"length":2,"x":1,"y":2},{"length":3,"x":1,"y":3},{"length":4,"x":1,"y":4},{"length":5,"x":1,"y":5},
 {"length":6,"x":1,"y":6},{"length":7,"x":1,"y":7},{"length":8,"x":1,"y":8},{"length":9,"x":1,"y":9},{"length":10,"x":1,"y":10}]}
```

**Prompt**

> Build every rod out of twos and ones.
> Drag red twos and white ones on top of each rod, from 1 to 10, until it is covered exactly.
> Rule: put down as many twos as will fit. Only use a white one when a two won't fit.

**Done state** (grid): every row is floor(n / 2) reds then n mod 2 whites, from the left edge. Rows 1 and 2 already count.

```json
{"cols":36,"rows":18,"unitLines":true,"rods":[
 {"length":1,"x":1,"y":1},
 {"length":2,"x":1,"y":2},
 {"length":2,"x":1,"y":3},{"length":1,"x":3,"y":3},
 {"length":2,"x":1,"y":4},{"length":2,"x":3,"y":4},
 {"length":2,"x":1,"y":5},{"length":2,"x":3,"y":5},{"length":1,"x":5,"y":5},
 {"length":2,"x":1,"y":6},{"length":2,"x":3,"y":6},{"length":2,"x":5,"y":6},
 {"length":2,"x":1,"y":7},{"length":2,"x":3,"y":7},{"length":2,"x":5,"y":7},{"length":1,"x":7,"y":7},
 {"length":2,"x":1,"y":8},{"length":2,"x":3,"y":8},{"length":2,"x":5,"y":8},{"length":2,"x":7,"y":8},
 {"length":2,"x":1,"y":9},{"length":2,"x":3,"y":9},{"length":2,"x":5,"y":9},{"length":2,"x":7,"y":9},{"length":1,"x":9,"y":9},
 {"length":2,"x":1,"y":10},{"length":2,"x":3,"y":10},{"length":2,"x":5,"y":10},{"length":2,"x":7,"y":10},{"length":2,"x":9,"y":10}]}
```

**Reference rod.** Stays visible under the build, or in its own lane above it as on the physical board. Toggle between the two on the canvas is pending. "Covered exactly" has to be checkable by eye.

**Every drop is a check.** The browser posts the row build so far, never a verdict. The server answers one of three:

- `rejected`: the piece broke the rule. A white where a two still fits, a piece past the end of the rod, or overlap. The browser shows the piece landed, freezes input for half a second, then slides that piece back to the supply. Only that piece. The row does not reset.
- `accepted`: legal, not finished.
- `complete`: every rod covered exactly.

History is append-only, one entry per drop.

**Done condition for the server.** For each n in 1..10, the row holds floor(n / 2) twos and n mod 2 whites laid end to end from the left edge, nothing else.

**Ask the coach** (available on every step). Free text, sent with the current step id. The agent picks one authored question shape; the server returns the authored reply. Questions never move the student. First shapes for step 1: what the pieces are, where they go, why a white was refused, off topic.

Status: built. `GridScene` with reference pieces and target rows; action `PlacePieces([2, 1])`; check `MatchesRowCompositions(2)`; outcomes rejected / accepted / complete; the runner's `GridScene.vue` drags, drops, and reverts a rejected piece after half a second. The build resumes from the session's evidence on reload. The reference rod stays underneath the build.

## After step 1: the pattern question

Asked once step 1 is complete.

> Look at where the whites ended up. What pattern do you see?

| Shape | Description | Agent action |
| --- | --- | --- |
| `structural` | every other rod ends with a white; the whites step down in a diagonal; odd rods have one left over | land on `step-sort-paired-evens` |
| `other-true-pattern` | a real pattern that is not the target: "the reds make a triangle", "each row is one longer" | reply, then land on `step-contrast-pair` |
| `nothing` | blank, wrong, or off topic | land on `step-mark-the-whites` |

Reply for `other-true-pattern`, "the reds make a triangle": "You hit a very strong case. If you want, after this question we can dig into your observation." Record a `bonus-offered` fact on the attempt. See the bonus path below.

Reply for `other-true-pattern`, "each row is one longer": no paragraph. The next step is the reply.

Insight recorded: a second miss is not the same failure as the first. After the student has built or marked the pattern with their hands, a miss is a words gap, not a seeing gap. The name is supplied in step 2, at the right moment, after the picture exists. Narrow the question, do not repeat it. No loops.

## Step 1b: `step-contrast-pair`

Purpose: ConceptFormation. Landing for `other-true-pattern`.

**Scene** (lanes): a reference in its own lane, an empty build lane under it, twice.

```json
{"units":40,"markers":[],"tracks":[
 {"label":"8","rods":[{"length":8,"start":0}]},
 {"label":"","rods":[]},
 {"label":"9","rods":[{"length":9,"start":0}]},
 {"label":"","rods":[]}]}
```

**Prompt**

> Fill the empty rows with twos and ones. As many twos as will fit.

**Done**: lane 2 is four reds from 0; lane 4 is four reds and a white from 0.

**Narrowed question**, asked when done. Base wording from design:

> 9 is one larger than 8, as you noticed. How does 8 differ from 9, other than being bigger by one?

Candidate polish, same content:

> 9 is one longer than 8, just as you said. Look at the two rows you built. What does the 9 row have that the 8 row does not?

| Shape | Description | Lands on |
| --- | --- | --- |
| `structural` | the 9 has a white; one left over; it does not split into twos | `step-sort-paired-evens` |
| `anything-else` | still "longer", nothing, off topic | `step-sort-paired-evens`, where the name is stated |

This is the last rung. No further retry.

## Step 1c: `step-mark-the-whites`

Purpose: ConceptFormation. Landing for `nothing`.

**Scene**: the done state of step 1, rods clickable by row.

**Prompt**

> Click every rod that ends with a white one.

**Done**: rows 1, 3, 5, 7, 9 marked, no others.

**Narrowed question**, asked when done:

> Which rods did you click?

| Shape | Description | Lands on |
| --- | --- | --- |
| `reads-the-odds` | 1, 3, 5, 7, 9; every other one; the odd ones | `step-sort-paired-evens` |
| `anything-else` | | `step-sort-paired-evens`, where the name is stated |

## Step 2: `step-sort-paired-evens` (replaces `step-remove-paired-evens`)

Purpose: ConceptFormation, naming. Nothing is removed; the student sorts.

**Scene** (grid): the done state of step 1. Each row's train is one clickable group. Clicking a group moves it whole to the compare column at x = 12, same row. Clicking it again brings it back.

**Prompt**

> Click every row that is made only of reds. It will move to the right so you can compare.

**Done state** (grid): all-red rows on the right at x = 12, white-ended rows still on the left.

```json
{"cols":36,"rows":18,"unitLines":true,"rods":[
 {"length":1,"x":1,"y":1},
 {"length":2,"x":12,"y":2},
 {"length":2,"x":1,"y":3},{"length":1,"x":3,"y":3},
 {"length":2,"x":12,"y":4},{"length":2,"x":14,"y":4},
 {"length":2,"x":1,"y":5},{"length":2,"x":3,"y":5},{"length":1,"x":5,"y":5},
 {"length":2,"x":12,"y":6},{"length":2,"x":14,"y":6},{"length":2,"x":16,"y":6},
 {"length":2,"x":1,"y":7},{"length":2,"x":3,"y":7},{"length":2,"x":5,"y":7},{"length":1,"x":7,"y":7},
 {"length":2,"x":12,"y":8},{"length":2,"x":14,"y":8},{"length":2,"x":16,"y":8},{"length":2,"x":18,"y":8},
 {"length":2,"x":1,"y":9},{"length":2,"x":3,"y":9},{"length":2,"x":5,"y":9},{"length":2,"x":7,"y":9},{"length":1,"x":9,"y":9},
 {"length":2,"x":12,"y":10},{"length":2,"x":14,"y":10},{"length":2,"x":16,"y":10},{"length":2,"x":18,"y":10},{"length":2,"x":20,"y":10}]}
```

**Every click is a check.** Moving a white-ended row is `rejected`: it lands on the right, half a second, then slides back. Moving an all-red row is `accepted`. All five all-red rows on the right and none of the others is `complete`. Row 2, a single red, moves too.

**Done condition for the server.** Rows 2, 4, 6, 8, 10 at x = 12; rows 1, 3, 5, 7, 9 at x = 1; every train intact.

**Question**, asked when done. Base wording from design:

> Which group is odd, and why?

Candidate polish:

> Two groups now. Which group are the odd numbers, and what do they all have?

| Shape | Description | Lands on |
| --- | --- | --- |
| `left-with-reason` | the left group, because each has a white left over; they don't split into twos; one extra; not divisible by 2 | `step-select-consecutive-odds` |
| `left-no-reason` | points at the left group with no reason, or "because they're odd" | narrowed: "What do all the rows on the left have that none on the right have?" then `step-select-consecutive-odds` |
| `right-or-nothing` | the right group, blank, or off topic | the name is stated (below), then `step-select-consecutive-odds` |

**Recompress**, shown to everyone on leaving the step, in the student's own picture first and the symbol second:

> The rows on the left each have one white left over. They cannot be split into twos, so they are not divisible by 2. Numbers like that are called odd.
> The rows on the right split into twos exactly. They are divisible by 2. Numbers like that are called even.

This is where the words "odd" and "even" are given, and where "not divisible by 2" is attached to the leftover white. Every landing from the pattern question and the contrast pair arrives here, so every student meets the name after the picture.

Note on classification: "not divisible by 2" is a `lookup-rule` shape at the probe, before any picture exists, and a `left-with-reason` shape here, after the student built the picture. The same sentence classifies differently depending on where on the path it is said. That is intended. The shape describes what the student has behind the words, not the words.

**Invariant gained:** a train treated as one clickable piece. This is the same move as "box the whole" on the bread item (2w + 10 as one thing), so it is shared vocabulary, not a one-off.

## Step 3: `step-select-consecutive-odds`

Purpose: LanguageInterpretation. The item's phrase "two consecutive odd integers" gets its picture here. Focus phrase: `phrase-ordered-step`.

**Scene** (grid): only the odd rows remain, as built in step 1, each train one clickable piece.

```json
{"cols":36,"rows":18,"unitLines":true,"rods":[
 {"length":1,"x":1,"y":1},
 {"length":2,"x":1,"y":3},{"length":1,"x":3,"y":3},
 {"length":2,"x":1,"y":5},{"length":2,"x":3,"y":5},{"length":1,"x":5,"y":5},
 {"length":2,"x":1,"y":7},{"length":2,"x":3,"y":7},{"length":2,"x":5,"y":7},{"length":1,"x":7,"y":7},
 {"length":2,"x":1,"y":9},{"length":2,"x":3,"y":9},{"length":2,"x":5,"y":9},{"length":2,"x":7,"y":9},{"length":1,"x":9,"y":9}]}
```

**Prompt**, introducing the item's word with a gloss:

> Click two consecutive odd numbers: two that are next to each other in this list.

**Click check.** The first click is `accepted` and highlights the row. The second click is `complete` if the two rows are neighbours in the list (1 and 3, 3 and 5, 5 and 7, 7 and 9), any pair. A non-neighbour second click is `rejected`: it highlights, half a second, then clears, and the first stays selected.

**Compare scene after the click**, from design, for the pair 3 and 5 (lanes): the two chosen trains as built, then the same two numbers as whole rods. Decompressed above, compressed below, left-aligned.

```json
{"units":40,"markers":[],"tracks":[
 {"label":"3","rods":[{"length":2,"start":0},{"length":1,"start":2}]},
 {"label":"5","rods":[{"length":2,"start":0},{"length":2,"start":2},{"length":1,"start":4}]},
 {"label":"3","rods":[{"length":3,"start":0}]},
 {"label":"5","rods":[{"length":5,"start":0}]}]}
```

The same scene is authored for every neighbour pair; the server builds it from the pair the student chose.

**Then, proposed (not yet confirmed in design):** the move is on the whole-rod lanes.

> Make the 3 as long as the 5.

Dropping a red 2 after the green 3 is `complete`. Two whites are `rejected` under the same rule as step 1, as many twos as fit. Anything longer is `rejected`. The built lanes above show why it is one red: the 5 has one more red than the 3 and the same white.

**Recompress**, shown on leaving:

> From one odd number to the next is always one red: 2. If the first odd number is n, the next one is n + 2.

This is the item's latent fact `latent-ordered-step` = 2 and the second member `n + 2`, now built rather than told. The step's `SuccessCheck` should reference those facts, as the current code already does.

**Question**, optional, if a probe is wanted here: "How much longer is the second one?" Shapes: `two` lands on step 4; anything else gets the recompress stated and lands on step 4.

Replaces the current traverse-all-gaps mechanic, which walked every gap. One chosen pair is enough once the odds are already sorted.

## Step 4: `step-name-the-smaller`

Purpose: Representation. The item says "n is the least of two consecutive odd integers"; here the student picks which one is n. Focus phrase: `phrase-selector`.

**Scene**: the compare scene from step 3, the pair the student chose, built forms above and whole rods below.

**Prompt**

> Click the smaller one. That one is n.

**Click check.** Clicking the smaller whole rod, or its built form, is `complete`. Clicking the larger is `rejected`: highlight, half a second, clear.

**Then the picture changes** (lanes). The whole rods are replaced by tiles: the smaller becomes a variable tile n, the larger becomes n plus two constant tiles. The built forms stay above so the extra red lines up with the two constants.

```json
{"units":40,"markers":[],"tracks":[
 {"label":"3","rods":[{"length":2,"start":0},{"length":1,"start":2}]},
 {"label":"5","rods":[{"length":2,"start":0},{"length":2,"start":2},{"length":1,"start":4}]},
 {"label":"n","rods":[{"kind":"variable","symbol":"n","start":0}]},
 {"label":"n + 2","rods":[{"kind":"variable","symbol":"n","start":0},{"kind":"constant","start":4},{"kind":"constant","start":5}]}]}
```

Variable tiles have no fixed length. They are drawn 4 units wide on the playground and carry `kind: variable`; constants are yellow +1 tiles, `kind: constant`, distinct from the white 1 rod so a length and a counted unit never look the same.

**Recompress**, shown on leaving:

> The smaller odd number is n. The next odd number is n + 2. Whatever n is.

The step's landing for `stopped-at-second-integer` (answer B, `n + 2`) is the join step that follows, since that student already has n + 2 and stopped there.

## Step 5 onward

Existing on the flat path today, subject to re-authoring in the same way:

- `step-join-and-read-sum`: join n and n + 2 in the sum lane; read the total. With tiles this is the algebra-tile picture: n and n + 1 + 1 end to end read 2n + 2.
- `step-name-bar-count`: the 2 in 2n counts bars.
- `step-name-leftover-length`: the 2 in + 2 is a length.

Open: the handoff has one "name the two different 2s" step with one new latent fact; the code has two scalar readings. The consecutive-odds step checks every gap, the handoff says one clicked pair.

## Bonus path: triangular numbers

Offered after step 2 to any attempt holding `bonus-offered`. Its own short path, same moves.

**Scene** (grid): the staircase 1..10 in rows 1..10, its mirror 10..1 in rows 0..9, and the train 1..10 laid end to end on a wider ruler.

```json
{"cols":60,"rows":18,"unitLines":true,"rods":[
 {"length":10,"x":1,"y":0},
 {"length":1,"x":1,"y":1},{"length":9,"x":2,"y":1},
 {"length":2,"x":1,"y":2},{"length":8,"x":3,"y":2},
 {"length":3,"x":1,"y":3},{"length":7,"x":4,"y":3},
 {"length":4,"x":1,"y":4},{"length":6,"x":5,"y":4},
 {"length":5,"x":1,"y":5},{"length":5,"x":6,"y":5},
 {"length":6,"x":1,"y":6},{"length":4,"x":7,"y":6},
 {"length":7,"x":1,"y":7},{"length":3,"x":8,"y":7},
 {"length":8,"x":1,"y":8},{"length":2,"x":9,"y":8},
 {"length":9,"x":1,"y":9},{"length":1,"x":10,"y":9},
 {"length":10,"x":1,"y":10},
 {"length":1,"x":0,"y":14},{"length":2,"x":1,"y":14},{"length":3,"x":3,"y":14},{"length":4,"x":6,"y":14},{"length":5,"x":10,"y":14},
 {"length":6,"x":15,"y":14},{"length":7,"x":21,"y":14},{"length":8,"x":28,"y":14},{"length":9,"x":36,"y":14},{"length":10,"x":45,"y":14}]}
```

Steps:

1. The staircase 1 to 10 is on the board. Build its mirror beside it, 10 down to 1.
2. Read the shape: ten wide, eleven tall. Count it as a rectangle: 110.
3. The staircase is exactly half. What is half of 110?
4. Check it the slow way: lay 1 to 10 end to end and read the total.
5. Recompress: n rods make n by (n + 1), and the staircase is half. n(n + 1) / 2.

One new idea, two copies make a rectangle. It returns for any consecutive sum.

## Decisions taken

- Reference rod: keep it visible, in its own lane above the build (physical board) or underneath (canvas, toggle pending).
- Rejection: only the refused piece returns. The row does not reset.
- Follow-up misses: narrow once, then step 2 states the name. No loops. Misses are recorded as facts, never as gates.
- A true-but-other observation is never treated as wrong. It is acknowledged and narrowed.

## Build status

Built on the flat path (`ParityLadderScaffold.cs`): steps 1, 1b, 1c, 2, 3, 3b, 4, 5, 6, 7. Steps 1b and 1c are entry-only: ordinary progress skips them, a routed student lands on them. Every grid step answers rejected, accepted, or complete per move, and the browser reverts a rejected move after half a second. The browser renderer is `GridScene.vue`: a supply of allowed pieces, pointer drag onto the target rows, and click-to-move or click-to-select on rows. The current step's accepted evidence comes back with the session, so a reload rebuilds the board. Verified end to end: a red two on the 4 is accepted, a white on the 4 is rejected and taken back, and the two survives a reload (`tests/e2e/scaffold-session.spec.ts`).

Version-one simplifications, to be lifted later:

- Steps 3b and 4 fix the pair at 3 and 5. Step 3 accepts any neighbouring pair, but the compare scene does not yet follow the student's choice.
- Step 4 does not yet swap the whole rods for tiles on completion; step 5 shows n and n + 2 as before.
- The pattern question after step 1, the narrowed questions, and the bonus path are not built. Nothing routes to 1b or 1c yet.

Ask the coach is built on every step (`stepQuestionAsked` event, `answerQuestion` move). The shapes per step are authored in `PracticeItemOneCoachingPolicy.StepQuestions`: step 1 has what-pieces, where-to-put, why-refused; step 2 has which-rows, why-refused, what-is-odd; step 3 has what-consecutive, why-refused; step 3b has what-to-do, why-refused, why-two; step 4 has what-to-do, what-is-n; the later steps have what-to-do and one why shape. Every step ends with off-topic. The reply is authored; the model only picks the shape; the student never moves.

The walkthrough page is minimal: the original question with the words in focus, a step counter with a thin progress line, an Ask the coach button, the prompt, and the board.

Next:

1. Pattern question after step 1 with its three shapes and the landings on 1b and 1c.
2. The compare scene built from the student's chosen pair.
3. Bonus path.
