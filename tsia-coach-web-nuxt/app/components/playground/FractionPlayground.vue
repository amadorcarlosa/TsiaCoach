<script setup lang="ts">
import FractionRodTabla from '~/components/tabla/FractionRodTabla.vue'
import { getFractionTablaGeometry } from '~/components/tabla/fraction-tabla.geometry'
import { fractionReadout } from '~/components/tabla/fraction-readout'
import type { Point } from '~/components/grid/gridPointer'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import { useRodScene } from '~/composables/useRodScene'
import { useRodPlaygroundInteraction } from '~/composables/useRodPlaygroundInteraction'
import { useLevelAuthoring } from '~/composables/useLevelAuthoring'
import { useBoardLayout } from '~/composables/useBoardLayout'
import { usePlaygroundElementRefs } from '~/composables/usePlaygroundElementRefs'
import SceneRod from '~/components/rod/scene/SceneRod.vue'
import SceneMenu from '~/components/rod/scene/SceneMenu.vue'
import SceneMarqueeOverlay from '~/components/rod/scene/SceneMarqueeOverlay.vue'
import TablaPlaygroundShell from '~/components/playground/TablaPlaygroundShell.vue'
import PlaygroundActionButton from '~/components/playground/PlaygroundActionButton.vue'
import type { SceneMenuChoice } from '~/components/rod/scene/scene-menu.types'
import { trainView } from '~/components/rod/scene/train-view'

const props = withDefaults(defineProps<{
  active?: boolean
  cancelVersion?: () => number
}>(), {
  active: true,
  cancelVersion: undefined,
})

const pairCount = 2
const fullColumns = 24
const horizontalPadding = 32

const boardDefinition = getFractionTablaGeometry(
  pairCount,
  36,
  fullColumns,
)

const trackRows = boardDefinition.targets.flatMap(target => [
  target.numeratorRow,
  target.denominatorRow,
])

const activeRow = ref(trackRows[0]!)
const {
  boardViewport,
  workspaceTools,
  setBoardViewport,
  setWorkspaceTools,
} = usePlaygroundElementRefs()

const {
  compactLayout,
  phonePortrait,
  shortLandscape,
  trayOpen,
  visibleColumns,
  cellSize,
  boardPaddingY,
} = useBoardLayout({
  boardViewport,
  workspaceTools,
  fullColumns,
  portraitColumns: 12,
  totalRows: boardDefinition.config.rows,
  horizontalPadding,
  maximumCellSize: 36,
  minimumLandscapeCellSize: 24,
  bottomGap: 8,
})

const geometry = computed(() =>
  getFractionTablaGeometry(
    pairCount,
    cellSize.value,
    visibleColumns.value,
  ),
)

const workspaceStyle = computed(() => ({
  '--grid-top-inset': `${geometry.value.topInset}px`,
  '--workspace-padding-y': `${boardPaddingY.value}px`,
}))

const boardWidth = computed(() =>
  visibleColumns.value * cellSize.value + horizontalPadding,
)

const boardAriaLabel = computed(() =>
  phonePortrait.value
    ? 'Rod board preview, columns zero to twelve'
    : 'Rod board, columns zero to twenty-four',
)

const editingDisabled = computed(
  () => !props.active || phonePortrait.value,
)

const scene = useRodScene({
  columns: fullColumns,
  rows: boardDefinition.config.rows,
  spawnRows: trackRows,
  trackRows,
  editable: () => !editingDisabled.value,
  allowOrientation: false,
  allowFactors: false,
})

const readouts = computed(() =>
  fractionReadout(scene.trains.value, boardDefinition.targets),
)

const trackControls = computed(() =>
  boardDefinition.targets.flatMap((target, index) => {
    const readout = readouts.value.find(
      item => item.pairId === target.id,
    )

    return [
      {
        id: `${target.id}-numerator`,
        row: target.numeratorRow,
        label: `Fraction ${index + 1} numerator`,
        total: readout?.numerator ?? 0,
      },
      {
        id: `${target.id}-denominator`,
        row: target.denominatorRow,
        label: `Fraction ${index + 1} denominator`,
        total: readout?.denominator ?? 0,
      },
    ]
  }),
)

function activateTrack(row: number): void {
  if (blocked.value || !trackRows.includes(row)) return
  activeRow.value = row
}

function onBoardClick(point: Point): void {
  activateTrack(Math.floor(point.y))
}

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

const authoring = useLevelAuthoring({
  trains: () => scene.trains.value,
  captureScene,
  checkReplacement: scene.checkReplacement,
  replaceScene,
  editable: () => !editingDisabled.value,
})

const pendingStepId = ref<string | null>(null)
const authoringMessage = ref('')

function requestStep(id: string): void {
  const result = authoring.selectStep(id)

  pendingStepId.value =
    !result.allowed && result.needsDecision ? id : null

  authoringMessage.value = result.allowed ? '' : result.reason
}

function resolveStep(decision: 'save' | 'discard' | 'cancel'): void {
  const id = pendingStepId.value
  if (!id) return

  const result = authoring.selectStep(id, decision)
  authoringMessage.value = result.allowed ? '' : result.reason

  if (result.allowed || decision === 'cancel') {
    pendingStepId.value = null
  }
}

const menuChoices = computed<SceneMenuChoice[]>(() => [
  { kind: 'action', label: 'Clone', action: { type: 'clone' } },
  { kind: 'action', label: 'Make a train', action: { type: 'make-train' } },
  { kind: 'action', label: 'Undo train', action: { type: 'ungroup' } },
  { kind: 'action', label: 'Regroup to ones', action: { type: 'regroup-ones' } },
  addendMenuChoice.value,
  { kind: 'action', label: 'Delete', action: { type: 'delete' } },
])

const placedRods = computed(() =>
  scene.trains.value.map(trainView),
)

const placementMessage = scene.message

function onRemoveSelectedRod(): void {
  applySelected({ type: 'delete' })
}

function onChooseRod(value: CuisenaireRodValue): void {
  if (blocked.value) return

  scene.apply([], {
    type: 'create',
    value,
    row: activeRow.value,
  })
}

function intersectsPreview(
  piece: ReturnType<typeof trainView>,
  columns: number,
): boolean {
  return piece.x < columns && piece.x + piece.dimensions.width > 0
}
</script>

<template>
  <TablaPlaygroundShell
    :board-aria-label="boardAriaLabel"
    :board-width="boardWidth"
    :blocked="blocked"
    :compact-layout="compactLayout"
    :editing-disabled="editingDisabled"
    :phone-portrait="phonePortrait"
    :piece-count="placedRods.length"
    :remove-disabled="!checkSelected({ type: 'delete' }).allowed"
    :set-board-viewport="setBoardViewport"
    :set-workspace-tools="setWorkspaceTools"
    :short-landscape="shortLandscape"
    tray-id="fraction-rod-tray"
    :tray-open="trayOpen"
    :workspace-style="workspaceStyle"
    @board-lost-pointer-capture="marquee.onLostPointerCapture"
    @board-pointer-down="marquee.onPointerDown"
    @choose-rod="onChooseRod"
    @remove-selected="onRemoveSelectedRod"
    @update-tray-open="trayOpen = $event"
  >
    <template #board-controls>
      <div
        class="track-controls"
        role="group"
        aria-label="Active fraction track"
      >
        <button
          v-for="track in trackControls"
          :key="track.id"
          type="button"
          :disabled="blocked"
          :aria-pressed="activeRow === track.row"
          :data-track-control="track.id"
          @click="activateTrack(track.row)"
        >
          {{ track.label }}
          <span v-if="track.total > 0">: {{ track.total }}</span>
        </button>
      </div>
    </template>

    <template #board>
      <FractionRodTabla
        :pair-count="pairCount"
        :cell-size="cellSize"
        :visible-columns="visibleColumns"
        :active-row="activeRow"
        viewport-padding="var(--workspace-padding-y) 16px"
        embedded
      >
        <template #pieces="{ cellSize: pieceCellSize }">
          <SceneRod
            v-for="piece in placedRods"
            v-show="!phonePortrait || intersectsPreview(piece, visibleColumns)"
            :id="piece.id"
            :key="piece.id"
            :value="piece.value"
            :parts="piece.parts"
            :dimensions="piece.dimensions"
            :x="piece.x"
            :y="piece.y"
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
      </FractionRodTabla>
    </template>

    <template #menu>
      <SceneMenu
        :request="menu.request.value"
        :selection="menu.selectedIds.value"
        :check="scene.check"
        :choices="menuChoices"
        @action="menu.applyAction"
        @close="menu.close"
        @restore-focus="menu.restoreFocus"
      />
    </template>

    <template #after-workspace>
      <ul
        class="fraction-readouts"
        aria-label="Fraction readouts"
      >
        <li
          v-for="(readout, index) in readouts"
          :key="readout.pairId"
          :data-fraction-pair="readout.pairId"
        >
          <span>Fraction {{ index + 1 }}: </span>
          <span v-if="readout.complete">
            {{ readout.numerator }}/{{ readout.denominator }}
          </span>
          <span v-else>incomplete</span>
        </li>
      </ul>

      <div class="authoring-controls" role="group" aria-label="Authoring steps">
        <PlaygroundActionButton
          :disabled="blocked || pendingStepId !== null"
          @click="authoring.captureStep()"
        >
          Capture step
        </PlaygroundActionButton>
        <PlaygroundActionButton
          :disabled="
            blocked ||
            !authoring.activeStepId.value ||
            !authoring.dirty.value ||
            pendingStepId !== null
          "
          @click="authoring.updateStep()"
        >
          Update step
        </PlaygroundActionButton>
        <PlaygroundActionButton
          v-for="step in authoring.steps.value"
          :key="step.id"
          :disabled="blocked || pendingStepId !== null"
          :pressed="authoring.activeStepId.value === step.id"
          @click="requestStep(step.id)"
        >
          {{ step.title }}
          <span v-if="authoring.activeStepId.value === step.id && authoring.dirty.value">
            (unsaved)
          </span>
        </PlaygroundActionButton>
      </div>

      <div
        v-if="pendingStepId"
        class="authoring-controls authoring-decision"
        role="group"
        aria-label="Unsaved step changes"
      >
        <p>Save changes to the current step before switching?</p>
        <PlaygroundActionButton :disabled="blocked" @click="resolveStep('save')">
          Save and switch
        </PlaygroundActionButton>
        <PlaygroundActionButton :disabled="blocked" @click="resolveStep('discard')">
          Discard and switch
        </PlaygroundActionButton>
        <PlaygroundActionButton @click="resolveStep('cancel')">
          Cancel
        </PlaygroundActionButton>
      </div>

      <p class="placement-message" role="status">{{ authoringMessage }}</p>

      <p
        class="placement-message"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ placementMessage }}
      </p>
    </template>
  </TablaPlaygroundShell>
</template>

<style scoped>
.track-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 8px 16px;
}

.track-controls button {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  padding: 6px 10px;
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: left;
  font: inherit;
  color: var(--mt-text);
  background: var(--mt-surface-2);
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-md);
}

.track-controls button[aria-pressed="true"] {
  border-color: var(--ui-primary);
}

.track-controls button:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

.fraction-readouts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  max-width: 1100px;
  margin: 8px auto;
  padding: 0;
  list-style: none;
  color: var(--mt-text);
}

.authoring-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 1100px;
  min-width: 0;
  margin: 8px auto;
  color: var(--mt-text);
}

.authoring-controls > button {
  min-width: 0;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}

.authoring-decision > p {
  flex-basis: 100%;
  margin: 0;
}

.placement-message {
  max-width: 1100px;
  margin: 8px auto;
  color: var(--mt-text);
  overflow-wrap: anywhere;
}

.placement-message:empty {
  margin: 0;
}
</style>
