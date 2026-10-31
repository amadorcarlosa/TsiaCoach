<script setup lang="ts">
import { createArrayGoalAdapter } from './goals/board-goal-adapters'
import { computed, ref, watch } from 'vue'
import BoardViewControls from '~/components/grid/BoardViewControls.vue'
import { useBoardCamera } from '~/composables/useBoardCamera'
import { validateSnapshot } from '~/components/rod/scene/validate-snapshot'
import type { RodSign, ScenePolicy } from '~/components/rod/scene/rod.scene.types'
import { formatSigned, trainSignedTotal } from '~/components/rod/scene/rod-arithmetic'
import type { BoardGoalAdapter } from './goals/goal.types'
import type { LevelDocumentAdapter } from './files/level-document'
import type { BoardAdoption } from '~/composables/useLevelFiles'
import ArrayRodTabla from '~/components/tabla/ArrayRodTabla.vue'
import SceneRodLayer from '~/components/rod/scene/SceneRodLayer.vue'
import SceneMenu from '~/components/rod/scene/SceneMenu.vue'
import ArrayPlaygroundShell from '~/components/playground/ArrayPlaygroundShell.vue'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import {
  arrayRodOrientations,
  type ArrayRodOrientation,
} from '~/components/rod/array/array-rod.types'
import { trainView } from '~/components/rod/scene/train-view'

import type { SceneMenuChoice } from '~/components/rod/scene/scene-menu.types'
import { useRodScene } from '~/composables/useRodScene'
import { useRodPlaygroundInteraction } from '~/composables/useRodPlaygroundInteraction'
import { useFactorMenuChoice } from '~/composables/useFactorMenuChoice'
import { useBoardLayout } from '~/composables/useBoardLayout'
import { usePlaygroundElementRefs } from '~/composables/usePlaygroundElementRefs'
import RodPlaygroundAuthoring from '~/components/playground/RodPlaygroundAuthoring.vue'
import { baseRodMenuChoices, deleteMenuChoice, orientationMenuChoices } from '~/components/rod/scene/rod-menu-choices'
import { playgroundBoardLayout, type RodPlaygroundExposed } from '~/components/playground/playground.types'

const props = withDefaults(defineProps<{
  active?: boolean
  showAuthoring?: boolean
  cancelVersion?: () => number
}>(), {
  active: true,
  showAuthoring: true,
  cancelVersion: undefined,
})

// Keep existing level files compatible; expand via the board-size controls.
const dimensions = ref({ columns: 24, rows: 12 })
const draftColumns = ref(100)
const draftRows = ref(100)
const sizeMessage = ref('')
const authoringPanel = ref<InstanceType<typeof RodPlaygroundAuthoring> | null>(null)
const fullColumns = computed(() => dimensions.value.columns)
const boardRows = computed(() => dimensions.value.rows)

const {
  boardViewport,
  workspaceTools,
  setBoardViewport,
  setWorkspaceTools,
} = usePlaygroundElementRefs()

const {
  phonePortrait,
  trayOpen,
  cellSize: baseCellSize,
  boardPaddingY,
} = useBoardLayout({
  ...playgroundBoardLayout,
  boardViewport,
  workspaceTools,
  fullColumns: 24,
  totalRows: 12,
})

const editingDisabled = computed(
  () => !props.active || phonePortrait.value,
)

const policy: ScenePolicy = {
  get columns() { return fullColumns.value },
  get rows() { return boardRows.value },
  get spawnRows() { return Array.from({ length: boardRows.value }, (_, row) => row) },
  editable: () => !editingDisabled.value,
  allowOrientation: true,
  allowFactors: true,
  // Array is the first signed board; the others stay positive-only.
  allowNegativeRods: true,
}
const scene = useRodScene(policy)

const controls = useRodPlaygroundInteraction({
  scene,
  viewport: boardViewport,
  disabled: () => editingDisabled.value,
  cancelVersion: () => props.cancelVersion?.() ?? 0,
})

const {
  menu,
  marquee,
  blocked,
  checkSelected,
  applySelected,
  addendMenuChoice,
  captureScene,
  replaceScene,
} = controls

const currentGoals = computed(() => createArrayGoalAdapter(dimensions.value))
// Stable adapter identity: authoring services retain the adapter while its bounds change.
const goalAdapter: BoardGoalAdapter = {
  get regions() { return currentGoals.value.regions },
  get pairs() { return currentGoals.value.pairs },
  get supportedTypes() { return currentGoals.value.supportedTypes },
  get signedRegionTotals() { return currentGoals.value.signedRegionTotals },
  parse: input => currentGoals.value.parse(input),
  evaluate: (goal, snapshot) => currentGoals.value.evaluate(goal, snapshot),
}
const board = computed(() => ({ kind: 'array' as const, config: { ...dimensions.value } }))

function cancelViewGestures() {
  controls.cancelGestures()
  menu.close()
}
const camera = useBoardCamera({
  viewport: boardViewport,
  baseCellSize: () => baseCellSize.value,
  disabled: () => editingDisabled.value,
  beforeChange: cancelViewGestures,
})
const cellSize = camera.cellSize

function onBoardPointerDown(event: PointerEvent) {
  if (!camera.onPointerDown(event)) marquee.onPointerDown(event)
}
function onBoardLostPointerCapture(event: PointerEvent) {
  camera.onPointerEnd(event)
  marquee.onLostPointerCapture(event)
}
watch(editingDisabled, disabled => {
  if (disabled) camera.endPan()
})

const MAX_BOARD_SIZE = 500
const validSize = (value: number) => Number.isInteger(value) && value >= 1 && value <= MAX_BOARD_SIZE

/** Validation for a board of another size; the live board is untouched. */
function adapterForSize(columns: number, rows: number): LevelDocumentAdapter {
  const nextPolicy = { ...policy, columns, rows }
  return {
    board: { kind: 'array', config: { columns, rows } },
    goals: createArrayGoalAdapter({ columns, rows }),
    validateSnapshot: snapshot => validateSnapshot(snapshot, nextPolicy),
  }
}

function applySize(columns: number, rows: number) {
  cancelViewGestures()
  dimensions.value = { columns, rows }
  draftColumns.value = columns
  draftRows.value = rows
  sizeMessage.value = `Board resized to ${columns} columns by ${rows} rows.`
  void camera.reset()
}

// An imported level brings its own size; the import replaces the working
// board, so only the file's steps and goals need to fit.
const adoptBoard: BoardAdoption = {
  adapterFor: board => board.kind === 'array' &&
    validSize(board.config.columns) && validSize(board.config.rows)
    ? adapterForSize(board.config.columns, board.config.rows)
    : null,
  apply: board => {
    if (board.kind !== 'array') return () => {}
    const before = { ...dimensions.value }
    const message = sizeMessage.value
    applySize(board.config.columns, board.config.rows)
    return () => {
      dimensions.value = before
      draftColumns.value = before.columns
      draftRows.value = before.rows
      sizeMessage.value = message
    }
  },
}

function resizeBoard() {
  const columns = Number(draftColumns.value)
  const rows = Number(draftRows.value)
  if (!validSize(columns) || !validSize(rows)) {
    sizeMessage.value = `Use whole-number dimensions from 1 to ${MAX_BOARD_SIZE}.`
    return
  }
  const next = adapterForSize(columns, rows)
  const working = next.validateSnapshot(scene.trains.value)
  const authored = authoringPanel.value?.checkConfiguration(next)
  const failure = !working.allowed ? working : authored && !authored.allowed ? authored : null
  if (failure) {
    sizeMessage.value = `Cannot resize: ${failure.reason}`
    return
  }
  applySize(columns, rows)
}

defineExpose<RodPlaygroundExposed>({ capture: () => ({ board: board.value, trains: captureScene() }), clear: () => replaceScene([]) })

const factorMenuChoice = useFactorMenuChoice(scene)

const message = scene.message

const rodSign = ref<RodSign>(1)

// Arithmetic, not occupancy: +10 and -10 read 0 but still fill 20 cells.
const totalReadout = computed(() =>
  `Signed total ${formatSigned(scene.trains.value.reduce((sum, train) => sum + trainSignedTotal(train), 0))}`,
)

const renderedPieces = computed(() =>
  scene.trains.value.map(trainView),
)

const selectedRod = computed(() => {
  if (scene.selection.value.size !== 1) return undefined

  return renderedPieces.value.find(
    piece => scene.selection.value.has(piece.id),
  )
})

const menuChoices = computed<SceneMenuChoice[]>(() => [
  ...baseRodMenuChoices(addendMenuChoice.value),
  factorMenuChoice.value,
  ...orientationMenuChoices(arrayRodOrientations, selectedRod.value?.orientation),
  deleteMenuChoice,
])

function onChoose(value: CuisenaireRodValue): void {
  if (blocked.value) return
  const result = scene.apply([], { type: 'create', value, sign: rodSign.value })

  if (result.allowed) {
    scene.select(result.createdIds)
  }
}

function onOrient(orientation: ArrayRodOrientation): void {
  applySelected({ type: 'set-orientation', orientation })
}

function onRemove(): void {
  applySelected({ type: 'delete' })
}
</script>

<template>
  <ArrayPlaygroundShell
    :blocked="blocked"
    :can-orient="orientation => checkSelected({ type: 'set-orientation', orientation }).allowed"
    :editing-disabled="editingDisabled"
    :message="message"
    :orientations="arrayRodOrientations"
    :phone-portrait="phonePortrait"
    :piece-count="renderedPieces.length"
    :rod-sign="rodSign"
    :total-readout="totalReadout"
    preview-notice="Portrait preview: columns 0–12. Rotate to landscape to edit."
    :remove-disabled="!checkSelected({ type: 'delete' }).allowed"
    :selected-orientation="selectedRod?.orientation"
    :set-board-viewport="setBoardViewport"
    :set-workspace-tools="setWorkspaceTools"
    toolbar-label="Array rod controls"
    tray-id="array-rod-tray"
    :tray-open="trayOpen"
    viewport-class="array-viewport"
    navigable
    :pan-mode="camera.panMode.value"
    @board-pointer-move="camera.onPointerMove"
    @board-pointer-end="camera.onPointerEnd"
    @board-keydown="camera.onKeydown"
    @board-scroll="cancelViewGestures"
    @board-lost-pointer-capture="onBoardLostPointerCapture"
    @board-pointer-down="onBoardPointerDown"
    @choose-rod="onChoose"
    @orient="onOrient"
    @remove-selected="onRemove"
    @update-tray-open="trayOpen = $event"
    @update-rod-sign="rodSign = $event"
  >
    <template #before-board>
      <form
        class="board-size-controls"
        aria-label="Board dimensions"
        @submit.prevent="resizeBoard"
      >
        <label>Columns <input
          v-model.number="draftColumns"
          type="number"
          min="1"
          :max="MAX_BOARD_SIZE"
          required
          :disabled="editingDisabled"
        ></label>
        <label>Rows <input
          v-model.number="draftRows"
          type="number"
          min="1"
          :max="MAX_BOARD_SIZE"
          required
          :disabled="editingDisabled"
        ></label>
        <button
          type="submit"
          :disabled="editingDisabled"
        >
          Resize board
        </button>
        <span>{{ fullColumns }} columns by {{ boardRows }} rows</span>
      </form>
      <p
        v-if="sizeMessage"
        role="status"
      >
        {{ sizeMessage }}
      </p>
      <BoardViewControls
        :zoom="camera.zoom.value"
        :pan-mode="camera.panMode.value"
        :disabled="editingDisabled"
        @zoom="camera.setZoom"
        @reset="camera.reset"
        @toggle-pan="camera.togglePan"
      />
    </template>
    <template #board>
      <ArrayRodTabla
        :rows="boardRows"
        :visible-columns="fullColumns"
        :tilt-degrees="0"
        :cell-size="cellSize"
        :viewport-padding="`${boardPaddingY}px 16px`"
      >
        <template #pieces="{ cellSize: pieceCellSize }">
          <SceneRodLayer
            :pieces="renderedPieces"
            :cell-size="pieceCellSize"
            :controls="controls"
          />
        </template>
      </ArrayRodTabla>
    </template>

    <template #menu>
      <SceneMenu
        :request="menu.request.value"
        :selection="menu.selectedIds.value"
        :choices="menuChoices"
        :check="scene.check"
        @action="menu.applyAction"
        @close="menu.close"
        @restore-focus="menu.restoreFocus"
      />
    </template>

    <template #after-workspace>
      <RodPlaygroundAuthoring
        v-if="showAuthoring"
        ref="authoringPanel"
        :board="board"
        :goal-adapter="goalAdapter"
        :scene="scene"
        :capture-scene="captureScene"
        :replace-scene="replaceScene"
        :blocked="() => blocked"
        :editing-disabled="() => editingDisabled"
        :adopt-board="adoptBoard"
      />
    </template>
  </ArrayPlaygroundShell>
</template>

<style scoped>
.board-size-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding-block: 8px; }
.board-size-controls input { width: 6rem; }
.board-size-controls input, .board-size-controls button { min-height: 44px; padding: 8px; border: 1px solid var(--mt-border); border-radius: var(--radius-md); background: var(--mt-bg-elevated); color: var(--mt-text); }
</style>
