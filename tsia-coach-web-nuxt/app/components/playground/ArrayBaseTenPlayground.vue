<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { baseTenTiltDegrees, baseTenProjectionExtent } from '~/components/basetenblocks/base-ten-view'
import { baseTenDimensions } from '~/components/basetenblocks/base10.types'
import GridSurface from '~/components/grid/surface/GridSurface.vue'
import PlaygroundActionButton from './PlaygroundActionButton.vue'
import BaseTenTray from '~/components/basetenblocks/BaseTenTray.vue'
import DraggableBaseTenBlock from '~/components/basetenblocks/DraggableBaseTenBlock.vue'
import BaseTenMenu from '~/components/basetenblocks/BaseTenMenu.vue'
import SceneMarqueeOverlay from '~/components/rod/scene/SceneMarqueeOverlay.vue'
import { useBaseTenScene, type BaseTenAction } from '~/composables/useBaseTenScene'
import { useBaseTenInteraction } from '~/composables/useBaseTenInteraction'
import { useBaseTenViewport } from '~/composables/useBaseTenViewport'
import { useManipulativeMenu } from '~/composables/useManipulativeMenu'
const props = withDefaults(defineProps<{ active?: boolean; cancelVersion?: () => number }>(), { active: true, cancelVersion: undefined })
const viewport = ref<HTMLElement | null>(null)
const trayOpen = ref(true)
let cancelBoard = () => {}
const projection = ref(baseTenProjectionExtent({ width: 1, depth: 1, height: 1 }))
const layout = useBaseTenViewport(viewport, () => { cancelBoard(); layout.endPan() }, projection)
const editingDisabled = computed(() => !props.active || layout.phonePortrait.value)
const scene = useBaseTenScene({ editable: () => !editingDisabled.value })
const interaction = useBaseTenInteraction({ scene, viewport, disabled: () => editingDisabled.value || layout.panMode.value, cancelVersion: () => props.cancelVersion?.() ?? 0 })
cancelBoard = interaction.cancel
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
const { choices, closeMenu } = useManipulativeMenu({ actions, scene, interaction, viewport, idAttribute: 'data-base-ten-id', exists: id => scene.blocks.value.some(block => block.id === id) })
function down(event: PointerEvent) { layout.pointerDown(event); interaction.pointerDown(event) }
function move(event: PointerEvent) { layout.pointerMove(event); interaction.pointerMove(event) }
function up(event: PointerEvent) { layout.endPan(); interaction.pointerUp(event) }
function cancel() { interaction.cancel(); layout.endPan() }
function lostCapture(event: PointerEvent) { if (event.target === viewport.value) cancel() }
watch(() => [props.active, props.cancelVersion?.()], () => layout.endPan(), { flush: 'sync' })
</script>

<template>
  <section class="base-ten-playground" aria-label="Array base-ten playground">
    <p v-if="layout.phonePortrait.value" role="status">Portrait preview. Rotate to landscape to edit.</p>
    <div class="toolbar" aria-label="Base-ten controls">
      <PlaygroundActionButton :pressed="trayOpen" @click="trayOpen = !trayOpen">{{ trayOpen ? 'Hide blocks' : 'Show blocks' }}</PlaygroundActionButton>
      <PlaygroundActionButton
v-for="choice in choices" :key="choice.label" :disabled="!choice.result.allowed || interaction.rectangle.value !== null"
        :title="choice.result.allowed ? choice.label : choice.result.reason" @click="interaction.apply(choice.action)">{{ choice.label }}</PlaygroundActionButton>
    </div>
    <BaseTenTray v-show="trayOpen" :disabled="editingDisabled" @choose="denomination => interaction.apply({ type: 'create', denomination })" />
    <div class="toolbar" aria-label="Board view">
      <PlaygroundActionButton @click="layout.zoom(36)">Rod size</PlaygroundActionButton>
      <PlaygroundActionButton @click="layout.zoom(layout.fitSize.value, true)">Fit board</PlaygroundActionButton>
      <PlaygroundActionButton :disabled="layout.cellSize.value <= layout.fitSize.value" @click="layout.zoom(layout.cellSize.value / 1.25)">Zoom out</PlaygroundActionButton>
      <PlaygroundActionButton :disabled="layout.cellSize.value >= 36" @click="layout.zoom(layout.cellSize.value * 1.25)">Zoom in</PlaygroundActionButton>
      <PlaygroundActionButton :pressed="layout.panMode.value" @click="layout.togglePan()">{{ layout.panMode.value ? 'Pan mode' : 'Select mode' }}</PlaygroundActionButton>
      <span>{{ Math.round(layout.cellSize.value / 36 * 100) }}% · 120 × 120 units</span>
    </div>
    <div
ref="viewport" class="base-ten-viewport" :class="{ panning: layout.panMode.value || layout.phonePortrait.value, detailed: layout.cellSize.value >= 6 }"
      tabindex="0" aria-label="Base-ten board viewport" :style="{ '--ten-cells': layout.cellSize.value * 10 + 'px' }"
      @pointerdown.capture="down" @pointermove="move" @pointerup="up" @pointercancel="cancel" @lostpointercapture="lostCapture" @scroll="interaction.cancel()" @keydown.esc="cancel">
      <GridSurface
:config="{ columns: 120, rows: 120, cellSize: layout.cellSize.value }" :view="{ tiltDegrees: baseTenTiltDegrees }"
        :viewport-padding="layout.padding.value" viewport-alignment="start">
        <DraggableBaseTenBlock
v-for="block in scene.blocks.value" :key="block.id" :block="block" :cell-size="layout.cellSize.value"
          :selected="interaction.highlighted.value.has(block.id)" :disabled="interaction.blocked.value" :preview-delta="interaction.previewFor(block.id)"
          :begin-move="() => interaction.beginMove(block.id)" :constrain-position="point => interaction.constrain(block.id, point)"
          @select="mode => interaction.select(block.id, mode)" @preview="point => interaction.preview(block.id, point)"
          @settled="point => interaction.settle(block.id, point)" @end="interaction.end(block.id)" @menu="point => interaction.openMenu(block.id, point)" />
        <SceneMarqueeOverlay :rectangle="interaction.rectangle.value" :cell-size="layout.cellSize.value" />
      </GridSurface>
    </div>
    <BaseTenMenu v-if="interaction.menu.value" :x="interaction.menu.value.x" :y="interaction.menu.value.y" :choices="choices" @action="closeMenu" @close="closeMenu()" />
    <p role="status" aria-live="polite">{{ scene.message.value }}</p>
    <p data-testid="base-ten-summary">{{ scene.blocks.value.length }} objects · Total value {{ scene.total.value.toLocaleString('en-US') }}</p>
  </section>
</template>

<style scoped>
.base-ten-playground { max-width: 1100px; margin-inline: auto; min-width: 0; padding: 8px; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-block: 8px; }
.toolbar :deep(button) { min-height: 44px; padding: 8px 12px; border: 1px solid var(--mt-border); border-radius: var(--radius-md); background: var(--mt-bg-elevated); color: var(--mt-text); }
.base-ten-viewport { height: clamp(240px, 65dvh, 720px); overflow: auto; width: 100%; border: 1px solid var(--mt-border); touch-action: none; overscroll-behavior: contain; overflow-anchor: none; }
.base-ten-viewport:focus-visible { outline: 2px solid var(--ui-primary); }
.panning { cursor: grab; }
.base-ten-viewport :deep([data-grid-world]) { user-select: none; }
.base-ten-viewport :deep([class*='grid-lines']) { background-size: var(--ten-cells) var(--ten-cells); }
.detailed :deep([class*='grid-lines']) {
  background-image: linear-gradient(to right, var(--mt-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--mt-grid) 1px, transparent 1px), linear-gradient(to right, #8882 1px, transparent 1px), linear-gradient(to bottom, #8882 1px, transparent 1px);
  background-size: var(--ten-cells) var(--ten-cells), var(--ten-cells) var(--ten-cells), var(--cell-size) var(--cell-size), var(--cell-size) var(--cell-size);
}
</style>

