<script setup lang="ts">
/**
 * Renders a grid scene and the learner's moves on it.
 *
 * The browser owns only position: which pieces sit where, which rows are
 * moved or selected. Every move is posted whole to the server, which answers
 * accepted, rejected, or complete. On rejected, the piece is shown landed,
 * input freezes for half a second, then the move is undone. Nothing here
 * decides whether a move is right.
 */
import type {
  GridPiece,
  GridScene,
  PlacedPiece,
  ScaffoldLastCheck,
  ScaffoldLearnerStep,
  ScaffoldStepEvidence,
  ScaffoldStepSubmission,
} from '#shared/types/scaffolds'
import { CheckOutcomes } from '#shared/types/scaffolds'

const props = defineProps<{
  step: ScaffoldLearnerStep
  scene: GridScene
  evidence: ScaffoldStepEvidence | null
  lastCheck: ScaffoldLastCheck | null
  checking: boolean
  /** Set when the check request itself failed; the pending move is rolled back. */
  error: string | null
}>()

const emit = defineEmits<{
  submit: [submission: ScaffoldStepSubmission]
}>()

const UNIT = 28
const REVERT_MS = 500

const ROD_COLORS: Record<number, { name: string, fill: string, ink: string }> = {
  1: { name: 'white', fill: '#f4f4ef', ink: '#1c1c1c' },
  2: { name: 'red', fill: '#d63c3c', ink: '#ffffff' },
  3: { name: 'light-green', fill: '#7bc95a', ink: '#10240c' },
  4: { name: 'purple', fill: '#8e4fbf', ink: '#ffffff' },
  5: { name: 'yellow', fill: '#f2c94c', ink: '#2a2200' },
  6: { name: 'dark-green', fill: '#2e8b57', ink: '#ffffff' },
  7: { name: 'black', fill: '#242424', ink: '#ffffff' },
  8: { name: 'brown', fill: '#8b5a2b', ink: '#ffffff' },
  9: { name: 'blue', fill: '#2f6fd6', ink: '#1f1200' },
  10: { name: 'orange', fill: '#f28c28', ink: '#1f1200' },
}
const TILE_COLORS = {
  variable: { fill: '#3aa655', ink: '#ffffff' },
  constant: { fill: '#ffd24d', ink: '#2a2200' },
}

interface LocalPiece extends PlacedPiece {
  id: number
}

interface Drag {
  length: number
  pieceId: number | null
  grabX: number
  clientX: number
  clientY: number
  cell: { x: number, y: number } | null
  valid: boolean
  moved: boolean
}

type Pending =
  | { kind: 'piece', id: number, previous: LocalPiece | null }
  | { kind: 'row', row: number, previouslyOn: boolean }

const actionType = computed(() => props.step.action.type)
const allowedLengths = computed<number[]>(() =>
  props.step.action.type === 'placePieces' ? (props.step.action.allowedLengths ?? []).map(Number) : [],
)
const compareColumn = computed(() =>
  props.step.action.type === 'moveRows' ? Number(props.step.action.compareColumn) : 0,
)

const placed = ref<LocalPiece[]>([])
const movedRows = ref<Set<number>>(new Set())
const selectedRows = ref<Set<number>>(new Set())
const frozen = ref(false)
const pending = ref<Pending | null>(null)
const rejectedPieceId = ref<number | null>(null)
const rejectedRow = ref<number | null>(null)
const drag = ref<Drag | null>(null)
const gridEl = ref<HTMLElement | null>(null)
let nextId = 1

const inputLocked = computed(() => frozen.value || props.checking)

const referenceRows = computed(() => {
  const rows = new Map<number, GridPiece[]>()
  for (const piece of props.scene.reference) {
    const y = Number(piece.y)
    rows.set(y, [...(rows.get(y) ?? []), piece])
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([y, pieces]) => ({
      y,
      pieces,
      start: Math.min(...pieces.map(piece => Number(piece.x))),
      end: Math.max(...pieces.map(piece => Number(piece.x) + Number(piece.length))),
    }))
})

const rowsAreClickable = computed(() => actionType.value === 'moveRows' || actionType.value === 'selectRows')

function seedFromEvidence() {
  placed.value = []
  movedRows.value = new Set()
  selectedRows.value = new Set()
  pending.value = null
  rejectedPieceId.value = null
  rejectedRow.value = null
  frozen.value = false
  const evidence = props.evidence
  if (!evidence) return
  if (evidence.type === 'placePieces') {
    placed.value = evidence.pieces.map(piece => ({ id: nextId++, length: Number(piece.length), x: Number(piece.x), y: Number(piece.y) }))
  } else if (evidence.type === 'moveRows') {
    movedRows.value = new Set(evidence.movedRows.map(Number))
  } else if (evidence.type === 'selectRows') {
    selectedRows.value = new Set(evidence.rows.map(Number))
  }
}

watch(() => props.step.id, seedFromEvidence, { immediate: true })

// ---------------------------------------------------------------- outcome and revert

watch(() => props.lastCheck, (check) => {
  const move = pending.value
  if (!check || !move || check.stepId !== props.step.id) return
  if (check.outcome !== CheckOutcomes.Rejected) {
    pending.value = null
    return
  }

  frozen.value = true
  if (move.kind === 'piece') rejectedPieceId.value = move.id
  else rejectedRow.value = move.row

  setTimeout(undoPending, REVERT_MS)
})

function undoPending() {
  const move = pending.value
  if (!move) return
  if (move.kind === 'piece') {
    placed.value = placed.value.filter(piece => piece.id !== move.id)
    if (move.previous) placed.value.push(move.previous)
  } else if (actionType.value === 'moveRows') {
    const next = new Set(movedRows.value)
    move.previouslyOn ? next.add(move.row) : next.delete(move.row)
    movedRows.value = next
  } else {
    const next = new Set(selectedRows.value)
    move.previouslyOn ? next.add(move.row) : next.delete(move.row)
    selectedRows.value = next
  }
  rejectedPieceId.value = null
  rejectedRow.value = null
  pending.value = null
  frozen.value = false
}

// A failed request is not a verdict. Put the move back so the board matches
// the server's last known state and the learner can try again.
watch(() => props.error, (error) => {
  if (error && pending.value) undoPending()
})

function submitPieces() {
  emit('submit', {
    type: 'placePieces',
    pieces: placed.value.map(piece => ({ length: piece.length, x: piece.x, y: piece.y })),
  })
}

// ---------------------------------------------------------------- row clicks

function toggleRow(y: number) {
  if (inputLocked.value || !rowsAreClickable.value || pending.value) return
  if (actionType.value === 'moveRows') {
    const previouslyOn = movedRows.value.has(y)
    const next = new Set(movedRows.value)
    previouslyOn ? next.delete(y) : next.add(y)
    movedRows.value = next
    pending.value = { kind: 'row', row: y, previouslyOn }
    emit('submit', { type: 'moveRows', movedRows: [...next].sort((a, b) => a - b) })
  } else {
    const previouslyOn = selectedRows.value.has(y)
    const next = new Set(selectedRows.value)
    previouslyOn ? next.delete(y) : next.add(y)
    selectedRows.value = next
    pending.value = { kind: 'row', row: y, previouslyOn }
    emit('submit', { type: 'selectRows', rows: [...next].sort((a, b) => a - b) })
  }
}

// ---------------------------------------------------------------- drag and drop

function targetRowAt(y: number) {
  return props.scene.targetRows.find(row => Number(row.y) === y) ?? null
}

function fitsOnRow(length: number, x: number, y: number, ignoreId: number | null): boolean {
  const row = targetRowAt(y)
  if (!row) return false
  const start = Number(row.start)
  const end = start + Number(row.length)
  if (x < start || x + length > end) return false
  return !placed.value.some(piece =>
    piece.id !== ignoreId && piece.y === y && x < piece.x + piece.length && piece.x < x + length,
  )
}

function nearestFit(length: number, x: number, y: number, ignoreId: number | null): number | null {
  for (let delta = 0; delta <= Number(props.scene.cols); delta++) {
    for (const candidate of delta === 0 ? [x] : [x - delta, x + delta]) {
      if (fitsOnRow(length, candidate, y, ignoreId)) return candidate
    }
  }
  return null
}

function beginDrag(event: PointerEvent, length: number, pieceId: number | null) {
  if (event.button !== 0 || inputLocked.value || pending.value || actionType.value !== 'placePieces') return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  drag.value = {
    length,
    pieceId,
    grabX: Math.min(event.clientX - rect.left, length * UNIT - UNIT / 2),
    clientX: event.clientX,
    clientY: event.clientY,
    cell: null,
    valid: false,
    moved: false,
  }
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', cleanupDrag)
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
  const y = Math.floor((event.clientY - rect.top) / UNIT)
  const row = targetRowAt(y)
  if (!row) {
    current.cell = { x: wantedX, y }
    current.valid = false
    return
  }
  const x = nearestFit(current.length, wantedX, y, current.pieceId)
  current.cell = { x: x ?? wantedX, y }
  current.valid = x !== null
}

function onDragEnd() {
  const current = drag.value
  cleanupDrag()
  if (!current || !current.moved) return

  if (current.cell && current.valid) {
    if (current.pieceId !== null) {
      const existing = placed.value.find(piece => piece.id === current.pieceId)
      if (existing) {
        const previous = { ...existing }
        existing.x = current.cell.x
        existing.y = current.cell.y
        pending.value = { kind: 'piece', id: existing.id, previous }
        submitPieces()
      }
      return
    }
    const piece: LocalPiece = { id: nextId++, length: current.length, x: current.cell.x, y: current.cell.y }
    placed.value.push(piece)
    pending.value = { kind: 'piece', id: piece.id, previous: null }
    submitPieces()
    return
  }

  // Dropped off the grid: a placed piece goes back to the supply.
  if (current.pieceId !== null && !current.cell) {
    placed.value = placed.value.filter(piece => piece.id !== current.pieceId)
    submitPieces()
  }
}

function cleanupDrag() {
  drag.value = null
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', cleanupDrag)
}

onBeforeUnmount(cleanupDrag)

// ---------------------------------------------------------------- rendering

function pieceColors(piece: Pick<GridPiece, 'kind' | 'length'>) {
  if (piece.kind === 'variable') return TILE_COLORS.variable
  if (piece.kind === 'constant') return TILE_COLORS.constant
  return ROD_COLORS[Number(piece.length)] ?? { fill: '#888', ink: '#fff' }
}

function pieceLabel(piece: GridPiece): string {
  if (piece.kind === 'variable') return piece.symbol ?? 'n'
  if (piece.kind === 'constant') return '+1'
  return String(piece.length)
}

function referenceStyle(piece: GridPiece) {
  const y = Number(piece.y)
  const shift = movedRows.value.has(y) ? compareColumn.value - rowStart(y) : 0
  const colors = pieceColors(piece)
  return {
    left: `${(Number(piece.x) + shift) * UNIT}px`,
    top: `${y * UNIT}px`,
    width: `${Number(piece.length) * UNIT}px`,
    height: `${UNIT}px`,
    background: colors.fill,
    color: colors.ink,
  }
}

function rowStart(y: number): number {
  return referenceRows.value.find(row => row.y === y)?.start ?? 0
}

function placedStyle(piece: PlacedPiece) {
  const colors = ROD_COLORS[piece.length] ?? { fill: '#888', ink: '#fff' }
  return {
    left: `${piece.x * UNIT}px`,
    top: `${piece.y * UNIT}px`,
    width: `${piece.length * UNIT}px`,
    height: `${UNIT}px`,
    background: colors.fill,
    color: colors.ink,
  }
}

const gridStyle = computed(() => ({
  width: `${Number(props.scene.cols) * UNIT}px`,
  height: `${Number(props.scene.rows) * UNIT}px`,
}))

const boardDescription = computed(() => {
  if (actionType.value === 'placePieces') return `${placed.value.length} pieces placed`
  if (actionType.value === 'moveRows') return `${movedRows.value.size} rows moved`
  return `${selectedRows.value.size} rows selected`
})
</script>

<template>
  <section
    class="grid-board"
    :class="{ 'is-locked': inputLocked }"
    :data-step-id="step.id"
    :data-action-type="actionType"
    :aria-label="`Rod grid, ${boardDescription}`"
  >
    <div v-if="actionType === 'placePieces'" class="supply" aria-label="Piece supply">
      <span class="supply-label">Drag onto a rod</span>
      <button
        v-for="length in allowedLengths"
        :key="length"
        type="button"
        class="piece supply-piece"
        :style="{ width: `${length * UNIT}px`, height: `${UNIT}px`, background: ROD_COLORS[length]?.fill, color: ROD_COLORS[length]?.ink }"
        :disabled="inputLocked"
        :aria-label="`${ROD_COLORS[length]?.name ?? length} rod, length ${length}`"
        :data-length="length"
        @pointerdown="beginDrag($event, length, null)"
      >
        <span v-if="scene.unitLines" class="units" aria-hidden="true">
          <i v-for="cell in length" :key="cell" :style="{ width: `${UNIT}px` }" />
        </span>
        <span class="piece-label">{{ length }}</span>
      </button>
    </div>

    <div class="grid-scroll">
      <div
        ref="gridEl"
        class="grid"
        :class="{ 'has-unit-lines': scene.unitLines }"
        :style="gridStyle"
      >
        <div
          v-for="row in scene.targetRows"
          :key="`target-${row.y}`"
          class="target-row"
          :class="{ 'is-target': drag?.cell?.y === Number(row.y) }"
          :style="{ left: `${Number(row.start) * UNIT}px`, top: `${Number(row.y) * UNIT}px`, width: `${Number(row.length) * UNIT}px`, height: `${UNIT}px` }"
          aria-hidden="true"
        />

        <div
          v-for="piece in scene.reference"
          :key="`ref-${piece.x}-${piece.y}`"
          class="piece reference"
          :class="{ 'is-moved': movedRows.has(Number(piece.y)), 'is-selected': selectedRows.has(Number(piece.y)), 'is-rejected': rejectedRow === Number(piece.y) }"
          :style="referenceStyle(piece)"
          data-role="reference"
          :data-kind="piece.kind"
          :data-length="piece.length"
          :data-x="piece.x"
          :data-y="piece.y"
        >
          <span v-if="scene.unitLines && piece.kind === 'rod'" class="units" aria-hidden="true">
            <i v-for="cell in Number(piece.length)" :key="cell" :style="{ width: `${UNIT}px` }" />
          </span>
          <span class="piece-label">{{ pieceLabel(piece) }}</span>
        </div>

        <button
          v-for="row in rowsAreClickable ? referenceRows : []"
          :key="`row-${row.y}`"
          type="button"
          class="row-hit"
          :class="{ 'is-on': movedRows.has(row.y) || selectedRows.has(row.y) }"
          :style="{ left: `${(movedRows.has(row.y) ? compareColumn : row.start) * UNIT}px`, top: `${row.y * UNIT}px`, width: `${(row.end - row.start) * UNIT}px`, height: `${UNIT}px` }"
          :disabled="inputLocked"
          :data-row="row.y"
          :aria-pressed="movedRows.has(row.y) || selectedRows.has(row.y)"
          :aria-label="`Row ${row.y}`"
          @click="toggleRow(row.y)"
        />

        <button
          v-for="piece in placed"
          :key="piece.id"
          type="button"
          class="piece placed"
          :class="{ 'is-rejected': rejectedPieceId === piece.id, 'is-lifted': drag?.pieceId === piece.id }"
          :style="placedStyle(piece)"
          :disabled="inputLocked"
          data-role="placed"
          :data-length="piece.length"
          :data-x="piece.x"
          :data-y="piece.y"
          :aria-label="`${ROD_COLORS[piece.length]?.name ?? piece.length} rod at column ${piece.x} row ${piece.y}`"
          @pointerdown="beginDrag($event, piece.length, piece.id)"
        >
          <span v-if="scene.unitLines" class="units" aria-hidden="true">
            <i v-for="cell in piece.length" :key="cell" :style="{ width: `${UNIT}px` }" />
          </span>
          <span class="piece-label">{{ piece.length }}</span>
        </button>

        <div
          v-if="drag && drag.cell"
          class="preview"
          :class="{ 'is-invalid': !drag.valid }"
          :style="{ left: `${drag.cell.x * UNIT}px`, top: `${drag.cell.y * UNIT}px`, width: `${drag.length * UNIT}px`, height: `${UNIT}px` }"
          aria-hidden="true"
        />
      </div>
    </div>

    <p class="status" aria-live="polite">
      <template v-if="frozen">That piece does not follow the rule. Putting it back.</template>
      <template v-else-if="checking">Checking…</template>
      <template v-else-if="actionType === 'placePieces'">Every drop is checked. A piece that breaks the rule comes back.</template>
      <template v-else-if="actionType === 'moveRows'">Click a row to move it. Click again to bring it back.</template>
      <template v-else>Click a row to select it.</template>
    </p>

    <div
      v-if="drag"
      class="piece ghost"
      :class="{ 'is-invalid': drag.cell !== null && !drag.valid }"
      :style="{ left: `${drag.clientX - drag.grabX}px`, top: `${drag.clientY - UNIT / 2}px`, width: `${drag.length * UNIT}px`, height: `${UNIT}px`, background: ROD_COLORS[drag.length]?.fill, color: ROD_COLORS[drag.length]?.ink }"
      aria-hidden="true"
    >
      <span class="piece-label">{{ drag.length }}</span>
    </div>
  </section>
</template>

<style scoped>
.grid-board { display: grid; gap: .75rem; padding: 1rem; border: 1px solid var(--mt-border); border-radius: 1.1rem; background: var(--mt-bg-elevated); box-shadow: var(--mt-shadow-sm); }
.grid-board.is-locked .grid { cursor: wait; }

.supply { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem; }
.supply-label { color: var(--mt-text-muted); font: 700 .68rem "JetBrains Mono", monospace; letter-spacing: .08em; text-transform: uppercase; }

.piece {
  position: relative; box-sizing: border-box; padding: 0;
  border: 1px solid rgba(0,0,0,.45); border-radius: 2px;
  font: 700 .85rem "JetBrains Mono", monospace;
  display: grid; place-items: center;
  touch-action: none; user-select: none; -webkit-user-select: none;
}
.supply-piece, .placed { cursor: grab; }
.supply-piece:disabled, .placed:disabled { cursor: not-allowed; }
.units { position: absolute; inset: 0; display: flex; pointer-events: none; }
.units i { display: block; flex: 0 0 auto; height: 100%; border-right: 1px solid rgba(0,0,0,.28); }
.units i:last-child { border: 0; }
.piece-label { position: relative; z-index: 1; padding: 0 .3rem; }

.grid-scroll { overflow: auto; max-height: 30rem; }
.grid { position: relative; background: var(--mt-bg-inset); }
.grid.has-unit-lines {
  background-image:
    linear-gradient(90deg, color-mix(in srgb, var(--mt-border) 80%, transparent) 1px, transparent 1px),
    linear-gradient(color-mix(in srgb, var(--mt-border) 80%, transparent) 1px, transparent 1px);
  background-size: 28px 28px;
}
.target-row { position: absolute; border: 2px dashed color-mix(in srgb, var(--mt-text-muted) 45%, transparent); border-radius: 3px; pointer-events: none; }
.target-row.is-target { border-color: var(--color-primary-500); }
.reference { position: absolute; transition: left 260ms ease; }
.reference.is-selected { outline: 3px solid var(--color-primary-500); outline-offset: 1px; z-index: 2; }
.reference.is-rejected, .placed.is-rejected { outline: 3px solid #e5484d; outline-offset: 1px; animation: shake 220ms ease; z-index: 3; }
.row-hit { position: absolute; z-index: 4; background: transparent; border: 0; border-radius: 3px; cursor: pointer; transition: left 260ms ease; }
.row-hit:hover:not(:disabled) { outline: 2px solid color-mix(in srgb, var(--color-primary-500) 50%, transparent); }
.placed { position: absolute; z-index: 3; }
.placed.is-lifted { opacity: .35; }
.preview { position: absolute; z-index: 5; border: 2px dashed var(--color-primary-500); border-radius: 2px; background: color-mix(in srgb, var(--color-primary-500) 18%, transparent); pointer-events: none; }
.preview.is-invalid { border-color: #e5484d; background: color-mix(in srgb, #e5484d 18%, transparent); }
.ghost { position: fixed; z-index: 50; pointer-events: none; opacity: .92; box-shadow: 0 6px 16px rgba(0,0,0,.35); }
.ghost.is-invalid { opacity: .5; }

.status { margin: 0; color: var(--mt-text-muted); font-size: .78rem; }

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  30% { transform: translateX(-4px); }
  60% { transform: translateX(4px); }
}
@media (prefers-reduced-motion: reduce) { .reference, .row-hit { transition: none; } .is-rejected { animation: none; } }
</style>
