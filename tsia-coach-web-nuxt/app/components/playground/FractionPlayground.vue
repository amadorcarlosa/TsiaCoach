<script setup lang="ts">
import { computed, ref } from 'vue'
import { createFractionGoalAdapter } from './goals/board-goal-adapters'
import FractionRodTabla from '~/components/tabla/FractionRodTabla.vue'
import { getFractionTablaGeometry } from '~/components/tabla/fraction-tabla.geometry'
import { fractionReadout } from '~/components/tabla/fraction-readout'
import type { Point } from '~/components/grid/gridPointer'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import { useRodScene } from '~/composables/useRodScene'
import { useRodPlaygroundInteraction } from '~/composables/useRodPlaygroundInteraction'
import { useBoardLayout } from '~/composables/useBoardLayout'
import { usePlaygroundElementRefs } from '~/composables/usePlaygroundElementRefs'
import SceneRodLayer from '~/components/rod/scene/SceneRodLayer.vue'
import SceneMenu from '~/components/rod/scene/SceneMenu.vue'
import TablaPlaygroundShell from '~/components/playground/TablaPlaygroundShell.vue'
import RodPlaygroundAuthoring from '~/components/playground/RodPlaygroundAuthoring.vue'
import type { SceneMenuChoice } from '~/components/rod/scene/scene-menu.types'
import { trainView } from '~/components/rod/scene/train-view'
import { baseRodMenuChoices, deleteMenuChoice } from '~/components/rod/scene/rod-menu-choices'
import { useTablaWorkspace } from '~/composables/useTablaWorkspace'
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

const pairCount = 2
const fullColumns = 24

const boardDefinition = getFractionTablaGeometry(pairCount, playgroundBoardLayout.maximumCellSize, fullColumns)

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
  ...playgroundBoardLayout,
  boardViewport,
  workspaceTools,
  fullColumns,
  totalRows: boardDefinition.config.rows,
})

const { workspaceStyle, boardWidth, boardAriaLabel } = useTablaWorkspace({
  topInset: () => getFractionTablaGeometry(pairCount, cellSize.value, visibleColumns.value).topInset,
  cellSize,
  visibleColumns,
  boardPaddingY,
  phonePortrait,
  horizontalPadding: playgroundBoardLayout.horizontalPadding,
})

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
  requireHorizontalAnchorRow: true,
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

const goalAdapter = createFractionGoalAdapter({ columns: fullColumns, pairCount })
const board = { kind: 'fraction', config: { columns: fullColumns, pairCount } } as const

defineExpose<RodPlaygroundExposed>({ capture: () => ({ board, trains: captureScene() }), clear: () => replaceScene([]) })

const menuChoices = computed<SceneMenuChoice[]>(() => [
  ...baseRodMenuChoices(addendMenuChoice.value),
  deleteMenuChoice,
])

const placedRods = computed(() => scene.trains.value.map(trainView))

function onChooseRod(value: CuisenaireRodValue): void {
  if (blocked.value) return

  // Deliberately no select-after-create (unlike Array/MathTabla): there is no
  // orientation to apply, and keeping the selection lets tray rods join a pending train.
  scene.apply([], {
    type: 'create',
    value,
    row: activeRow.value,
  })
}
</script>

<template>
  <TablaPlaygroundShell
    :board-aria-label="boardAriaLabel"
    :board-width="boardWidth"
    :blocked="blocked"
    :compact-layout="compactLayout"
    :editing-disabled="editingDisabled"
    :message="scene.message.value"
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
    @remove-selected="applySelected({ type: 'delete' })"
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
          <span v-if="track.total > 0">
            : {{ track.total }}
          </span>
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
          <SceneRodLayer
            :pieces="placedRods"
            :cell-size="pieceCellSize"
            :controls="controls"
            :clip-columns="phonePortrait ? visibleColumns : null"
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
          <span v-else>
            incomplete
          </span>
        </li>
      </ul>

      <RodPlaygroundAuthoring
        v-if="showAuthoring"
        :board="board"
        :goal-adapter="goalAdapter"
        :scene="scene"
        :capture-scene="captureScene"
        :replace-scene="replaceScene"
        :blocked="() => blocked"
        :editing-disabled="() => editingDisabled"
      />
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
</style>
