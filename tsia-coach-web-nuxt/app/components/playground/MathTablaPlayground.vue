<script setup lang="ts">
import { createMathTablaGoalAdapter } from './goals/board-goal-adapters'
import { computed, ref } from 'vue'
import MathTablaBoard from '~/components/tabla/MathTablaBoard.vue'
import SceneRodLayer from '~/components/rod/scene/SceneRodLayer.vue'
import SceneMenu from '~/components/rod/scene/SceneMenu.vue'
import PlaygroundActionButton from '~/components/playground/PlaygroundActionButton.vue'
import ArrayPlaygroundShell from '~/components/playground/ArrayPlaygroundShell.vue'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import type { ArrayRodOrientation } from '~/components/rod/array/array-rod.types'
import { getMathTablaGeometry } from '~/components/tabla/mathtabla.geometry'
import { getMathTablaReadouts } from '~/components/tabla/mathtabla.readouts'
import type { Point } from '~/components/grid/gridPointer'
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

const centralColumns = 24
const centralRows = 12
const boardDefinition = getMathTablaGeometry(centralColumns, centralRows)
const fullColumns = boardDefinition.config.columns
const boardRows = boardDefinition.config.rows
const activeRegion = ref('array')
const showGuide = ref(false)
const orientations = ['horizontal', 'vertical'] as const
const destinations = [
  { id: 'horizontal-d', label: 'Horizontal D' },
  { id: 'horizontal-n', label: 'Horizontal N' },
  { id: 'vertical-d', label: 'Vertical D' },
  { id: 'vertical-n', label: 'Vertical N' },
  { id: 'array', label: 'Central array' },
]

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
} = useBoardLayout({
  boardViewport,
  workspaceTools,
  fullColumns,
  portraitColumns: 14,
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
  spawnRows: Array.from({ length: centralRows }, (_, row) => boardDefinition.array.y + row),
  regions: boardDefinition.regions,
  editable: () => !editingDisabled.value,
  allowOrientation: true,
  allowFactors: true,
})

const controls = useRodPlaygroundInteraction({
  scene,
  viewport: boardViewport,
  disabled: () => editingDisabled.value,
  cancelVersion: () => props.cancelVersion?.() ?? 0,
  onBoardClick,
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

const goalAdapter = createMathTablaGoalAdapter({ centralColumns, centralRows })
const board = { kind: 'mathtabla', config: { centralColumns, centralRows } } as const

const factorMenuChoice = useFactorMenuChoice(scene)

const message = scene.message
const readouts = computed(() => getMathTablaReadouts(scene.trains.value, boardDefinition))

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

  ...orientations.map(orientation => ({
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

function onBoardClick(point: Point): void {
  if (blocked.value) return
  const region = boardDefinition.regions.find(item =>
    point.x >= item.x && point.x < item.x + item.width &&
    point.y >= item.y && point.y < item.y + item.depth,
  )
  if (region) activeRegion.value = region.id
}

function onChoose(value: CuisenaireRodValue): void {
  if (blocked.value) return
  const result = scene.apply([], { type: 'create', value, regionId: activeRegion.value })

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
    :orientations="orientations"
    :phone-portrait="phonePortrait"
    :piece-count="renderedPieces.length"
    preview-notice="Portrait preview: two reference columns and the first 12 central-grid columns. Rotate to landscape to edit."
    :remove-disabled="!checkSelected({ type: 'delete' }).allowed"
    scrollable
    :selected-orientation="selectedRod?.orientation"
    :set-board-viewport="setBoardViewport"
    :set-workspace-tools="setWorkspaceTools"
    toolbar-label="MathTabla rod controls"
    tray-id="mathtabla-rod-tray"
    :tray-open="trayOpen"
    viewport-class="math-viewport"
    @board-lost-pointer-capture="marquee.onLostPointerCapture"
    @board-pointer-down="marquee.onPointerDown"
    @choose-rod="onChoose"
    @orient="onOrient"
    @remove-selected="onRemove"
    @update-tray-open="trayOpen = $event"
  >
    <template #tools-start>
      <div class="math-destinations" role="group" aria-label="Rod destination">
        <PlaygroundActionButton
          v-for="destination in destinations"
          :key="destination.id"
          :disabled="blocked"
          :pressed="activeRegion === destination.id"
          @click="activeRegion = destination.id"
        >
          {{ destination.label }}
        </PlaygroundActionButton>
      </div>
    </template>

    <template #before-board>
      <div class="math-readouts" role="group" aria-label="MathTabla reference readouts">
        <p>Horizontal reference: N {{ readouts.horizontal.numerator }}, D {{ readouts.horizontal.denominator }}</p>
        <p>Vertical reference: N {{ readouts.vertical.numerator }}, D {{ readouts.vertical.denominator }}</p>
        <label>
          <input v-model="showGuide" type="checkbox" :disabled="!readouts.guide">
          Show denominator guide
        </label>
        <template v-if="showGuide && readouts.guide">
          <p>Denominator guide: {{ readouts.guide.width }} × {{ readouts.guide.depth }} = {{ readouts.guideCells }} cells</p>
          <p>Occupied inside guide: {{ readouts.occupiedCells }} of {{ readouts.guideCells }} cells</p>
        </template>
        <p v-else-if="!readouts.guide">Add rods to both D tracks to define the guide.</p>
      </div>
    </template>

    <template #board>
      <MathTablaBoard
        :rows="centralRows"
        :columns="centralColumns"
        :cell-size="cellSize"
        viewport-padding="16px"
        :active-region="activeRegion"
        :guide="showGuide ? readouts.guide : null"
      >
        <template #pieces="{ cellSize: pieceCellSize }">
          <SceneRodLayer
            :pieces="renderedPieces"
            :cell-size="pieceCellSize"
            :controls="controls"
            :clip-columns="phonePortrait ? visibleColumns : null"
          />
        </template>
      </MathTablaBoard>
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

<style scoped>
.math-destinations {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  padding: 8px 0;
}

.math-readouts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 24px;
  margin-block: 8px;
}

.math-readouts p {
  margin: 0;
}

.math-readouts label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
}
</style>
