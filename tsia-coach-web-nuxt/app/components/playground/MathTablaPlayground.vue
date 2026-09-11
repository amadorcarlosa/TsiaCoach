<script setup lang="ts">
import { useLevelFiles } from '~/composables/useLevelFiles'
import LevelFileControls from './files/LevelFileControls.vue'
import BoardGoalEditor from './goals/BoardGoalEditor.vue'
import { createMathTablaGoalAdapter } from './goals/board-goal-adapters'
import { computed, ref } from 'vue'
import MathTablaBoard from '~/components/tabla/MathTablaBoard.vue'
import SceneRod from '~/components/rod/scene/SceneRod.vue'
import SceneMenu from '~/components/rod/scene/SceneMenu.vue'
import SceneMarqueeOverlay from '~/components/rod/scene/SceneMarqueeOverlay.vue'
import PlaygroundActionButton from '~/components/playground/PlaygroundActionButton.vue'
import PlaygroundRodTray from '~/components/playground/PlaygroundRodTray.vue'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import type { ArrayRodOrientation } from '~/components/rod/array/array-rod.types'
import { getMathTablaGeometry } from '~/components/tabla/mathtabla.geometry'
import { getMathTablaReadouts } from '~/components/tabla/mathtabla.readouts'
import type { Point } from '~/components/grid/gridPointer'
import { trainView } from '~/components/rod/scene/train-view'

import type { SceneMenuChoice } from '~/components/rod/scene/scene-menu.types'
import { useRodScene } from '~/composables/useRodScene'
import { useRodPlaygroundInteraction } from '~/composables/useRodPlaygroundInteraction'
import { useLevelAuthoring } from '~/composables/useLevelAuthoring'
import { useAuthoringControls } from '~/composables/useAuthoringControls'
import { useFactorMenuChoice } from '~/composables/useFactorMenuChoice'
import { useBoardLayout } from '~/composables/useBoardLayout'
import PlaygroundAuthoringControls from '~/components/playground/PlaygroundAuthoringControls.vue'

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

const boardViewport = ref<HTMLElement | null>(null)
const workspaceTools = ref<HTMLElement | null>(null)

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

const {
  menu,
  interaction,
  marquee,
  blocked,
  highlightedIds,
  checkSelected,
  applySelected,
  addendMenuChoice,
  captureScene,
  replaceScene,
} = useRodPlaygroundInteraction({
  scene,
  viewport: boardViewport,
  disabled: () => editingDisabled.value,
  cancelVersion: () => props.cancelVersion?.() ?? 0,
  onBoardClick,
})

const goalAdapter = createMathTablaGoalAdapter({ centralColumns, centralRows })
const goalEditor = ref<InstanceType<typeof BoardGoalEditor> | null>(null)
const authoring = useLevelAuthoring({
  goals: goalAdapter,
  beforeChange: () => goalEditor.value?.resolveDraft() ?? true,
  scene: {
    read: () => scene.trains.value,
    capture: captureScene,
    checkReplacement: scene.checkReplacement,
    replace: replaceScene,
  },
  editable: () => !editingDisabled.value,
})

const authoringControls = useAuthoringControls(
  authoring,
  () => blocked.value,
)
const levelFiles = useLevelFiles({
  adapter: { board: { kind: 'mathtabla', config: { centralColumns, centralRows } }, goals: goalAdapter, validateSnapshot: scene.validateSnapshot },
  authoring,
  editable: () => !editingDisabled.value,
  hasWorkingRods: () => scene.trains.value.length > 0,
  resolveDrafts: () => goalEditor.value?.resolveDraft() ?? true,
  onImported: authoringControls.reset,
})


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
  { kind: 'action', label: 'Regroup to ones', action: { type: 'regroup-ones' } },
  { kind: 'action', label: 'Undo train', action: { type: 'ungroup' } },

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
  <div class="math-playground" :class="{ 'math-playground--preview': phonePortrait }">
    <p v-if="phonePortrait" role="status">
      Portrait preview: two reference columns and the first 12 central-grid columns. Rotate to landscape to edit.
    </p>

    <div ref="workspaceTools">
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
      <div class="math-toolbar" aria-label="MathTabla rod controls">
        <button
            type="button"
            :aria-expanded="trayOpen"
            aria-controls="mathtabla-rod-tray"
            @click="trayOpen = !trayOpen"
        >
          {{ trayOpen ? 'Hide rods' : 'Show rods' }}
        </button>

        <PlaygroundActionButton
            v-for="orientation in orientations"
            :key="orientation"
            class="orientation-button"
            :disabled="!checkSelected({
              type: 'set-orientation',
              orientation,
            }).allowed"
            :pressed="selectedRod?.orientation === orientation"
            @click="onOrient(orientation)"
        >
          {{ orientation }}
        </PlaygroundActionButton>

        <PlaygroundActionButton
            :disabled="!checkSelected({ type: 'delete' }).allowed"
            @click="onRemove"
        >
          Remove selected rod
        </PlaygroundActionButton>
      </div>

      <div v-show="trayOpen" id="mathtabla-rod-tray">
        <PlaygroundRodTray
            layout="wrap"
            :disabled="blocked"
            @choose="onChoose"
        />
      </div>
    </div>

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

    <div
        ref="boardViewport"
        class="math-viewport"
        :class="{ 'marquee-enabled': !editingDisabled }"
        tabindex="-1"
        @pointerdown.capture="marquee.onPointerDown"
        @lostpointercapture="marquee.onLostPointerCapture"
    >
      <MathTablaBoard
          :rows="centralRows"
          :columns="centralColumns"
          :cell-size="cellSize"
          viewport-padding="16px"
          :active-region="activeRegion"
          :guide="showGuide ? readouts.guide : null"
      >
        <template #pieces="{ cellSize: pieceCellSize }">
          <SceneRod
              v-for="piece in renderedPieces"
              v-show="
      !phonePortrait ||
      (
        piece.x < visibleColumns &&
        piece.x + piece.dimensions.width > 0
      )
    "
               :id="piece.id"
               :key="piece.id"
               :value="piece.value"
               :parts="piece.parts"
               :x="piece.x"
               :y="piece.y"
              :dimensions="piece.dimensions"
              :cell-size="pieceCellSize"
              :selected="highlightedIds.has(piece.id)"
              :disabled="blocked"
              :snap-to-grid="true"
              :begin-move="() => interaction.beginMove(piece.id)"
              :constrain-position="(position, direction) => interaction.constrainPosition(piece.id, position, direction)"
              :preview-delta="interaction.previewFor(piece.id)"
              @select="interaction.select(piece.id, $event)"
              @move-preview="interaction.previewMove(piece.id, $event)"
              @settled="interaction.settleMove(piece.id, $event)"
              @move-end="interaction.endMove(piece.id)"
              @menu-request="menu.open"
          />
          <SceneMarqueeOverlay
              :rectangle="marquee.rectangle.value"
              :cell-size="pieceCellSize"
          />
        </template>
      </MathTablaBoard>
    </div>

    <SceneMenu
      :request="menu.request.value"
      :selection="menu.selectedIds.value"
      :choices="menuChoices"
      :check="scene.check"
      @action="menu.applyAction"
      @close="menu.close"
      @restore-focus="menu.restoreFocus"
    />

    <PlaygroundAuthoringControls
      :steps="authoring.steps.value"
      :active-step-id="authoring.activeStepId.value"
      :dirty="authoring.dirty.value"
      :blocked="blocked"
      :pending-step-id="authoringControls.pendingStepId.value"
      :pending-delete-id="authoringControls.pendingDeleteId.value"
      :pending-delete-title="authoringControls.pendingDeleteTitle.value"
      :deleting-dirty-active="authoringControls.deletingDirtyActive.value"
      :message="authoringControls.message.value"
      @capture="authoringControls.capture"
      @update="authoringControls.update"
      @select-step="authoringControls.requestStep"
      @resolve="authoringControls.resolve"
      @patch="authoringControls.patch"
      @move="authoringControls.move"
      @request-delete="authoringControls.requestDelete"
      @confirm-delete="authoringControls.confirmDelete"
      @cancel-delete="authoringControls.cancelDelete"
    >
        <template #goal-editor="{ stepId, disabled }">
          <BoardGoalEditor
ref="goalEditor" :step-id="stepId" :adapter="goalAdapter" :disabled="disabled"
            :goal="authoring.steps.value.find(step => step.id === stepId)?.goal ?? null"
            @apply="input => authoring.setGoal(stepId, input)" />
        </template>
      </PlaygroundAuthoringControls>
      <LevelFileControls :files="levelFiles" :disabled="editingDisabled" />

    <p role="status" aria-live="polite">{{ message }}</p>
    <p>{{ renderedPieces.length }} objects on the board</p>
  </div>
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

.marquee-enabled :deep([data-grid-world]) {
  touch-action: none;
  user-select: none;
}

.math-playground {
  max-width: 1100px;
  min-width: 0;
  margin-inline: auto;
  padding: 8px;
}

.math-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-block: 8px;
}

.math-toolbar > button {
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-md);
  color: var(--mt-text);
  background: var(--mt-bg-elevated);
  font: inherit;
  cursor: pointer;
}

.math-toolbar > button:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

.orientation-button {
  text-transform: capitalize;
}

.math-viewport {
  width: 100%;
  min-width: 0;
  overflow-x: auto;
}

.math-playground--preview .math-viewport {
  overflow-x: hidden;
}
</style>

