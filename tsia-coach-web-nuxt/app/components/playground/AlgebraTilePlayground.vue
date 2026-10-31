<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import GridSurface from '~/components/grid/surface/GridSurface.vue'
import AlgebraTileTray from '~/components/algebratiles/AlgebraTileTray.vue'
import DraggableAlgebraTile from '~/components/algebratiles/DraggableAlgebraTile.vue'
import SceneMarqueeOverlay from '~/components/rod/scene/SceneMarqueeOverlay.vue'
import ManipulativePlaygroundShell from '~/components/playground/manipulative/ManipulativePlaygroundShell.vue'
import ManipulativeMenu from '~/components/playground/manipulative/ManipulativeMenu.vue'
import { useAlgebraTileScene, type AlgebraTileAction } from '~/composables/useAlgebraTileScene'
import { useManipulativeInteraction } from '~/composables/useManipulativeInteraction'
import { useBoardLayout } from '~/composables/useBoardLayout'
import { useManipulativeMenu } from '~/composables/useManipulativeMenu'
import { usePlaygroundElementRefs } from '~/composables/usePlaygroundElementRefs'
import { algebraTileDimensions, type AlgebraTile } from '~/components/algebratiles/algebra-tile.types'
import { playgroundBoardLayout } from '~/components/playground/playground.types'

const props = withDefaults(defineProps<{ active?: boolean; cancelVersion?: () => number }>(), {
  active: true,
  cancelVersion: undefined,
})

const fullColumns = 24
const boardRows = 12

const { boardViewport: viewport, workspaceTools, setBoardViewport, setWorkspaceTools } = usePlaygroundElementRefs()

const { phonePortrait, trayOpen, visibleColumns, cellSize, boardPaddingY } = useBoardLayout({
  ...playgroundBoardLayout,
  boardViewport: viewport,
  workspaceTools,
  fullColumns,
  totalRows: boardRows,
})

const editingDisabled = computed(() => !props.active || phonePortrait.value)

const scene = useAlgebraTileScene({ columns: fullColumns, rows: boardRows, editable: () => !editingDisabled.value })

const interaction = useManipulativeInteraction<AlgebraTile, AlgebraTileAction>({
  scene: { ...scene, pieces: () => scene.tiles.value },
  footprint: algebraTileDimensions,
  bounds: () => ({ columns: fullColumns, rows: boardRows }),
  idAttribute: 'data-algebra-tile-id',
  viewport,
  disabled: () => editingDisabled.value,
  cancelVersion: () => props.cancelVersion?.() ?? 0,
})

const actions: { label: string; action: AlgebraTileAction }[] = [
  { label: 'Clone', action: { type: 'clone' } },
  { label: 'Rotate', action: { type: 'rotate' } },
  { label: 'Change sign', action: { type: 'flip-sign' } },
  { label: 'Remove zero pairs', action: { type: 'remove-zero-pairs' } },
  { label: 'Delete', action: { type: 'delete' } },
]

const { choices, closeMenu } = useManipulativeMenu({
  actions,
  scene,
  interaction,
  viewport,
  idAttribute: 'data-algebra-tile-id',
  exists: id => scene.tiles.value.some(tile => tile.id === id),
})

/** Portrait preview hides tiles wholly outside the visible columns. */
function visible(tile: (typeof scene.tiles.value)[number]): boolean {
  return !phonePortrait.value ||
    (tile.anchor.x < visibleColumns.value && tile.anchor.x + algebraTileDimensions(tile).width > 0)
}

function lostCapture(event: PointerEvent): void {
  if (event.target === viewport.value) interaction.cancel()
}

// A resize changes the board under a gesture; a blurred window loses the pointer.
watch([cellSize, visibleColumns], interaction.cancel, { flush: 'sync' })
onMounted(() => window.addEventListener('blur', interaction.cancel))
onBeforeUnmount(() => window.removeEventListener('blur', interaction.cancel))
</script>

<template>
  <ManipulativePlaygroundShell
    label="Algebra tile playground"
    toolbar-label="Algebra tile controls"
    tray-noun="tiles"
    tray-id="algebra-tile-tray"
    :tray-open="trayOpen"
    :choices="choices"
    :actions-disabled="interaction.rectangle.value !== null"
    :phone-portrait="phonePortrait"
    preview-notice="Portrait preview: columns 0–12. Rotate to landscape to edit."
    viewport-label="Algebra tile board viewport"
    :marquee="!editingDisabled"
    :message="scene.message.value"
    :set-viewport="setBoardViewport"
    :set-tools="setWorkspaceTools"
    @update-tray-open="trayOpen = $event"
    @action="interaction.apply"
    @pointerdown="interaction.pointerDown"
    @pointermove="interaction.pointerMove"
    @pointerup="interaction.pointerUp"
    @cancel="interaction.cancel"
    @lostpointercapture="lostCapture"
    @scroll="interaction.cancel"
  >
    <template #tray>
      <AlgebraTileTray
        :disabled="editingDisabled"
        @choose="(term, sign) => interaction.apply({ type: 'create', term, sign })"
      />
    </template>

    <template #board>
      <GridSurface
        :config="{ columns: visibleColumns, rows: boardRows, cellSize }"
        :view="{ tiltDegrees: 15 }"
        :viewport-padding="`${boardPaddingY}px 16px`"
        viewport-alignment="start"
      >
        <DraggableAlgebraTile
          v-for="tile in scene.tiles.value"
          v-show="visible(tile)"
          :key="tile.id"
          :tile="tile"
          :cell-size="cellSize"
          :selected="interaction.highlighted.value.has(tile.id)"
          :disabled="interaction.blocked.value"
          :preview-delta="interaction.previewFor(tile.id)"
          :begin-move="() => interaction.beginMove(tile.id)"
          :constrain-position="point => interaction.constrain(tile.id, point)"
          @select="mode => interaction.select(tile.id, mode)"
          @preview="point => interaction.preview(tile.id, point)"
          @settled="point => interaction.settle(tile.id, point)"
          @end="interaction.end(tile.id)"
          @menu="point => interaction.openMenu(tile.id, point)"
        />
        <SceneMarqueeOverlay
          :rectangle="interaction.rectangle.value"
          :cell-size="cellSize"
        />
      </GridSurface>
    </template>

    <template #menu>
      <ManipulativeMenu
        v-if="interaction.menu.value"
        label="Algebra tile actions"
        :x="interaction.menu.value.x"
        :y="interaction.menu.value.y"
        :choices="choices"
        @action="closeMenu"
        @close="closeMenu()"
      />
    </template>

    <template #summary>
      <p data-testid="algebra-tile-summary">
        {{ scene.tiles.value.length }} {{ scene.tiles.value.length === 1 ? 'object' : 'objects' }} · Expression: {{ scene.expression.value }}
      </p>
    </template>
  </ManipulativePlaygroundShell>
</template>
