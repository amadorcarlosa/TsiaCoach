<script setup lang="ts">
/**
 * Cuisenaire rod canvas.
 *
 * A free two-dimensional grid, in the spirit of the Brainingcamp
 * manipulative: rods go anywhere on the grid, snap to whole cells, never
 * overlap, and can stand vertically. Unit lines show each rod as unit
 * squares. The DOM carries the whole arrangement as data attributes and
 * ARIA labels, so selecting the board element (or copying the JSON / link)
 * hands the exact picture over.
 */

interface Rod {
  id: number
  length: number
  x: number
  y: number
  vertical: boolean
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Drag {
  length: number
  vertical: boolean
  rodId: number | null
  grabX: number
  grabY: number
  clientX: number
  clientY: number
  cell: { x: number, y: number } | null
  valid: boolean
  /** Set once the pointer has travelled; a still click never drops or removes. */
  moved: boolean
}

const UNIT = 28
const STORAGE_KEY = 'tsia-rod-canvas-v1'

const ROD_COLORS: Record<number, { name: string, fill: string, ink: string }> = {
  1: { name: 'white', fill: '#f4f4ef', ink: '#1c1c1c' },
  2: { name: 'red', fill: '#d63c3c', ink: '#ffffff' },
  3: { name: 'light-green', fill: '#7bc95a', ink: '#10240c' },
  4: { name: 'purple', fill: '#8e4fbf', ink: '#ffffff' },
  5: { name: 'yellow', fill: '#f2c94c', ink: '#2a2200' },
  6: { name: 'dark-green', fill: '#2e8b57', ink: '#ffffff' },
  7: { name: 'black', fill: '#242424', ink: '#ffffff' },
  8: { name: 'brown', fill: '#8b5a2b', ink: '#ffffff' },
  9: { name: 'blue', fill: '#2f6fd6', ink: '#ffffff' },
  10: { name: 'orange', fill: '#f28c28', ink: '#1f1200' },
}

const cols = ref(36)
const rows = ref(18)
const unitLines = ref(true)
const gridLines = ref(true)
const rods = ref<Rod[]>([])
const selectedRodId = ref<number | null>(null)
const drag = ref<Drag | null>(null)
const jsonDraft = ref('')
const jsonError = ref<string | null>(null)
const copied = ref<string | null>(null)
const gridEl = ref<HTMLElement | null>(null)
let nextId = 1

function rodName(length: number): string {
  return ROD_COLORS[length]?.name ?? `length-${length}`
}

function rectOf(rod: Pick<Rod, 'length' | 'x' | 'y' | 'vertical'>): Rect {
  return rod.vertical
    ? { x: rod.x, y: rod.y, w: 1, h: rod.length }
    : { x: rod.x, y: rod.y, w: rod.length, h: 1 }
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function fits(candidate: Pick<Rod, 'length' | 'x' | 'y' | 'vertical'>, ignoreId: number | null): boolean {
  const rect = rectOf(candidate)
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > cols.value || rect.y + rect.h > rows.value) return false
  return !rods.value.some(rod => rod.id !== ignoreId && overlaps(rect, rectOf(rod)))
}

function nearestFit(length: number, vertical: boolean, x: number, y: number, ignoreId: number | null): { x: number, y: number } | null {
  for (let radius = 0; radius <= 6; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
        const candidate = { length, vertical, x: x + dx, y: y + dy }
        if (fits(candidate, ignoreId)) return { x: candidate.x, y: candidate.y }
      }
    }
  }
  return null
}

// ---------------------------------------------------------------- readout

const rowSummaries = computed(() => {
  const lines: string[] = []
  const horizontalByRow = new Map<number, Rod[]>()
  const verticals: Rod[] = []
  for (const rod of rods.value) {
    if (rod.vertical) verticals.push(rod)
    else horizontalByRow.set(rod.y, [...(horizontalByRow.get(rod.y) ?? []), rod])
  }
  for (const y of [...horizontalByRow.keys()].sort((a, b) => a - b)) {
    const row = horizontalByRow.get(y)!.sort((a, b) => a.x - b.x)
    const parts: string[] = []
    let cursor: number | null = null
    for (const rod of row) {
      if (cursor !== null && rod.x > cursor) parts.push(`gap [${cursor}–${rod.x}]`)
      parts.push(`${rodName(rod.length)} ${rod.length} [${rod.x}–${rod.x + rod.length}]`)
      cursor = rod.x + rod.length
    }
    const total = row.reduce((sum, rod) => sum + rod.length, 0)
    lines.push(`Row ${y}: ${parts.join(', ')} · total ${total}`)
  }
  for (const rod of verticals.sort((a, b) => a.x - b.x || a.y - b.y)) {
    lines.push(`Column ${rod.x}: vertical ${rodName(rod.length)} ${rod.length} rows [${rod.y}–${rod.y + rod.length}]`)
  }
  return lines.length > 0 ? lines : ['Empty board']
})

const boardJson = computed(() => JSON.stringify({
  cols: cols.value,
  rows: rows.value,
  unitLines: unitLines.value,
  rods: [...rods.value]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map(rod => ({
      length: rod.length,
      color: rodName(rod.length),
      x: rod.x,
      y: rod.y,
      orientation: rod.vertical ? 'vertical' : 'horizontal',
    })),
}, null, 2))

// ---------------------------------------------------------------- pointer drag

function beginDrag(event: PointerEvent, length: number, vertical: boolean, rodId: number | null) {
  if (event.button !== 0) return
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  drag.value = {
    length,
    vertical,
    rodId,
    grabX: Math.min(event.clientX - rect.left, (vertical ? 1 : length) * UNIT - UNIT / 2),
    grabY: Math.min(event.clientY - rect.top, (vertical ? length : 1) * UNIT - UNIT / 2),
    clientX: event.clientX,
    clientY: event.clientY,
    cell: null,
    valid: false,
    moved: false,
  }
  if (rodId !== null) selectedRodId.value = rodId
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', cleanupDrag)
  // No preventDefault here: it would suppress the click and dblclick that
  // select and rotate. Text selection is blocked in CSS instead.
}

function onDragMove(event: PointerEvent) {
  const current = drag.value
  const grid = gridEl.value
  if (!current || !grid) return
  current.clientX = event.clientX
  current.clientY = event.clientY
  current.moved = true

  const rect = grid.getBoundingClientRect()
  const inside = event.clientX >= rect.left - UNIT && event.clientX <= rect.right + UNIT
    && event.clientY >= rect.top - UNIT && event.clientY <= rect.bottom + UNIT
  if (!inside) {
    current.cell = null
    current.valid = false
    return
  }

  const wantedX = Math.round((event.clientX - current.grabX - rect.left) / UNIT)
  const wantedY = Math.round((event.clientY - current.grabY - rect.top) / UNIT)
  const size = rectOf({ length: current.length, vertical: current.vertical, x: 0, y: 0 })
  const clampedX = Math.max(0, Math.min(cols.value - size.w, wantedX))
  const clampedY = Math.max(0, Math.min(rows.value - size.h, wantedY))
  const cell = nearestFit(current.length, current.vertical, clampedX, clampedY, current.rodId)
  current.cell = cell ?? { x: clampedX, y: clampedY }
  current.valid = cell !== null
}

function onDragEnd() {
  const current = drag.value
  cleanupDrag()
  if (!current || !current.moved) return

  if (current.cell && current.valid) {
    if (current.rodId !== null) {
      const rod = rods.value.find(candidate => candidate.id === current.rodId)
      if (rod) {
        rod.x = current.cell.x
        rod.y = current.cell.y
        return
      }
    }
    const rod: Rod = { id: nextId++, length: current.length, vertical: current.vertical, x: current.cell.x, y: current.cell.y }
    rods.value.push(rod)
    selectedRodId.value = rod.id
    return
  }

  // Dropped off the grid: a placed rod goes back to the table.
  if (current.rodId !== null && !current.cell) {
    rods.value = rods.value.filter(rod => rod.id !== current.rodId)
    selectedRodId.value = null
  }
}

function cleanupDrag() {
  drag.value = null
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', cleanupDrag)
}

// ---------------------------------------------------------------- keyboard & edits

function selectedRod(): Rod | null {
  return rods.value.find(rod => rod.id === selectedRodId.value) ?? null
}

function rotateSelected() {
  const rod = selectedRod()
  if (!rod) return
  const turned = { ...rod, vertical: !rod.vertical }
  const cell = nearestFit(turned.length, turned.vertical, turned.x, turned.y, rod.id)
  if (!cell) return
  rod.vertical = turned.vertical
  rod.x = cell.x
  rod.y = cell.y
}

function nudgeSelected(dx: number, dy: number) {
  const rod = selectedRod()
  if (!rod) return
  if (fits({ ...rod, x: rod.x + dx, y: rod.y + dy }, rod.id)) {
    rod.x += dx
    rod.y += dy
  }
}

function removeSelected() {
  if (selectedRodId.value === null) return
  rods.value = rods.value.filter(rod => rod.id !== selectedRodId.value)
  selectedRodId.value = null
}

function placeFromKeyboard(length: number) {
  const anchor = selectedRod()
  const wanted = anchor
    ? { x: anchor.vertical ? anchor.x + 1 : anchor.x + anchor.length, y: anchor.y }
    : { x: 0, y: 0 }
  const cell = nearestFit(length, false, wanted.x, wanted.y, null)
  if (!cell) return
  const rod: Rod = { id: nextId++, length, vertical: false, x: cell.x, y: cell.y }
  rods.value.push(rod)
  selectedRodId.value = rod.id
}

function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

  if (event.key >= '1' && event.key <= '9') placeFromKeyboard(Number(event.key))
  else if (event.key === '0') placeFromKeyboard(10)
  else if (event.key === 'r' || event.key === 'R') rotateSelected()
  else if (event.key === 'Delete' || event.key === 'Backspace') { removeSelected(); event.preventDefault() }
  else if (event.key === 'ArrowLeft') { nudgeSelected(-1, 0); event.preventDefault() }
  else if (event.key === 'ArrowRight') { nudgeSelected(1, 0); event.preventDefault() }
  else if (event.key === 'ArrowUp') { nudgeSelected(0, -1); event.preventDefault() }
  else if (event.key === 'ArrowDown') { nudgeSelected(0, 1); event.preventDefault() }
  else if (event.key === 'Escape') selectedRodId.value = null
}

// ---------------------------------------------------------------- presets

function clearBoard() {
  rods.value = []
  selectedRodId.value = null
}

function loadStaircase() {
  rods.value = Array.from({ length: 10 }, (_, i) => ({
    id: nextId++, length: i + 1, x: 1, y: i + 1, vertical: false,
  }))
  selectedRodId.value = null
}

/** Every length 1 to 10 rebuilt from reds and at most one white, one per row. */
function loadTwosAndOnes() {
  const next: Rod[] = []
  for (let n = 1; n <= 10; n++) {
    let x = 1
    for (let k = 0; k < Math.floor(n / 2); k++) {
      next.push({ id: nextId++, length: 2, x, y: n, vertical: false })
      x += 2
    }
    if (n % 2 === 1) next.push({ id: nextId++, length: 1, x, y: n, vertical: false })
  }
  rods.value = next
  selectedRodId.value = null
}

/** The staircase on the left and its twos-and-ones rebuild beside it. */
function loadStaircaseWithRebuild() {
  loadStaircase()
  const rebuild: Rod[] = []
  for (let n = 1; n <= 10; n++) {
    let x = 14
    for (let k = 0; k < Math.floor(n / 2); k++) {
      rebuild.push({ id: nextId++, length: 2, x, y: n, vertical: false })
      x += 2
    }
    if (n % 2 === 1) rebuild.push({ id: nextId++, length: 1, x, y: n, vertical: false })
  }
  rods.value.push(...rebuild)
}

// ---------------------------------------------------------------- persistence

function encodeHash(): string {
  const items = [...rods.value]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map(rod => `${rod.length}@${rod.x},${rod.y}${rod.vertical ? 'v' : ''}`)
    .join(';')
  return `#c=${cols.value}&r=${rows.value}&u=${unitLines.value ? 1 : 0}&rods=${items}`
}

function decodeHash(hash: string): boolean {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (!params.has('rods')) return false
  cols.value = Number(params.get('c') ?? 36) || 36
  rows.value = Number(params.get('r') ?? 18) || 18
  unitLines.value = params.get('u') !== '0'
  rods.value = (params.get('rods') ?? '').split(';').filter(Boolean).flatMap((token) => {
    const match = /^(\d+)@(-?\d+),(-?\d+)(v?)$/.exec(token)
    if (!match) return []
    const length = Number(match[1])
    if (length < 1 || length > 10) return []
    return [{ id: nextId++, length, x: Number(match[2]), y: Number(match[3]), vertical: match[4] === 'v' }]
  })
  return true
}

function applyJson() {
  jsonError.value = null
  try {
    const parsed = JSON.parse(jsonDraft.value) as {
      cols?: number
      rows?: number
      unitLines?: boolean
      rods?: Array<{ length: number, x: number, y: number, orientation?: string, vertical?: boolean }>
    }
    cols.value = parsed.cols ?? cols.value
    rows.value = parsed.rows ?? rows.value
    if (typeof parsed.unitLines === 'boolean') unitLines.value = parsed.unitLines
    rods.value = (parsed.rods ?? [])
      .filter(rod => rod.length >= 1 && rod.length <= 10)
      .map(rod => ({
        id: nextId++,
        length: rod.length,
        x: rod.x,
        y: rod.y,
        vertical: rod.vertical ?? rod.orientation === 'vertical',
      }))
    selectedRodId.value = null
  } catch (error) {
    jsonError.value = error instanceof Error ? error.message : 'Could not parse JSON.'
  }
}

async function copy(kind: 'json' | 'link') {
  const text = kind === 'json'
    ? boardJson.value
    : `${location.origin}${location.pathname}${encodeHash()}`
  try {
    await navigator.clipboard.writeText(text)
    copied.value = kind
    setTimeout(() => { copied.value = null }, 1500)
  } catch {
    copied.value = null
  }
}

onMounted(() => {
  if (!decodeHash(location.hash)) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored || !decodeHash(stored)) loadStaircaseWithRebuild()
    } catch {
      loadStaircaseWithRebuild()
    }
  }
  jsonDraft.value = boardJson.value
  hydrated.value = true
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  cleanupDrag()
})

// Persist only after the stored or default layout has been applied, so a
// first render never overwrites a saved board with an empty one.
const hydrated = ref(false)
watch([rods, cols, rows, unitLines], () => {
  if (!hydrated.value) return
  jsonDraft.value = boardJson.value
  try { localStorage.setItem(STORAGE_KEY, encodeHash()) } catch { /* convenience only */ }
}, { deep: true })

function rodStyle(rod: Pick<Rod, 'length' | 'x' | 'y' | 'vertical'>) {
  const size = rectOf(rod)
  return {
    left: `${rod.x * UNIT}px`,
    top: `${rod.y * UNIT}px`,
    width: `${size.w * UNIT}px`,
    height: `${size.h * UNIT}px`,
    background: ROD_COLORS[rod.length]!.fill,
    color: ROD_COLORS[rod.length]!.ink,
  }
}
</script>

<template>
  <main class="rod-canvas">
    <nav class="switcher" aria-label="Playgrounds">
      <NuxtLink to="/dev/rod-playground">Lanes</NuxtLink>
      <NuxtLink to="/dev/rod-canvas" class="is-current" aria-current="page">Canvas</NuxtLink>
    </nav>

    <header class="intro">
      <p class="eyebrow">Design surface</p>
      <h1>Rod canvas</h1>
      <p class="lede">
        Drag rods from the supply anywhere on the grid; they snap to cells and never overlap.
        Drag a placed rod to move it, drop it off the grid to remove it. R rotates the selected rod,
        arrows nudge it, Delete removes it, 1 to 9 and 0 place a rod after the selected one.
      </p>
    </header>

    <div class="workspace">
      <aside class="supply" aria-label="Rod supply" data-role="rod-supply">
        <button
          v-for="length in 10"
          :key="length"
          type="button"
          class="rod supply-rod"
          :class="{ 'has-unit-lines': unitLines }"
          :style="{ width: `${length * UNIT}px`, height: `${UNIT}px`, background: ROD_COLORS[length]!.fill, color: ROD_COLORS[length]!.ink }"
          :data-length="length"
          :data-color="rodName(length)"
          :aria-label="`${rodName(length)} rod, length ${length}. Drag onto the grid or press ${length % 10}`"
          @pointerdown="beginDrag($event, length, false, null)"
          @keydown.enter.prevent="placeFromKeyboard(length)"
          @keydown.space.prevent="placeFromKeyboard(length)"
        >
          <span v-if="unitLines" class="units" aria-hidden="true">
            <i v-for="cell in length" :key="cell" :style="{ width: `${UNIT}px` }" />
          </span>
          <span class="rod-label">{{ length }}</span>
        </button>
      </aside>

      <section
        class="board"
        data-role="rod-canvas"
        :data-cols="cols"
        :data-rows="rows"
        :data-unit-lines="unitLines"
        :data-rod-count="rods.length"
        :aria-label="`Rod canvas, ${cols} by ${rows} cells, ${rods.length} rods`"
      >
        <div class="board-scroll">
          <div
            ref="gridEl"
            class="grid"
            :class="{ 'has-grid': gridLines }"
            :style="{ width: `${cols * UNIT}px`, height: `${rows * UNIT}px` }"
          >
            <div
              v-if="drag && drag.cell"
              class="preview"
              :class="{ 'is-invalid': !drag.valid }"
              :style="rodStyle({ length: drag.length, vertical: drag.vertical, x: drag.cell.x, y: drag.cell.y })"
              aria-hidden="true"
            />
            <button
              v-for="rod in rods"
              :key="rod.id"
              type="button"
              class="rod placed"
              :class="{ 'is-selected': rod.id === selectedRodId, 'is-lifted': drag?.rodId === rod.id, 'is-vertical': rod.vertical }"
              :style="rodStyle(rod)"
              data-role="rod"
              :data-length="rod.length"
              :data-color="rodName(rod.length)"
              :data-x="rod.x"
              :data-y="rod.y"
              :data-end-x="rod.x + (rod.vertical ? 1 : rod.length)"
              :data-end-y="rod.y + (rod.vertical ? rod.length : 1)"
              :data-orientation="rod.vertical ? 'vertical' : 'horizontal'"
              :aria-label="`${rodName(rod.length)} rod, length ${rod.length}, ${rod.vertical ? 'vertical' : 'horizontal'} at column ${rod.x} row ${rod.y}`"
              @pointerdown="beginDrag($event, rod.length, rod.vertical, rod.id)"
              @click="selectedRodId = rod.id"
              @dblclick="selectedRodId = rod.id; rotateSelected()"
            >
              <span v-if="unitLines" class="units" :class="{ 'is-vertical': rod.vertical }" aria-hidden="true">
                <i v-for="cell in rod.length" :key="cell" :style="rod.vertical ? { height: `${UNIT}px` } : { width: `${UNIT}px` }" />
              </span>
              <span class="rod-label">{{ rod.length }}</span>
            </button>
          </div>
        </div>

        <div class="board-actions">
          <button type="button" class="ghost" :class="{ 'is-on': gridLines }" @click="gridLines = !gridLines">Grid</button>
          <button type="button" class="ghost" :class="{ 'is-on': unitLines }" @click="unitLines = !unitLines">Unit lines</button>
          <span class="divider" aria-hidden="true" />
          <button type="button" class="ghost" @click="loadStaircase">Staircase 1–10</button>
          <button type="button" class="ghost" @click="loadTwosAndOnes">Twos and ones</button>
          <button type="button" class="ghost" @click="loadStaircaseWithRebuild">Both</button>
          <button type="button" class="ghost" @click="clearBoard">Clear</button>
          <span class="divider" aria-hidden="true" />
          <button type="button" class="ghost" @click="copy('link')">{{ copied === 'link' ? 'Link copied' : 'Copy link' }}</button>
          <button type="button" class="ghost" @click="copy('json')">{{ copied === 'json' ? 'JSON copied' : 'Copy JSON' }}</button>
        </div>
      </section>
    </div>

    <section class="readout" aria-label="Board readout">
      <h2>Readout</h2>
      <pre data-role="board-summary">{{ rowSummaries.join('\n') }}</pre>

      <details>
        <summary>JSON (edit and apply to load a layout)</summary>
        <textarea
          v-model="jsonDraft"
          data-role="board-json"
          rows="16"
          spellcheck="false"
          aria-label="Board JSON"
        />
        <div class="board-actions">
          <button type="button" class="primary" @click="applyJson">Apply JSON</button>
          <span v-if="jsonError" class="error">{{ jsonError }}</span>
        </div>
      </details>
    </section>

    <div
      v-if="drag"
      class="rod ghost-rod"
      :class="{ 'is-invalid': drag.cell !== null && !drag.valid }"
      :style="{
        left: `${drag.clientX - drag.grabX}px`,
        top: `${drag.clientY - drag.grabY}px`,
        width: `${(drag.vertical ? 1 : drag.length) * UNIT}px`,
        height: `${(drag.vertical ? drag.length : 1) * UNIT}px`,
        background: ROD_COLORS[drag.length]!.fill,
        color: ROD_COLORS[drag.length]!.ink,
      }"
      aria-hidden="true"
    >
      <span class="rod-label">{{ drag.length }}</span>
    </div>
  </main>
</template>

<style scoped>
.rod-canvas { max-width: 90rem; margin: 0 auto; padding: 1.5rem 1.5rem 4rem; display: grid; gap: 1rem; }
.switcher { display: flex; gap: .4rem; font: 700 .7rem "JetBrains Mono", monospace; text-transform: uppercase; letter-spacing: .08em; }
.switcher a { padding: .3rem .7rem; border: 1px solid var(--mt-border); border-radius: 999px; color: var(--mt-text-muted); text-decoration: none; }
.switcher a.is-current { border-color: var(--color-primary-500); color: var(--color-primary-500); }
.eyebrow { margin: 0; color: var(--mt-text-muted); font: 700 .68rem "JetBrains Mono", monospace; letter-spacing: .12em; text-transform: uppercase; }
h1 { margin: .25rem 0; font-size: clamp(1.8rem, 4vw, 2.4rem); letter-spacing: -.03em; }
h2 { margin: 0 0 .5rem; font-size: 1rem; }
.lede { max-width: 62rem; margin: 0; color: var(--mt-text-sub); line-height: 1.6; }

.workspace { display: grid; grid-template-columns: auto 1fr; gap: 1rem; align-items: start; }
.supply { display: grid; gap: .45rem; padding: .75rem; border: 1px solid var(--mt-border); border-radius: .9rem; background: var(--mt-bg-elevated); }

.rod {
  position: relative; box-sizing: border-box; padding: 0;
  border: 1px solid rgba(0,0,0,.45); border-radius: 2px;
  font: 700 .85rem "JetBrains Mono", monospace;
  touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab;
  display: grid; place-items: center;
}
.rod:active { cursor: grabbing; }
.units { position: absolute; inset: 0; display: flex; pointer-events: none; }
.units.is-vertical { flex-direction: column; }
.units i { display: block; flex: 0 0 auto; height: 100%; border-right: 1px solid rgba(0,0,0,.28); }
.units.is-vertical i { width: 100%; height: auto; border-right: 0; border-bottom: 1px solid rgba(0,0,0,.28); }
.units i:last-child { border: 0; }
.rod-label { position: relative; z-index: 1; padding: 0 .3rem; }

.board { display: grid; gap: .6rem; padding: .75rem; border: 1px solid var(--mt-border); border-radius: 1rem; background: var(--mt-bg-elevated); min-width: 0; }
.board-scroll { overflow: auto; max-height: 34rem; }
.grid { position: relative; background: var(--mt-bg-inset); }
.grid.has-grid {
  background-image:
    linear-gradient(90deg, color-mix(in srgb, var(--mt-border) 80%, transparent) 1px, transparent 1px),
    linear-gradient(color-mix(in srgb, var(--mt-border) 80%, transparent) 1px, transparent 1px);
  background-size: 28px 28px;
}
.placed { position: absolute; }
.placed.is-selected { outline: 3px solid var(--color-primary-500); outline-offset: 1px; z-index: 2; }
.placed.is-lifted { opacity: .35; }
.preview { position: absolute; border: 2px dashed var(--color-primary-500); border-radius: 2px; background: color-mix(in srgb, var(--color-primary-500) 18%, transparent) !important; z-index: 1; pointer-events: none; }
.preview.is-invalid { border-color: #e5484d; background: color-mix(in srgb, #e5484d 18%, transparent) !important; }

.ghost-rod { position: fixed; z-index: 50; pointer-events: none; opacity: .92; box-shadow: 0 6px 16px rgba(0,0,0,.35); }
.ghost-rod.is-invalid { opacity: .5; }

.board-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
.divider { width: 1px; height: 1.4rem; background: var(--mt-border); }
button.primary, button.ghost { padding: .4rem .8rem; border-radius: .5rem; font: 600 .76rem "JetBrains Mono", monospace; cursor: pointer; }
button.primary { border: 1px solid var(--color-primary-600); background: var(--color-primary-600); color: white; }
button.ghost { border: 1px solid var(--mt-border-strong); background: transparent; color: var(--mt-text-sub); }
button.ghost:hover { background: var(--mt-bg-inset); }
button.ghost.is-on { border-color: var(--color-primary-500); color: var(--color-primary-500); }

.readout { padding: 1rem; border: 1px solid var(--mt-border); border-radius: 1rem; background: var(--mt-bg-elevated); }
pre { margin: 0; white-space: pre-wrap; color: var(--mt-text-sub); font: .78rem "JetBrains Mono", monospace; line-height: 1.6; }
details { margin-top: .75rem; }
summary { cursor: pointer; color: var(--mt-text-muted); font: .74rem "JetBrains Mono", monospace; }
textarea { width: 100%; margin-top: .5rem; padding: .6rem; border: 1px solid var(--mt-border); border-radius: .5rem; background: var(--mt-bg-inset); color: var(--mt-text); font: .74rem "JetBrains Mono", monospace; }
.error { color: #e5484d; font-size: .78rem; }

@media (max-width: 800px) { .workspace { grid-template-columns: 1fr; } .supply { grid-auto-flow: row; } }
</style>
