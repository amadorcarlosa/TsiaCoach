<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { baseTenTiltDegrees, baseTenProjectionExtent } from '~/components/basetenblocks/base-ten-view'
import { baseTenDimensions, type BaseTenBlock } from '~/components/basetenblocks/base10.types'
import GridSurface from '~/components/grid/surface/GridSurface.vue'
import PlaygroundActionButton from './PlaygroundActionButton.vue'
import BaseTenTray from '~/components/basetenblocks/BaseTenTray.vue'
import DraggableBaseTenBlock from '~/components/basetenblocks/DraggableBaseTenBlock.vue'
import SceneMarqueeOverlay from '~/components/rod/scene/SceneMarqueeOverlay.vue'
import ManipulativePlaygroundShell from '~/components/playground/manipulative/ManipulativePlaygroundShell.vue'
import ManipulativeMenu from '~/components/playground/manipulative/ManipulativeMenu.vue'
import { useBaseTenScene, type BaseTenAction } from '~/composables/useBaseTenScene'
import { useManipulativeInteraction } from '~/composables/useManipulativeInteraction'
import { useBaseTenViewport } from '~/composables/useBaseTenViewport'
import { useManipulativeMenu } from '~/composables/useManipulativeMenu'
import { usePlaygroundElementRefs } from '~/composables/usePlaygroundElementRefs'

const props = withDefaults(defineProps<{ active?: boolean; cancelVersion?: () => number }>(), {
  active: true,
  cancelVersion: undefined,
})

const boardSize = 120
// Cell size at which one unit block matches a rod-sized cell (the "Rod size" zoom).
const rodCellSize = 36

const { boardViewport: viewport, setBoardViewport } = usePlaygroundElementRefs()
const trayOpen = ref(true)

// The viewport must cancel board gestures, but the interaction is created after it.
let cancelBoard = () => {}
const projection = ref(baseTenProjectionExtent({ width: 1, depth: 1, height: 1 }))
const layout = useBaseTenViewport(viewport, () => {
  cancelBoard()
  layout.endPan()
}, projection)

const editingDisabled = computed(() => !props.active || layout.phonePortrait.value)
const scene = useBaseTenScene({ columns: boardSize, rows: boardSize, editable: () => !editingDisabled.value })

const interaction = useManipulativeInteraction<BaseTenBlock, BaseTenAction>({
  scene: { ...scene, pieces: () => scene.blocks.value },
  footprint: baseTenDimensions,
  bounds: () => ({ columns: boardSize, rows: boardSize }),
  idAttribute: 'data-base-ten-id',
  viewport,
  disabled: () => editingDisabled.value || layout.panMode.value,
  cancelVersion: () => props.cancelVersion?.() ?? 0,
})
cancelBoard = interaction.cancel

// Padding must fit the tallest block's projection, so towers never clip.
watch(() => scene.blocks.value.map(block => baseTenProjectionExtent(baseTenDimensions(block))), extents => {
  const minimum = baseTenProjectionExtent({ width: 1, depth: 1, height: 1 })
  const rise = Math.max(minimum.rise, ...extents.map(extent => extent.rise))
  const side = Math.max(minimum.side, ...extents.map(extent => extent.side))
  if (rise !== projection.value.rise || side !== projection.value.side) projection.value = { rise, side }
}, { flush: 'sync' })

const actions: { label: string; action: BaseTenAction }[] = [
  { label: 'Clone', action: { type: 'clone' } },
  { label: 'Stand upright', action: { type: 'set-pose', pose: 'tower' } },
  { label: 'Lay flat', action: { type: 'set-pose', pose: 'standard' } },
  { label: 'Rotate', action: { type: 'rotate' } },
  { label: 'Exchange up', action: { type: 'exchange-up' } },
  { label: 'Exchange down', action: { type: 'exchange-down' } },
  { label: 'Delete', action: { type: 'delete' } },
]

const { choices, closeMenu } = useManipulativeMenu({
  actions,
  scene,
  interaction,
  viewport,
  idAttribute: 'data-base-ten-id',
  exists: id => scene.blocks.value.some(block => block.id === id),
})

// Pan mode and marquee share the pointer stream; each ignores what is not its own.
function down(event: PointerEvent): void {
  layout.pointerDown(event)
  interaction.pointerDown(event)
}

function move(event: PointerEvent): void {
  layout.pointerMove(event)
  interaction.pointerMove(event)
}

function up(event: PointerEvent): void {
  layout.endPan()
  interaction.pointerUp(event)
}

function cancel(): void {
  interaction.cancel()
  layout.endPan()
}

function lostCapture(event: PointerEvent): void {
  if (event.target === viewport.value) cancel()
}

watch(() => [props.active, props.cancelVersion?.()], () => layout.endPan(), { flush: 'sync' })
</script>

<template>
  <ManipulativePlaygroundShell
    class="base-ten-playground"
    label="Array base-ten playground"
    toolbar-label="Base-ten controls"
    tray-noun="blocks"
    tray-id="base-ten-tray"
    :tray-open="trayOpen"
    :choices="choices"
    :actions-disabled="interaction.rectangle.value !== null"
    :phone-portrait="layout.phonePortrait.value"
    preview-notice="Portrait preview. Rotate to landscape to edit."
    viewport-label="Base-ten board viewport"
    :viewport-class="['base-ten-viewport', {
      panning: layout.panMode.value || layout.phonePortrait.value,
      detailed: layout.cellSize.value >= 6,
    }]"
    :viewport-style="{ '--ten-cells': layout.cellSize.value * 10 + 'px' }"
    :message="scene.message.value"
    :set-viewport="setBoardViewport"
    @update-tray-open="trayOpen = $event"
    @action="interaction.apply"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="up"
    @cancel="cancel"
    @lostpointercapture="lostCapture"
    @scroll="interaction.cancel"
  >
    <template #tray>
      <BaseTenTray
        :disabled="editingDisabled"
        @choose="denomination => interaction.apply({ type: 'create', denomination })"
      />
    </template>

    <template #before-board>
      <div
        class="toolbar"
        role="toolbar"
        aria-label="Board view"
      >
        <PlaygroundActionButton @click="layout.zoom(rodCellSize)">
          Rod size
        </PlaygroundActionButton>
        <PlaygroundActionButton @click="layout.zoom(layout.fitSize.value, true)">
          Fit board
        </PlaygroundActionButton>
        <PlaygroundActionButton
          :disabled="layout.cellSize.value <= layout.fitSize.value"
          @click="layout.zoom(layout.cellSize.value / 1.25)"
        >
          Zoom out
        </PlaygroundActionButton>
        <PlaygroundActionButton
          :disabled="layout.cellSize.value >= rodCellSize"
          @click="layout.zoom(layout.cellSize.value * 1.25)"
        >
          Zoom in
        </PlaygroundActionButton>
        <PlaygroundActionButton
          :pressed="layout.panMode.value"
          @click="layout.togglePan()"
        >
          {{ layout.panMode.value ? 'Pan mode' : 'Select mode' }}
        </PlaygroundActionButton>
        <span>{{ Math.round(layout.cellSize.value / rodCellSize * 100) }}% · {{ boardSize }} × {{ boardSize }} units</span>
      </div>
    </template>

    <template #board>
      <GridSurface
        :config="{ columns: boardSize, rows: boardSize, cellSize: layout.cellSize.value }"
        :view="{ tiltDegrees: baseTenTiltDegrees }"
        :viewport-padding="layout.padding.value"
        viewport-alignment="start"
      >
        <DraggableBaseTenBlock
          v-for="block in scene.blocks.value"
          :key="block.id"
          :block="block"
          :cell-size="layout.cellSize.value"
          :selected="interaction.highlighted.value.has(block.id)"
          :disabled="interaction.blocked.value"
          :preview-delta="interaction.previewFor(block.id)"
          :begin-move="() => interaction.beginMove(block.id)"
          :constrain-position="point => interaction.constrain(block.id, point)"
          @select="mode => interaction.select(block.id, mode)"
          @preview="point => interaction.preview(block.id, point)"
          @settled="point => interaction.settle(block.id, point)"
          @end="interaction.end(block.id)"
          @menu="point => interaction.openMenu(block.id, point)"
        />
        <SceneMarqueeOverlay
          :rectangle="interaction.rectangle.value"
          :cell-size="layout.cellSize.value"
        />
      </GridSurface>
    </template>

    <template #menu>
      <ManipulativeMenu
        v-if="interaction.menu.value"
        label="Base-ten actions"
        :x="interaction.menu.value.x"
        :y="interaction.menu.value.y"
        :choices="choices"
        @action="closeMenu"
        @close="closeMenu()"
      />
    </template>

    <template #summary>
      <p data-testid="base-ten-summary">
        {{ scene.blocks.value.length }} {{ scene.blocks.value.length === 1 ? 'object' : 'objects' }} · Total value {{ scene.total.value.toLocaleString('en-US') }}
      </p>
    </template>
  </ManipulativePlaygroundShell>
</template>

<style scoped>
/* The viewport lives inside the shell, so these reach it through :deep. */
.base-ten-playground :deep(.base-ten-viewport) {
  height: clamp(240px, 65dvh, 720px);
  overflow: auto;
  border: 1px solid var(--mt-border);
  touch-action: none;
  overscroll-behavior: contain;
  overflow-anchor: none;
}

.base-ten-playground :deep(.panning) {
  cursor: grab;
}

.base-ten-playground :deep(.base-ten-viewport [data-grid-world]) {
  user-select: none;
}

.base-ten-playground :deep(.base-ten-viewport [class*='grid-lines']) {
  background-size: var(--ten-cells) var(--ten-cells);
}

.base-ten-playground :deep(.detailed [class*='grid-lines']) {
  background-image:
    linear-gradient(to right, var(--mt-grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--mt-grid) 1px, transparent 1px),
    linear-gradient(to right, #8882 1px, transparent 1px),
    linear-gradient(to bottom, #8882 1px, transparent 1px);
  background-size:
    var(--ten-cells) var(--ten-cells),
    var(--ten-cells) var(--ten-cells),
    var(--cell-size) var(--cell-size),
    var(--cell-size) var(--cell-size);
}
</style>
