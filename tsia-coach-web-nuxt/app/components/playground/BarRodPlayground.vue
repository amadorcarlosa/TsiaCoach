<script setup lang="ts">
import { computed } from 'vue'
import { createBarGoalAdapter } from './goals/board-goal-adapters'
import RodTabla from '~/components/tabla/RodTabla.vue'
import { getTablaGeometry } from '~/components/tabla/tabla.geometry'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import { useRodScene } from '~/composables/useRodScene'
import { useRodPlaygroundInteraction } from '~/composables/useRodPlaygroundInteraction'
import { useBoardLayout } from '~/composables/useBoardLayout'
import { usePlaygroundElementRefs } from '~/composables/usePlaygroundElementRefs'
import { useTablaWorkspace } from '~/composables/useTablaWorkspace'
import SceneRodLayer from '~/components/rod/scene/SceneRodLayer.vue'
import SceneMenu from '~/components/rod/scene/SceneMenu.vue'
import TablaPlaygroundShell from '~/components/playground/TablaPlaygroundShell.vue'
import RodPlaygroundAuthoring from '~/components/playground/RodPlaygroundAuthoring.vue'
import type { SceneMenuChoice } from '~/components/rod/scene/scene-menu.types'
import { baseRodMenuChoices, deleteMenuChoice } from '~/components/rod/scene/rod-menu-choices'
import { trainView } from '~/components/rod/scene/train-view'
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

const targetCount = 3
const fullColumns = 24
const boardDefinition = getTablaGeometry(targetCount, playgroundBoardLayout.maximumCellSize, fullColumns)

const { boardViewport, workspaceTools, setBoardViewport, setWorkspaceTools } = usePlaygroundElementRefs()

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
  topInset: () => getTablaGeometry(targetCount, cellSize.value, visibleColumns.value).topInset,
  cellSize,
  visibleColumns,
  boardPaddingY,
  phonePortrait,
  horizontalPadding: playgroundBoardLayout.horizontalPadding,
})

const editingDisabled = computed(() => !props.active || phonePortrait.value)

const scene = useRodScene({
  columns: fullColumns,
  rows: boardDefinition.config.rows,
  spawnRows: boardDefinition.targets.map(target => target.row),
  trackRows: boardDefinition.targets.map(target => target.row),
  editable: () => !editingDisabled.value,
  allowOrientation: false,
  allowFactors: false,
  requireHorizontalAnchorRow: true,
})

const controls = useRodPlaygroundInteraction({
  scene,
  viewport: boardViewport,
  disabled: () => editingDisabled.value,
  cancelVersion: () => props.cancelVersion?.() ?? 0,
})

const { menu, marquee, blocked, checkSelected, applySelected, addendMenuChoice, captureScene, replaceScene } = controls

const goalAdapter = createBarGoalAdapter({ columns: fullColumns, targetCount })
const board = { kind: 'bar', config: { columns: fullColumns, targetCount } } as const

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
  scene.apply([], { type: 'create', value })
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
    tray-id="tabla-rod-tray"
    :tray-open="trayOpen"
    :workspace-style="workspaceStyle"
    @board-lost-pointer-capture="marquee.onLostPointerCapture"
    @board-pointer-down="marquee.onPointerDown"
    @choose-rod="onChooseRod"
    @remove-selected="applySelected({ type: 'delete' })"
    @update-tray-open="trayOpen = $event"
  >
    <template #board>
      <RodTabla
        :target-count="targetCount"
        :cell-size="cellSize"
        :visible-columns="visibleColumns"
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
      </RodTabla>
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
