<script setup lang="ts">
import { createArrayGoalAdapter } from './goals/board-goal-adapters'
import { computed } from 'vue'
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

const props = withDefaults(defineProps<{
  active?: boolean
  cancelVersion?: () => number
}>(), {
  active: true,
  cancelVersion: undefined,
})

const fullColumns = 24
const boardRows = 12

const {
  boardViewport,
  workspaceTools,
  setBoardViewport,
  setWorkspaceTools,
} = usePlaygroundElementRefs()

const {
  phonePortrait,
  trayOpen,
  visibleColumns,
  cellSize,
  boardPaddingY,
} = useBoardLayout({
  boardViewport,
  workspaceTools,
  fullColumns,
  portraitColumns: 12,
  totalRows: boardRows,
  horizontalPadding: 32,
  maximumCellSize: 36,
  minimumLandscapeCellSize: 24,
  bottomGap: 8,
})

const editingDisabled = computed(
  () => !props.active || phonePortrait.value,
)

const scene = useRodScene({
  columns: fullColumns,
  rows: boardRows,
  spawnRows: Array.from({ length: boardRows }, (_, row) => row),
  editable: () => !editingDisabled.value,
  allowOrientation: true,
  allowFactors: true,
})

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

const goalAdapter = createArrayGoalAdapter({ columns: fullColumns, rows: boardRows })
const board = { kind: 'array', config: { columns: fullColumns, rows: boardRows } } as const

const factorMenuChoice = useFactorMenuChoice(scene)

const message = scene.message

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
  { kind: 'action', label: 'Clone', action: { type: 'clone' } },
  { kind: 'action', label: 'Make a train', action: { type: 'make-train' } },
  { kind: 'action', label: 'Undo train', action: { type: 'ungroup' } },
  { kind: 'action', label: 'Regroup to ones', action: { type: 'regroup-ones' } },

  addendMenuChoice.value,
  factorMenuChoice.value,

  ...arrayRodOrientations.map(orientation => ({
    kind: 'action' as const,
    label: orientation[0]!.toUpperCase() + orientation.slice(1),
    action: {
      type: 'set-orientation' as const,
      orientation,
    },
    checked: selectedRod.value?.orientation === orientation,
  })),
  { kind: 'action', label: 'Delete', action: { type: 'delete' } },
])

function onChoose(value: CuisenaireRodValue): void {
  if (blocked.value) return
  const result = scene.apply([], { type: 'create', value })

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
    preview-notice="Portrait preview: columns 0–12. Rotate to landscape to edit."
    :remove-disabled="!checkSelected({ type: 'delete' }).allowed"
    :selected-orientation="selectedRod?.orientation"
    :set-board-viewport="setBoardViewport"
    :set-workspace-tools="setWorkspaceTools"
    toolbar-label="Array rod controls"
    tray-id="array-rod-tray"
    :tray-open="trayOpen"
    viewport-class="array-viewport"
    @board-lost-pointer-capture="marquee.onLostPointerCapture"
    @board-pointer-down="marquee.onPointerDown"
    @choose-rod="onChoose"
    @orient="onOrient"
    @remove-selected="onRemove"
    @update-tray-open="trayOpen = $event"
  >
    <template #board>
      <ArrayRodTabla
        :rows="boardRows"
        :visible-columns="visibleColumns"
        :cell-size="cellSize"
        :viewport-padding="`${boardPaddingY}px 16px`"
      >
        <template #pieces="{ cellSize: pieceCellSize }">
          <SceneRodLayer
            :pieces="renderedPieces"
            :cell-size="pieceCellSize"
            :controls="controls"
            :clip-columns="phonePortrait ? visibleColumns : null"
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
        :board="board"
        :goal-adapter="goalAdapter"
        :scene="scene"
        :capture-scene="captureScene"
        :replace-scene="replaceScene"
        :blocked="() => blocked"
        :editing-disabled="() => editingDisabled"
      />
    </template>
  </ArrayPlaygroundShell>
</template>
