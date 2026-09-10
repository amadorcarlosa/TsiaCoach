<script setup lang="ts">
import { computed, ref } from 'vue'
import ArrayRodTabla from '~/components/tabla/ArrayRodTabla.vue'
import RodTray from '~/components/rod/tray/RodTray.vue'
import SceneRod from '~/components/rod/scene/SceneRod.vue'
import SceneMenu from '~/components/rod/scene/SceneMenu.vue'
import {
  CuisenaireRodValues,
  getRodDefinition,
  type CuisenaireRodValue,
} from '~/components/rod/rod.types'
import {
  arrayRodDimensions,
  arrayRodOrientations,
  type ArrayRodOrientation,
} from '~/components/rod/array/array-rod.types'

import type { SceneMenuChoice } from '~/components/rod/scene/scene-menu.types'
import { useRodScene } from '~/composables/useRodScene'
import { useSceneMenu } from '~/composables/useSceneMenu'
import { useBoardLayout } from '~/composables/useBoardLayout'

const props = withDefaults(defineProps<{
  active?: boolean
}>(), {
  active: true,
})

const fullColumns = 24
const boardRows = 12

const boardViewport = ref<HTMLElement | null>(null)
const workspaceTools = ref<HTMLElement | null>(null)

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

const scene = useRodScene({
  columns: fullColumns,
  rows: boardRows,
  spawnRows: Array.from({ length: boardRows }, (_, row) => row),
  editable: () => props.active && !phonePortrait.value,
  allowOrientation: true,
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
const message = scene.message

const trayItems = Object.values(CuisenaireRodValues)
    .map(getRodDefinition)

// Adapter for the current one-part-train milestone.
const renderedPieces = computed(() =>
  scene.trains.value.map(train => {
    const part = train.parts[0]!

    return {
      id: train.id,
      value: part.value,
      orientation: part.orientation,
      x: train.anchor.x + part.offset.x,
      y: train.anchor.y + part.offset.y,
      dimensions: arrayRodDimensions(
        part.value,
        part.orientation,
      ),
    }
  }),
)

const selectedRod = computed(() => {
  if (scene.selection.value.size !== 1) return undefined

  return renderedPieces.value.find(
    piece => scene.selection.value.has(piece.id),
  )
})

const canEditSelection = computed(() =>
  scene.check(menu.selectedIds.value, { type: 'delete' }).allowed,
)

const menuChoices = computed<SceneMenuChoice[]>(() => [
  { label: 'Clone', action: { type: 'clone' } },
  ...arrayRodOrientations.map(orientation => ({
    label: orientation[0]!.toUpperCase() + orientation.slice(1),
    action: {
      type: 'set-orientation' as const,
      orientation,
    },
    checked: selectedRod.value?.orientation === orientation,
  })),
  { label: 'Delete', action: { type: 'delete' } },
])

function onChoose(value: CuisenaireRodValue): void {
  const previousIds = new Set(
    scene.trains.value.map(train => train.id),
  )

  const result = scene.apply([], { type: 'create', value })
  if (!result.allowed) return

  // Preserve the array playground's select-on-create behavior.
  const created = scene.trains.value.find(
    train => !previousIds.has(train.id),
  )
  if (created) scene.select([created.id])
}



function onOrient(orientation: ArrayRodOrientation): void {
  scene.apply(menu.selectedIds.value, {
    type: 'set-orientation',
    orientation,
  })
}

function onRemove(): void {
  scene.apply(menu.selectedIds.value, { type: 'delete' })
}
</script>

<template>
  <div class="array-playground">
    <p v-if="phonePortrait" role="status">
      Portrait preview: columns 0–12. Rotate to landscape to edit.
    </p>

    <div ref="workspaceTools">
      <div class="array-toolbar" aria-label="Array rod controls">
        <button
            type="button"
            :aria-expanded="trayOpen"
            aria-controls="array-rod-tray"
            @click="trayOpen = !trayOpen"
        >
          {{ trayOpen ? 'Hide rods' : 'Show rods' }}
        </button>

        <button
            v-for="orientation in arrayRodOrientations"
            :key="orientation"
            type="button"
            :disabled="!scene.check(menu.selectedIds.value, {
              type: 'set-orientation',
              orientation,
            }).allowed"
            :aria-pressed="selectedRod?.orientation === orientation"
            @click="onOrient(orientation)"
        >
          {{ orientation }}
        </button>

        <button
            type="button"
            :disabled="!canEditSelection"
            @click="onRemove"
        >
          Remove selected rod
        </button>
      </div>

      <div v-show="trayOpen" id="array-rod-tray">
        <RodTray
            :items="trayItems"
            :unit-size="16"
            :disabled="phonePortrait"
            layout="wrap"
            embedded
            @choose="onChoose"
        />
      </div>
    </div>

    <div ref="boardViewport" class="array-viewport" tabindex="-1">
      <ArrayRodTabla
          :rows="boardRows"
          :visible-columns="visibleColumns"
          :cell-size="cellSize"
          :viewport-padding="`${boardPaddingY}px 16px`"
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
              :x="piece.x"
              :y="piece.y"
              :dimensions="piece.dimensions"
              :cell-size="pieceCellSize"
              :selected="scene.selection.value.has(piece.id)"
              :disabled="!props.active || phonePortrait || menu.request.value !== null"
              :snap-to-grid="true"
              :begin-move="() => interaction.beginMove(piece.id)"
              :preview-delta="interaction.previewFor(piece.id)"
              @select="interaction.select(piece.id, $event)"
              @move-preview="interaction.previewMove(piece.id, $event)"
              @settled="interaction.settleMove(piece.id, $event)"
              @move-end="interaction.endMove(piece.id)"
              @menu-request="menu.open"
          />
        </template>
      </ArrayRodTabla>
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

    <p role="status" aria-live="polite">{{ message }}</p>
    <p>{{ renderedPieces.length }} rods on the board</p>
  </div>
</template>

<style scoped>
.array-playground {
  max-width: 1100px;
  min-width: 0;
  margin-inline: auto;
  padding: 8px;
}

.array-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-block: 8px;
}

.array-toolbar button {
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-md);
  color: var(--mt-text);
  background: var(--mt-bg-elevated);
  font: inherit;
  text-transform: capitalize;
  cursor: pointer;
}

.array-toolbar button[aria-pressed="true"] {
  border-color: var(--ui-primary);
}

.array-toolbar button:disabled {
  opacity: 0.5;
  cursor: default;
}

.array-toolbar button:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

.array-viewport {
  width: 100%;
  min-width: 0;
}
</style>
