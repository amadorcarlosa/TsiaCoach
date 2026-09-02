<script setup lang="ts">
/**
 * Cuisenaire rod playground.
 *
 * A design surface modelled on the physical MathTabla board: one ruler,
 * several lanes, rods dragged onto the lanes and snapped to whole units,
 * and vertical markers laid across the lanes. Alongside the ten rods there
 * are algebra-tile pieces: a variable tile (n) with no fixed length, and a
 * constant +1 tile. The DOM carries the whole arrangement as data attributes
 * and ARIA labels, so selecting the board element (or copying the JSON /
 * link) hands the exact picture over.
 */

type PieceKind = 'rod' | 'variable' | 'constant'

interface Rod {
  id: number
  kind: PieceKind
  /** Visual length in units. For a variable tile this is only how wide it is drawn. */
  length: number
  start: number
  symbol?: string
}

interface Track {
  id: number
  label: string
  rods: Rod[]
}

interface Drag {
  kind: PieceKind
  symbol?: string
  length: number
  fromTrackId: number | null
  rodId: number | null
  grabOffsetPx: number
  x: number
  y: number
  overTrackId: number | null
  snappedStart: number | null
  valid: boolean
  /** Set once the pointer has travelled; a still click never drops or removes. */
  moved: boolean
}

const UNIT = 28
const LANE_SLACK_PX = 22
const VARIABLE_UNITS = 4
const STORAGE_KEY = 'tsia-rod-playground-v3'

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

const TILE_COLORS: Record<'variable' | 'constant', { fill: string, ink: string }> = {
  variable: { fill: '#3aa655', ink: '#ffffff' },
  constant: { fill: '#ffd24d', ink: '#2a2200' },
}

const boardUnits = ref(40)
const tracks = ref<Track[]>([])
const markers = ref<number[]>([])
const activeTrackId = ref<number | null>(null)
const selectedRodId = ref<number | null>(null)
const drag = ref<Drag | null>(null)
const jsonDraft = ref('')
const jsonError = ref<string | null>(null)
const copied = ref<string | null>(null)
const hydrated = ref(false)
const laneEls = new Map<number, HTMLElement>()
let nextId = 1

type PieceLike = Pick<Rod, 'kind' | 'length' | 'symbol'>

function rodName(length: number): string {
  return ROD_COLORS[length]?.name ?? `length-${length}`
}

function pieceName(piece: PieceLike): string {
  if (piece.kind === 'variable') return `variable ${piece.symbol ?? 'n'}`
  if (piece.kind === 'constant') return 'constant +1'
  return `${rodName(piece.length)} ${piece.length}`
}

function pieceLabel(piece: PieceLike): string {
  if (piece.kind === 'variable') return piece.symbol ?? 'n'
  if (piece.kind === 'constant') return '+1'
  return String(piece.length)
}

function pieceColors(piece: PieceLike): { fill: string, ink: string } {
  if (piece.kind === 'variable') return TILE_COLORS.variable
  if (piece.kind === 'constant') return TILE_COLORS.constant
  return ROD_COLORS[piece.length] ?? { fill: '#888', ink: '#fff' }
}

function pieceStyle(piece: PieceLike & { start?: number }) {
  const colors = pieceColors(piece)
  return {
    left: `${(piece.start ?? 0) * UNIT}px`,
    width: `${piece.length * UNIT - 2}px`,
    background: colors.fill,
    color: colors.ink,
  }
}

function tokenOf(rod: Rod): string {
  if (rod.kind === 'variable') return `${rod.symbol ?? 'n'}@${rod.start}`
  if (rod.kind === 'constant') return `c@${rod.start}`
  return `${rod.length}@${rod.start}`
}

function pieceFromToken(token: string): Omit<Rod, 'id'> | null {
  const [head, startText] = token.split('@')
  const start = Number(startText ?? 0)
  if (!head || Number.isNaN(start)) return null
  if (head === 'c') return { kind: 'constant', length: 1, start }
  if (/^\d+$/.test(head)) {
    const length = Number(head)
    return length >= 1 && length <= 10 ? { kind: 'rod', length, start } : null
  }
  if (/^[a-z]$/i.test(head)) return { kind: 'variable', symbol: head, length: VARIABLE_UNITS, start }
  return null
}

function defaultLayout() {
  tracks.value = [
    { id: nextId++, label: 'seven', rods: train(0, [2, 2, 2, 1]) },
    { id: nextId++, label: 'eight', rods: train(0, [2, 2, 2, 2]) },
    { id: nextId++, label: '', rods: [] },
    { id: nextId++, label: '', rods: [] },
  ]
  markers.value = []
  boardUnits.value = 40
}

function train(start: number, lengths: number[]): Rod[] {
  let cursor = start
  return lengths.map((length) => {
    const rod: Rod = { id: nextId++, kind: 'rod', length, start: cursor }
    cursor += length
    return rod
  })
}

function sorted(track: Track): Rod[] {
  return [...track.rods].sort((a, b) => a.start - b.start)
}

function extent(track: Track): number {
  return track.rods.reduce((max, rod) => Math.max(max, rod.start + rod.length), 0)
}

function total(track: Track): number {
  return track.rods.reduce((sum, rod) => sum + rod.length, 0)
}

/** The lane read as an expression: variable tiles by symbol, rods and constants as a number. */
function expression(track: Track): string {
  const coefficients = new Map<string, number>()
  let number = 0
  for (const rod of track.rods) {
    if (rod.kind === 'variable') {
      const symbol = rod.symbol ?? 'n'
      coefficients.set(symbol, (coefficients.get(symbol) ?? 0) + 1)
    } else {
      number += rod.length
    }
  }
  const terms = [...coefficients.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([symbol, count]) => (count === 1 ? symbol : `${count}${symbol}`))
  if (number > 0 || terms.length === 0) terms.push(String(number))
  return terms.join(' + ')
}

function fits(track: Track, start: number, length: number, ignoreRodId: number | null): boolean {
  if (start < 0 || start + length > boardUnits.value) return false
  return !track.rods.some(rod =>
    rod.id !== ignoreRodId && start < rod.start + rod.length && rod.start < start + length,
  )
}

function nearestFit(track: Track, wanted: number, length: number, ignoreRodId: number | null): number | null {
  for (let delta = 0; delta <= boardUnits.value; delta++) {
    for (const candidate of delta === 0 ? [wanted] : [wanted - delta, wanted + delta]) {
      if (fits(track, candidate, length, ignoreRodId)) return candidate
    }
  }
  return null
}

function describe(track: Track): string {
  const rods = sorted(track)
  if (rods.length === 0) return `${track.label || 'untitled'}: empty`
  const parts: string[] = []
  let cursor = 0
  for (const rod of rods) {
    if (rod.start > cursor) parts.push(`gap [${cursor}–${rod.start}]`)
    parts.push(`${pieceName(rod)} [${rod.start}–${rod.start + rod.length}]`)
    cursor = rod.start + rod.length
  }
  return `${track.label || 'untitled'}: ${parts.join(', ')} · reads ${expression(track)}, ends at ${extent(track)}`
}

const ticks = computed(() => Array.from({ length: boardUnits.value + 1 }, (_, i) => i))
const boardWidth = computed(() => boardUnits.value * UNIT)

const summaryLines = computed(() => [
  ...tracks.value.map((track, index) => `Track ${index + 1} ${describe(track)}`),
  markers.value.length > 0 ? `Markers at ${[...markers.value].sort((a, b) => a - b).join(', ')}` : 'No markers',
])

const boardJson = computed(() => JSON.stringify({
  units: boardUnits.value,
  markers: [...markers.value].sort((a, b) => a - b),
  tracks: tracks.value.map((track, index) => ({
    index: index + 1,
    label: track.label,
    rods: sorted(track).map(rod => ({
      kind: rod.kind,
      ...(rod.kind === 'variable' ? { symbol: rod.symbol ?? 'n' } : {}),
      length: rod.length,
      color: rod.kind === 'rod' ? rodName(rod.length) : rod.kind,
      start: rod.start,
      end: rod.start + rod.length,
    })),
    expression: expression(track),
    total: total(track),
    extent: extent(track),
  })),
}, null, 2))

const dragPiece = computed<PieceLike | null>(() =>
  drag.value ? { kind: drag.value.kind, length: drag.value.length, symbol: drag.value.symbol } : null,
)

function trackById(id: number | null): Track | null {
  return tracks.value.find(track => track.id === id) ?? null
}

function setLaneRef(trackId: number, el: unknown) {
  if (el instanceof HTMLElement) laneEls.set(trackId, el)
  else laneEls.delete(trackId)
}

// ---------------------------------------------------------------- pointer drag

function beginDrag(
  event: PointerEvent,
  piece: PieceLike,
  fromTrackId: number | null,
  rodId: number | null,
) {
  if (event.button !== 0) return
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const grabOffsetPx = fromTrackId === null
    ? Math.min(event.clientX - rect.left, piece.length * UNIT - UNIT / 2)
    : event.clientX - rect.left
  drag.value = {
    kind: piece.kind,
    symbol: piece.symbol,
    length: piece.length,
    fromTrackId,
    rodId,
    grabOffsetPx,
    x: event.clientX,
    y: event.clientY,
    overTrackId: null,
    snappedStart: null,
    valid: false,
    moved: false,
  }
  if (rodId !== null) selectedRodId.value = rodId
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', onDragCancel)
  // No preventDefault here: it would suppress the click that selects.
  // Text selection is blocked in CSS instead.
}

function onDragMove(event: PointerEvent) {
  const current = drag.value
  if (!current) return
  current.x = event.clientX
  current.y = event.clientY
  current.moved = true

  let best: { trackId: number, distance: number, rect: DOMRect } | null = null
  for (const [trackId, el] of laneEls) {
    const rect = el.getBoundingClientRect()
    const distance = event.clientY < rect.top
      ? rect.top - event.clientY
      : event.clientY > rect.bottom ? event.clientY - rect.bottom : 0
    if (distance <= LANE_SLACK_PX && (!best || distance < best.distance)) {
      best = { trackId, distance, rect }
    }
  }

  if (!best) {
    current.overTrackId = null
    current.snappedStart = null
    current.valid = false
    return
  }

  const track = trackById(best.trackId)!
  const wanted = Math.round((event.clientX - current.grabOffsetPx - best.rect.left) / UNIT)
  const clamped = Math.max(0, Math.min(boardUnits.value - current.length, wanted))
  const start = nearestFit(track, clamped, current.length, current.rodId)
  current.overTrackId = best.trackId
  current.snappedStart = start
  current.valid = start !== null
}

function onDragEnd() {
  const current = drag.value
  cleanupDrag()
  if (!current || !current.moved) return

  const origin = trackById(current.fromTrackId)
  const target = trackById(current.overTrackId)

  if (target && current.valid && current.snappedStart !== null) {
    if (origin && current.rodId !== null) {
      origin.rods = origin.rods.filter(rod => rod.id !== current.rodId)
    }
    const id = current.rodId ?? nextId++
    target.rods.push({
      id,
      kind: current.kind,
      symbol: current.symbol,
      length: current.length,
      start: current.snappedStart,
    })
    activeTrackId.value = target.id
    selectedRodId.value = id
    return
  }

  // Dropped back on the table: a placed piece leaves the board.
  if (origin && current.rodId !== null && !target) {
    origin.rods = origin.rods.filter(rod => rod.id !== current.rodId)
    selectedRodId.value = null
  }
}

function onDragCancel() {
  cleanupDrag()
}

function cleanupDrag() {
  drag.value = null
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragCancel)
}

// ---------------------------------------------------------------- keyboard

function appendPiece(piece: PieceLike) {
  const track = trackById(activeTrackId.value) ?? tracks.value[0] ?? null
  if (!track) return
  const start = nearestFit(track, extent(track), piece.length, null)
  if (start === null) return
  const rod: Rod = { id: nextId++, kind: piece.kind, symbol: piece.symbol, length: piece.length, start }
  track.rods.push(rod)
  activeTrackId.value = track.id
  selectedRodId.value = rod.id
}

function rodPiece(length: number): PieceLike {
  return { kind: 'rod', length }
}

const variablePiece: PieceLike = { kind: 'variable', symbol: 'n', length: VARIABLE_UNITS }
const constantPiece: PieceLike = { kind: 'constant', length: 1 }

function selectedRod(): { track: Track, rod: Rod } | null {
  for (const track of tracks.value) {
    const rod = track.rods.find(candidate => candidate.id === selectedRodId.value)
    if (rod) return { track, rod }
  }
  return null
}

function nudgeSelected(delta: number) {
  const found = selectedRod()
  if (!found) return
  const next = found.rod.start + delta
  if (fits(found.track, next, found.rod.length, found.rod.id)) found.rod.start = next
}

function removeSelected() {
  const found = selectedRod()
  if (!found) return
  found.track.rods = found.track.rods.filter(rod => rod.id !== found.rod.id)
  selectedRodId.value = null
}

function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

  if (event.key >= '1' && event.key <= '9') appendPiece(rodPiece(Number(event.key)))
  else if (event.key === '0') appendPiece(rodPiece(10))
  else if (event.key === 'n' || event.key === 'N') appendPiece(variablePiece)
  else if (event.key === 'c' || event.key === 'C' || event.key === '+') appendPiece(constantPiece)
  else if (event.key === 'Delete' || event.key === 'Backspace') { removeSelected(); event.preventDefault() }
  else if (event.key === 'ArrowLeft') { nudgeSelected(-1); event.preventDefault() }
  else if (event.key === 'ArrowRight') { nudgeSelected(1); event.preventDefault() }
  else if (event.key === 'Escape') selectedRodId.value = null
}

// ---------------------------------------------------------------- tracks & markers

function addTrack() {
  const track: Track = { id: nextId++, label: '', rods: [] }
  tracks.value.push(track)
  activeTrackId.value = track.id
}

function removeTrack(id: number) {
  laneEls.delete(id)
  tracks.value = tracks.value.filter(track => track.id !== id)
  if (activeTrackId.value === id) activeTrackId.value = tracks.value[0]?.id ?? null
}

function clearTrack(track: Track) {
  track.rods = []
}

function toggleMarker(at: number) {
  markers.value = markers.value.includes(at)
    ? markers.value.filter(marker => marker !== at)
    : [...markers.value, at]
}

function widen(by: number) {
  boardUnits.value = Math.max(10, Math.min(120, boardUnits.value + by))
}

// ---------------------------------------------------------------- persistence

function encodeHash(): string {
  const t = tracks.value
    .map(track => `${encodeURIComponent(track.label)}|${sorted(track).map(tokenOf).join(',')}`)
    .join(';')
  return `#u=${boardUnits.value}&m=${markers.value.join(',')}&t=${t}`
}

function decodeHash(hash: string): boolean {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (!params.has('t')) return false
  boardUnits.value = Number(params.get('u') ?? 40) || 40
  markers.value = (params.get('m') ?? '').split(',').filter(Boolean).map(Number)
  tracks.value = (params.get('t') ?? '').split(';').filter(chunk => chunk !== '').map((chunk) => {
    const [label = '', rods = ''] = chunk.split('|')
    return {
      id: nextId++,
      label: decodeURIComponent(label),
      rods: rods.split(',').filter(Boolean).flatMap((token) => {
        const piece = pieceFromToken(token)
        return piece ? [{ id: nextId++, ...piece }] : []
      }),
    }
  })
  return tracks.value.length > 0
}

interface JsonRod {
  kind?: PieceKind
  symbol?: string
  length?: number
  start?: number
}

function applyJson() {
  jsonError.value = null
  try {
    const parsed = JSON.parse(jsonDraft.value) as {
      units?: number
      markers?: number[]
      tracks?: Array<{ label?: string, rods?: Array<number | JsonRod> }>
    }
    boardUnits.value = parsed.units ?? boardUnits.value
    markers.value = parsed.markers ?? []
    tracks.value = (parsed.tracks ?? []).map((track) => {
      let cursor = 0
      const rods: Rod[] = []
      for (const item of track.rods ?? []) {
        const raw: JsonRod = typeof item === 'number' ? { length: item } : item
        const kind: PieceKind = raw.kind ?? 'rod'
        const length = kind === 'variable' ? VARIABLE_UNITS : kind === 'constant' ? 1 : (raw.length ?? 0)
        const start = raw.start ?? cursor
        if (kind === 'rod' && (length < 1 || length > 10)) continue
        rods.push({ id: nextId++, kind, symbol: kind === 'variable' ? raw.symbol ?? 'n' : undefined, length, start })
        cursor = start + length
      }
      return { id: nextId++, label: track.label ?? '', rods }
    })
    activeTrackId.value = tracks.value[0]?.id ?? null
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

function reset() {
  defaultLayout()
  activeTrackId.value = tracks.value[0]?.id ?? null
  selectedRodId.value = null
}

onMounted(() => {
  if (!decodeHash(location.hash)) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored || !decodeHash(stored)) defaultLayout()
    } catch {
      defaultLayout()
    }
  }
  activeTrackId.value = tracks.value[0]?.id ?? null
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
watch([tracks, markers, boardUnits], () => {
  if (!hydrated.value) return
  jsonDraft.value = boardJson.value
  try { localStorage.setItem(STORAGE_KEY, encodeHash()) } catch { /* convenience only */ }
}, { deep: true })
</script>

<template>
  <main class="rod-playground">
    <nav class="switcher" aria-label="Playgrounds">
      <NuxtLink to="/dev/rod-playground" class="is-current" aria-current="page">Lanes</NuxtLink>
      <NuxtLink to="/dev/rod-canvas">Canvas</NuxtLink>
    </nav>

    <header class="intro">
      <p class="eyebrow">Design surface</p>
      <h1>Rod playground</h1>
      <p class="lede">
        Drag a rod from the supply onto any lane; it snaps to whole units and will not overlap.
        Drag a placed piece to move it, or drop it off the board to remove it. Click a ruler number to lay a marker across the lanes.
        The green n is a variable tile with no fixed length; the yellow +1 is a constant. A lane reads as an expression.
        Keys: 1 to 9 and 0 append a rod, N a variable, C a constant, arrows nudge the selected piece, Delete removes it.
      </p>
    </header>

    <section class="supply" aria-label="Piece supply" data-role="rod-supply">
      <button
        v-for="length in 10"
        :key="length"
        type="button"
        class="supply-rod"
        :style="{ width: `${length * UNIT}px`, background: ROD_COLORS[length]!.fill, color: ROD_COLORS[length]!.ink }"
        data-kind="rod"
        :data-length="length"
        :data-color="rodName(length)"
        :aria-label="`${rodName(length)} rod, length ${length}. Drag onto a lane or press ${length % 10}`"
        @pointerdown="beginDrag($event, rodPiece(length), null, null)"
        @keydown.enter.prevent="appendPiece(rodPiece(length))"
        @keydown.space.prevent="appendPiece(rodPiece(length))"
      >
        {{ length }}
      </button>
      <span class="supply-divider" aria-hidden="true" />
      <button
        type="button"
        class="supply-rod is-tile"
        :style="{ width: `${VARIABLE_UNITS * UNIT}px`, background: TILE_COLORS.variable.fill, color: TILE_COLORS.variable.ink }"
        data-kind="variable"
        data-symbol="n"
        aria-label="Variable tile n, no fixed length. Drag onto a lane or press N"
        @pointerdown="beginDrag($event, variablePiece, null, null)"
        @keydown.enter.prevent="appendPiece(variablePiece)"
        @keydown.space.prevent="appendPiece(variablePiece)"
      >
        n
      </button>
      <button
        type="button"
        class="supply-rod is-tile"
        :style="{ width: `${UNIT}px`, background: TILE_COLORS.constant.fill, color: TILE_COLORS.constant.ink }"
        data-kind="constant"
        aria-label="Constant tile +1. Drag onto a lane or press C"
        @pointerdown="beginDrag($event, constantPiece, null, null)"
        @keydown.enter.prevent="appendPiece(constantPiece)"
        @keydown.space.prevent="appendPiece(constantPiece)"
      >
        +1
      </button>
    </section>

    <section
      class="board"
      data-role="rod-board"
      :data-units="boardUnits"
      :data-track-count="tracks.length"
      :data-markers="[...markers].sort((a, b) => a - b).join(',')"
      :aria-label="`Rod board, ${boardUnits} units, ${tracks.length} lanes`"
    >
      <div class="board-scroll">
        <div class="board-inner" :style="{ width: `${boardWidth + 12}px` }">
          <div class="ruler" :style="{ width: `${boardWidth}px` }">
            <button
              v-for="tick in ticks"
              :key="tick"
              type="button"
              class="tick"
              :class="{ 'is-major': tick % 10 === 0, 'is-marked': markers.includes(tick) }"
              :style="{ left: `${tick * UNIT}px` }"
              :aria-label="`Ruler ${tick}. ${markers.includes(tick) ? 'Remove marker' : 'Lay marker'}`"
              @click="toggleMarker(tick)"
            >
              <span v-if="tick % 5 === 0" class="tick-label">{{ tick }}</span>
            </button>
          </div>

          <div class="lanes">
            <div
              v-for="marker in markers"
              :key="`marker-${marker}`"
              class="marker"
              data-role="marker"
              :data-at="marker"
              :style="{ left: `${marker * UNIT}px` }"
              :aria-label="`Marker at ${marker}`"
            />

            <div
              v-for="(track, index) in tracks"
              :key="track.id"
              class="track"
              :class="{ 'is-active': track.id === activeTrackId, 'is-target': drag?.overTrackId === track.id }"
              data-role="track"
              :data-track-index="index + 1"
              :data-label="track.label"
              :data-rods="sorted(track).map(tokenOf).join(',')"
              :data-expression="expression(track)"
              :data-total-length="total(track)"
              :data-extent="extent(track)"
              :aria-label="`Lane ${index + 1} ${describe(track)}`"
              @pointerdown="activeTrackId = track.id"
            >
              <div
                :ref="el => setLaneRef(track.id, el)"
                class="lane"
                :style="{ width: `${boardWidth}px` }"
              >
                <div
                  v-if="drag && drag.overTrackId === track.id && drag.snappedStart !== null"
                  class="preview"
                  :class="{ 'is-invalid': !drag.valid }"
                  :style="{ left: `${drag.snappedStart * UNIT}px`, width: `${drag.length * UNIT - 2}px` }"
                  aria-hidden="true"
                />
                <button
                  v-for="rod in track.rods"
                  :key="rod.id"
                  type="button"
                  class="rod"
                  :class="{ 'is-selected': rod.id === selectedRodId, 'is-lifted': drag?.rodId === rod.id, 'is-tile': rod.kind !== 'rod' }"
                  :style="pieceStyle(rod)"
                  data-role="rod"
                  :data-kind="rod.kind"
                  :data-symbol="rod.symbol ?? ''"
                  :data-length="rod.length"
                  :data-color="rod.kind === 'rod' ? rodName(rod.length) : rod.kind"
                  :data-start="rod.start"
                  :data-end="rod.start + rod.length"
                  :aria-label="`${pieceName(rod)}, from ${rod.start} to ${rod.start + rod.length}`"
                  @pointerdown.stop="beginDrag($event, rod, track.id, rod.id)"
                  @click.stop="selectedRodId = rod.id; activeTrackId = track.id"
                >
                  {{ pieceLabel(rod) }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="lane-labels">
        <div v-for="(track, index) in tracks" :key="track.id" class="lane-label-row">
          <span class="lane-index">L{{ index + 1 }}</span>
          <input
            v-model="track.label"
            class="track-label"
            type="text"
            placeholder="label"
            :aria-label="`Lane ${index + 1} label`"
          >
          <span class="lane-total" aria-hidden="true">reads {{ expression(track) }} · ends {{ extent(track) }}</span>
          <button type="button" class="ghost" @click="clearTrack(track)">clear</button>
          <button type="button" class="ghost" @click="removeTrack(track.id)">remove</button>
        </div>
      </div>

      <div class="board-actions">
        <button type="button" class="primary" @click="addTrack">Add lane</button>
        <button type="button" class="ghost" @click="widen(10)">Wider ruler</button>
        <button type="button" class="ghost" @click="widen(-10)">Narrower ruler</button>
        <button type="button" class="ghost" @click="reset">Reset example</button>
        <button type="button" class="ghost" @click="copy('link')">{{ copied === 'link' ? 'Link copied' : 'Copy link' }}</button>
        <button type="button" class="ghost" @click="copy('json')">{{ copied === 'json' ? 'JSON copied' : 'Copy JSON' }}</button>
      </div>
    </section>

    <section class="readout" aria-label="Board readout">
      <h2>Readout</h2>
      <pre data-role="board-summary">{{ summaryLines.join('\n') }}</pre>

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
      v-if="drag && dragPiece"
      class="ghost-rod"
      :class="{ 'is-invalid': drag.overTrackId !== null && !drag.valid, 'is-tile': drag.kind !== 'rod' }"
      :style="{
        left: `${drag.x - drag.grabOffsetPx}px`,
        top: `${drag.y - 16}px`,
        width: `${drag.length * UNIT - 2}px`,
        background: pieceColors(dragPiece).fill,
        color: pieceColors(dragPiece).ink,
      }"
      aria-hidden="true"
    >
      {{ pieceLabel(dragPiece) }}
    </div>
  </main>
</template>

<style scoped>
.switcher { display: flex; gap: .4rem; font: 700 .7rem "JetBrains Mono", monospace; text-transform: uppercase; letter-spacing: .08em; }
.switcher a { padding: .3rem .7rem; border: 1px solid var(--mt-border); border-radius: 999px; color: var(--mt-text-muted); text-decoration: none; }
.switcher a.is-current { border-color: var(--color-primary-500); color: var(--color-primary-500); }
.rod-playground { max-width: 82rem; margin: 0 auto; padding: 2rem 1.5rem 4rem; display: grid; gap: 1.25rem; }
.eyebrow { margin: 0; color: var(--mt-text-muted); font: 700 .68rem "JetBrains Mono", monospace; letter-spacing: .12em; text-transform: uppercase; }
h1 { margin: .25rem 0; font-size: clamp(1.8rem, 4vw, 2.6rem); letter-spacing: -.03em; }
h2 { margin: 0 0 .5rem; font-size: 1rem; }
.lede { max-width: 60rem; margin: 0; color: var(--mt-text-sub); line-height: 1.6; }

.supply { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; padding: .75rem; border: 1px solid var(--mt-border); border-radius: .9rem; background: var(--mt-bg-elevated); }
.supply-divider { width: 1px; height: 2rem; background: var(--mt-border-strong); }
.supply-rod, .rod, .ghost-rod {
  height: 2rem; border: 1px solid rgba(0,0,0,.4); border-radius: .3rem;
  font: 700 .8rem "JetBrains Mono", monospace; box-shadow: 0 2px 0 rgba(0,0,0,.35);
  touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab;
}
.supply-rod.is-tile, .rod.is-tile, .ghost-rod.is-tile { border-radius: .15rem; font-style: italic; }
.supply-rod:active, .rod:active { cursor: grabbing; }

.board { padding: 1rem; border: 1px solid var(--mt-border); border-radius: 1rem; background: var(--mt-bg-elevated); display: grid; gap: .75rem; }
.board-scroll { overflow-x: auto; padding-bottom: .25rem; }
.board-inner { position: relative; padding: 0 .25rem; }
.ruler { position: relative; height: 1.6rem; margin-bottom: .25rem; }
.tick { position: absolute; top: 0; width: 1.2rem; height: 1.6rem; margin-left: -.6rem; padding: 0; border: 0; background: transparent; color: var(--mt-text-muted); font: .62rem "JetBrains Mono", monospace; cursor: pointer; }
.tick::after { content: ''; position: absolute; left: 50%; bottom: 0; width: 1px; height: .35rem; background: var(--mt-border-strong); }
.tick.is-major::after { height: .6rem; }
.tick.is-marked { color: var(--color-primary-500); font-weight: 700; }
.tick-label { position: absolute; top: 0; left: 50%; transform: translateX(-50%); }

.lanes { position: relative; display: grid; gap: .45rem; }
.marker { position: absolute; top: -.1rem; bottom: -.1rem; width: 0; border-left: 3px dashed color-mix(in srgb, var(--color-primary-500) 80%, transparent); pointer-events: none; z-index: 2; }

.track { border-radius: .4rem; border: 1px solid transparent; }
.track.is-active { border-color: color-mix(in srgb, var(--color-primary-500) 35%, transparent); }
.track.is-target { background: color-mix(in srgb, var(--color-primary-500) 8%, transparent); }
.lane {
  position: relative; height: 2.5rem;
  background-image: linear-gradient(90deg, var(--mt-border) 1px, transparent 1px);
  background-size: 28px 100%;
  border-left: 1px solid var(--mt-border-strong);
  border-bottom: 1px solid var(--mt-border);
}
.rod { position: absolute; top: .25rem; margin-left: 1px; }
.rod.is-selected { outline: 3px solid var(--color-primary-500); outline-offset: 2px; z-index: 1; }
.rod.is-lifted { opacity: .35; }
.preview { position: absolute; top: .25rem; height: 2rem; margin-left: 1px; border: 2px dashed var(--color-primary-500); border-radius: .3rem; background: color-mix(in srgb, var(--color-primary-500) 18%, transparent); }
.preview.is-invalid { border-color: #e5484d; background: color-mix(in srgb, #e5484d 18%, transparent); }

.ghost-rod { position: fixed; z-index: 50; display: grid; place-items: center; pointer-events: none; opacity: .92; transform: rotate(-1deg); }
.ghost-rod.is-invalid { opacity: .5; }

.lane-labels { display: grid; gap: .3rem; }
.lane-label-row { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; font: .72rem "JetBrains Mono", monospace; color: var(--mt-text-muted); }
.lane-index { width: 1.6rem; font-weight: 700; color: var(--mt-text-sub); }
.track-label { width: 10rem; padding: .2rem .4rem; border: 1px solid var(--mt-border); border-radius: .35rem; background: var(--mt-bg-inset); color: var(--mt-text); font: inherit; }
.lane-total { color: var(--mt-text-sub); }

.board-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; padding-top: .25rem; }
button.primary, button.ghost { padding: .4rem .8rem; border-radius: .5rem; font: 600 .78rem "JetBrains Mono", monospace; cursor: pointer; }
button.primary { border: 1px solid var(--color-primary-600); background: var(--color-primary-600); color: white; }
button.ghost { border: 1px solid var(--mt-border-strong); background: transparent; color: var(--mt-text-sub); }
button.ghost:hover { background: var(--mt-bg-inset); }

.readout { padding: 1rem; border: 1px solid var(--mt-border); border-radius: 1rem; background: var(--mt-bg-elevated); }
pre { margin: 0; white-space: pre-wrap; color: var(--mt-text-sub); font: .78rem "JetBrains Mono", monospace; line-height: 1.6; }
details { margin-top: .75rem; }
summary { cursor: pointer; color: var(--mt-text-muted); font: .74rem "JetBrains Mono", monospace; }
textarea { width: 100%; margin-top: .5rem; padding: .6rem; border: 1px solid var(--mt-border); border-radius: .5rem; background: var(--mt-bg-inset); color: var(--mt-text); font: .74rem "JetBrains Mono", monospace; }
.error { color: #e5484d; font-size: .78rem; }
</style>
