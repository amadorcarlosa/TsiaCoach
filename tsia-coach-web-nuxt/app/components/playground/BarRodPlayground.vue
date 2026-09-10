<script setup lang="ts">

import RodTabla from '~/components/tabla/RodTabla.vue'

import { getTablaGeometry } from '~/components/tabla/tabla.geometry'
import {
  type CuisenaireRodValue,
  CuisenaireRodValues,
  getRodDefinition,
} from '~/components/rod/rod.types'


import { useRodScene } from '~/composables/useRodScene'
import SceneRod from '~/components/rod/scene/SceneRod.vue'
import SceneMenu from '~/components/rod/scene/SceneMenu.vue'
import type {
  SceneMenuChoice,
} from '~/components/rod/scene/scene-menu.types'
import { useSceneMenu } from '~/composables/useSceneMenu'
import { trainView } from '~/components/rod/scene/train-view'

const props = withDefaults(defineProps<{
  active?: boolean
}>(), {
  active: true,
})
// This playground's board configuration.
const targetCount = 3
const fullColumns = 24
const boardDefinition = getTablaGeometry(
    targetCount,
    36,
    fullColumns,
)
const horizontalPadding = 32
const totalGridRows = boardDefinition.config.rows

// These refs connect the template's elements to layout measurement.
const boardViewport = ref<HTMLElement | null>(null)
const workspaceTools = ref<HTMLElement | null>(null)

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
  totalRows: totalGridRows,
  horizontalPadding,
  maximumCellSize: 36,
  minimumLandscapeCellSize: 24,
  bottomGap: 8,
})

// The page connects responsive sizing to tabla geometry.
const geometry = computed(() =>
    getTablaGeometry(
        targetCount,
        cellSize.value,
        visibleColumns.value,
    ),
)

const workspaceStyle = computed(() => ({
  '--grid-top-inset': `${geometry.value.topInset}px`,
  '--workspace-padding-y': `${boardPaddingY.value}px`,
}))

const rods = Object.values(CuisenaireRodValues)
    .map(getRodDefinition)

const scene = useRodScene({
  columns: fullColumns,
  rows: boardDefinition.config.rows,
  spawnRows: boardDefinition.targets.map(target => target.row),
  trackRows: boardDefinition.targets.map(target => target.row),
  editable: () => props.active && !phonePortrait.value,
  allowOrientation: false,
})
const menu = useSceneMenu({
  scene,
  viewport: boardViewport,
  disabled: () => !props.active || phonePortrait.value,
})
const interaction = useSceneInteraction({
  scene,
  blocked: () =>
      !props.active ||
      phonePortrait.value ||
      menu.request.value !== null,
})

const menuChoices: SceneMenuChoice[] = [
  { label: 'Clone', action: { type: 'clone' } },
  { label: 'Delete', action: { type: 'delete' } },
  { label: 'Make a train', action: { type: 'make-train' } },
  { label: 'Undo train', action: { type: 'ungroup' } },
]

const placedRods = computed(() =>
    scene.trains.value.map(trainView),
)

const placementMessage = scene.message

const canRemoveSelectedRod = computed(() =>
    !phonePortrait.value && scene.selection.value.size > 0,
)

function onRemoveSelectedRod(): void {
  scene.apply([...scene.selection.value], { type: 'delete' })
}


function onChooseRod(value: CuisenaireRodValue): void {
  scene.apply([], { type: 'create', value })
}


function intersectsPreview(
    piece: ReturnType<typeof trainView>,
    columns: number,
): boolean {
  return piece.x < columns && piece.x + piece.dimensions.width > 0
}


</script>

<template>
  <div class="tabla-playground">
    <p
        v-if="phonePortrait"
        class="preview-notice"
        role="status"
    >
      <strong>Portrait preview: 0–12.</strong>
      Movement is disabled. Rotate to landscape to view all
      24 columns and move rods. Rods beyond 12 are preserved.
    </p>

    <div class="workspace" :style="workspaceStyle">
      <div ref="workspaceTools" class="workspace-tools">
        <div class="workspace-toolbar">
          <button
              type="button"
              class="tray-toggle"
              :aria-expanded="trayOpen"
              aria-controls="tabla-rod-tray"
              @click="trayOpen = !trayOpen"
          >
            {{ trayOpen ? 'Hide rods' : 'Show rods' }}
          </button>
          <button
              type="button"
              class="remove-rod-button"
              :disabled="!canRemoveSelectedRod"
              @click="onRemoveSelectedRod"
          >
            Remove selected rod
          </button>
          <span
              v-if="shortLandscape"
              class="toolbar-status"
              role="status"
          >
            {{ placedRods.length }}
            {{ placedRods.length === 1 ? 'object' : 'objects' }}
            on the board
          </span>
        </div>

        <div
            v-show="!compactLayout || trayOpen"
            id="tabla-rod-tray"
            class="workspace-tray"
        >
          <RodTray
              :items="rods"
              :unit-size="16"
              :layout="compactLayout ? 'wrap' : 'vertical'"
              :disabled="phonePortrait"
              embedded
              @choose="onChooseRod"
          />
        </div>
      </div>
      <div
          ref="boardViewport"
          tabindex="-1"
          class="board-viewport"
          role="region"
          :aria-label="phonePortrait
          ? 'Rod board preview, columns zero to twelve'
          : 'Rod board, columns zero to twenty-four'"
      >
        <div
            class="board-frame"
            :style="{
            width: `${visibleColumns * cellSize + horizontalPadding}px`,
          }"
        >
          <RodTabla
              :target-count="targetCount"
              :cell-size="cellSize"
              :visible-columns="visibleColumns"
              viewport-padding="var(--workspace-padding-y) 16px"
              embedded
          >
            <template #pieces="{ cellSize: pieceCellSize }">
              <SceneRod
                  v-for="piece in placedRods"
                  v-show="
    !phonePortrait ||
    intersectsPreview(piece, visibleColumns)
  "
                  :id="piece.id"
                  :key="piece.id"
                  :value="piece.value"
                  :parts="piece.parts"
                  :dimensions="piece.dimensions"
                  :x="piece.x"
                  :y="piece.y"
                  :cell-size="pieceCellSize"
                  :selected="scene.selection.value.has(piece.id)"
                  :disabled="!props.active || phonePortrait || menu.request.value !== null"
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
            </template>
          </RodTabla>
        </div>
        <!-- End board-frame -->
      </div>
      <!-- End board-viewport -->
      <SceneMenu
          :request="menu.request.value"
          :selection="menu.selectedIds.value"
          :check="scene.check"
          :choices="menuChoices"
          @action="menu.applyAction"
          @close="menu.close"
          @restore-focus="menu.restoreFocus"
      />
      
    </div>
    <!-- End workspace -->
    <p
        class="placement-message"
        role="status"
        aria-live="polite"
        aria-atomic="true"
    >
      {{ placementMessage }}
    </p>
    <p
        v-if="!shortLandscape"
        class="position-status"
        role="status"
    >
      {{ placedRods.length }}
      {{ placedRods.length === 1 ? 'object' : 'objects' }}
      on the board
    </p>
  </div>

</template>



<style scoped>
.placement-message {
  max-width: 1100px;
  margin: 8px auto;
  color: var(--mt-text);
  overflow-wrap: anywhere;
}

.placement-message:empty {
  margin: 0;
}
.tabla-playground {
  display: block;
  min-width: 0;
  padding: 8px;
}
.workspace {
  --grid-top-inset: 0px;
  --workspace-padding-y: 24px;

  display: flex;
  align-items: stretch;
  width: 100%;
  max-width: 1100px;
  min-width: 0;
  box-sizing: border-box;
  margin-inline: auto;

  background: var(--mt-bg-elevated);
  color: var(--mt-text);
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
}
.workspace-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.remove-rod-button {
  min-height: 44px;
  max-width: 100%;
  margin: 4px;
  padding: 8px 12px;
  white-space: normal;
  font: inherit;
  color: var(--mt-text);
  background: var(--mt-surface-2);
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.remove-rod-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.remove-rod-button:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.toolbar-status {
  padding-right: 16px;
  font-size: 0.875rem;
  color: var(--mt-text-muted);
  white-space: nowrap;
}
.workspace-tools {
  flex: 0 0 auto;
  border-right: 1px solid var(--mt-border);
}

.workspace-tray {
  padding:
      calc(var(--workspace-padding-y) + var(--grid-top-inset))
      16px
      var(--workspace-padding-y);
}

.tray-toggle {
  display: none;
}

.board-viewport {
  flex: 1 1 0;
  min-width: 0;
  overflow: clip;
}

/*
 * Clip at the actual grid's horizontal edges.
 * The outer viewport contains its padded frame.
 * This wrapper sits outside the tilted 3D surface.
 */
.board-frame {
  max-width: 100%;
  margin-inline: auto;
  clip-path: inset(0 16px);
}

.preview-notice,
.position-status {
  max-width: 1100px;
  margin: 8px auto;
  color: var(--mt-text-muted);
}

.preview-notice {
  padding: 12px;
  background: var(--mt-surface-2);
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-md);
}

.tray-toggle:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: -3px;
}

@media (max-width: 1119px), (max-height: 500px) and (orientation: landscape) {
  .workspace {
    flex-direction: column;
  }

  .workspace-tools {
    width: 100%;
    min-width: 0;
    border-right: 0;
    border-bottom: 1px solid var(--mt-border);
  }

  .tray-toggle {
    display: block;
    min-height: 44px;
    padding: 8px 16px;
    border: 0;
    background: transparent;
    color: var(--mt-text);
    font: inherit;
    cursor: pointer;
  }

  .workspace-tray {
    padding: 8px 16px 16px;
  }

  .board-viewport {
    flex: none;
    width: 100%;
  }
}

@media (max-height: 500px) and (orientation: landscape) {
  .tabla-playground {
    padding: 4px;
  }

  .board-viewport {
    overflow-x: auto;
  }

  .board-frame {
    /* Preserve usable cells even when an unusually narrow screen needs scrolling. */
    max-width: none;
  }

  /* Leave room beside the inward-aligned end label at the minimum cell size. */
  .board-frame :deep(.unit-number:not(.unit-number--start):not(.unit-number--end)) {
    transform: translateX(-50%);
  }
}
</style>

