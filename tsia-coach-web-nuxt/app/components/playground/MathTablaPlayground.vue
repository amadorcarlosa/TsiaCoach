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
import { areaGroupReadings, type AreaGrouping } from '~/components/tabla/area-grouping'
import type { Point } from '~/components/grid/gridPointer'
import { trainView } from '~/components/rod/scene/train-view'
import { trainFitsRegion } from '~/components/rod/scene/scene-regions'

import type { SceneMenuChoice } from '~/components/rod/scene/scene-menu.types'
import type { SceneSnapshot } from '~/components/rod/scene/scene-snapshot'
import { useRodScene } from '~/composables/useRodScene'
import { useRodPlaygroundInteraction } from '~/composables/useRodPlaygroundInteraction'
import { useFactorMenuChoice } from '~/composables/useFactorMenuChoice'
import { useAreaGroupingMenuChoice } from '~/composables/useAreaGroupingMenuChoice'
import { useBoardLayout } from '~/composables/useBoardLayout'
import { usePlaygroundElementRefs } from '~/composables/usePlaygroundElementRefs'
import RodPlaygroundAuthoring from '~/components/playground/RodPlaygroundAuthoring.vue'

const props = withDefaults(defineProps<{
  active?: boolean
  showAuthoring?: boolean
  cancelVersion?: () => number
}>(), {
  active: true,
  showAuthoring: true,
  cancelVersion: undefined,
})

const centralColumns = 24
const centralRows = 12
const boardDefinition = getMathTablaGeometry(centralColumns, centralRows)
const fullColumns = boardDefinition.config.columns
const boardRows = boardDefinition.config.rows
const activeRegion = ref('array')
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
  allowAreaRegroup: true,
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

// Whole grouping is presentation, not authored data. Until a schema migration
// captures it per step, restoring, importing or clearing starts ungrouped.
const wholeGrouping = ref<AreaGrouping | null>(null)

function restoreScene(source: SceneSnapshot) {
  const result = replaceScene(source)
  if (result.allowed) wholeGrouping.value = null
  return result
}

defineExpose({ capture: () => ({ board, trains: captureScene() }), clear: () => restoreScene([]) })

const factorMenuChoice = useFactorMenuChoice(scene)
const areaGroupingMenuChoice = useAreaGroupingMenuChoice(scene)

const message = scene.message
const readouts = computed(() => getMathTablaReadouts(scene.trains.value, boardDefinition))

// Both readings of the current whole, recomputed from the live guide.
const wholeGroupReadings = computed(() => {
  const guide = readouts.value.guide
  if (!guide) return []

  return areaGroupReadings({
    offset: { x: guide.x, y: guide.y },
    width: guide.width,
    depth: guide.depth,
  })
})

const activeWholeGrouping = computed(
  () => readouts.value.guide ? wholeGrouping.value : null,
)

const activeWholeReading = computed(() =>
  wholeGroupReadings.value.find(
    reading => reading.grouping === activeWholeGrouping.value,
  ) ?? null,
)

const groupingUnavailable = computed(() =>
  readouts.value.state === 'ready'
    ? ''
    : readouts.value.state === 'exceeds-board'
      ? 'The whole does not fit this board, so it cannot be grouped yet.'
      : 'Define the whole with both D references before grouping it.',
)

const missingDenominator = computed(() => {
  const missing = orientations.filter(axis => readouts.value[axis].denominator < 1)
  return missing.length === 2
    ? 'Add rods to the horizontal and vertical D tracks to define the whole area.'
    : `Add a rod to the ${missing[0]} D track to define the whole area.`
})

const renderedPieces = computed(() =>
  scene.trains.value.map(trainView),
)

// The whole denominator is two-dimensional: its reference strips are as flat as
// the area they describe. Role decides this, never colour or creation history,
// so it is re-derived from the live region containment after every move,
// restoration and import. Numerator references and central rods stay raised.
const denominatorRegions = boardDefinition.regions.filter(
  region => region.id === 'horizontal-d' || region.id === 'vertical-d',
)

const flatReferenceIds = computed(() => new Set(
  scene.trains.value
    .filter(train => denominatorRegions.some(region => trainFitsRegion(train, region)))
    .map(train => train.id),
))

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
  areaGroupingMenuChoice.value,

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
        <template v-if="readouts.guide">
          <p>Whole area: {{ readouts.guide.width }} × {{ readouts.guide.depth }} = {{ readouts.guideCells }} square units</p>
          <p>Covered: {{ readouts.occupiedCells }} of {{ readouts.guideCells }} square units</p>
        </template>
        <p v-else-if="readouts.state === 'exceeds-board'">
          Whole exceeds this board: {{ readouts.horizontal.denominator }} × {{ readouts.vertical.denominator }}
          does not fit {{ centralColumns }} × {{ centralRows }} cells.
        </p>
        <p v-else>{{ missingDenominator }}</p>
      </div>

      <div class="math-grouping" role="group" aria-label="Group the whole">
        <span>Group the whole:</span>
        <PlaygroundActionButton
          :disabled="blocked || !readouts.guide"
          :pressed="activeWholeGrouping === null"
          @click="wholeGrouping = null"
        >
          No grouping
        </PlaygroundActionButton>
        <PlaygroundActionButton
          v-for="reading in wholeGroupReadings"
          :key="reading.grouping"
          :disabled="blocked"
          :pressed="activeWholeGrouping === reading.grouping"
          @click="wholeGrouping = reading.grouping"
        >
          {{ reading.label }} ({{ reading.arrangement }})
        </PlaygroundActionButton>
      </div>

      <!-- Outside the aria-hidden board surface, so the grouping is announced. -->
      <p role="status">
        {{ groupingUnavailable || activeWholeReading?.sentence || 'The whole is not grouped.' }}
      </p>
    </template>

    <template #board>
      <MathTablaBoard
        :rows="centralRows"
        :columns="centralColumns"
        :cell-size="cellSize"
        viewport-padding="16px"
        :active-region="activeRegion"
        :guide="readouts.guide"
        :whole-grouping="activeWholeGrouping"
      >
        <template #pieces="{ cellSize: pieceCellSize }">
          <SceneRodLayer
            :pieces="renderedPieces"
            :cell-size="pieceCellSize"
            :controls="controls"
            :clip-columns="phonePortrait ? visibleColumns : null"
            :flat-ids="flatReferenceIds"
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
        v-if="showAuthoring"
        :board="board"
        :goal-adapter="goalAdapter"
        :scene="scene"
        :capture-scene="captureScene"
        :replace-scene="restoreScene"
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

.math-grouping {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-block: 8px;
}
</style>
