<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import GridSurface from '~/components/grid/surface/GridSurface.vue'
import PlaygroundActionButton from './PlaygroundActionButton.vue'
import AlgebraTileTray from '~/components/algebratiles/AlgebraTileTray.vue'
import DraggableAlgebraTile from '~/components/algebratiles/DraggableAlgebraTile.vue'
import AlgebraTileMenu from '~/components/algebratiles/AlgebraTileMenu.vue'
import SceneMarqueeOverlay from '~/components/rod/scene/SceneMarqueeOverlay.vue'
import { useAlgebraTileScene, type AlgebraTileAction } from '~/composables/useAlgebraTileScene'
import { useAlgebraTileInteraction } from '~/composables/useAlgebraTileInteraction'
import { useBoardLayout } from '~/composables/useBoardLayout'
import { useManipulativeMenu } from '~/composables/useManipulativeMenu'
import { algebraTileDimensions } from '~/components/algebratiles/algebra-tile.types'
const props = withDefaults(defineProps<{ active?: boolean; cancelVersion?: () => number }>(), { active: true, cancelVersion: undefined })
const viewport = ref<HTMLElement | null>(null)
const workspaceTools = ref<HTMLElement | null>(null)
const fullColumns = 24
const boardRows = 12
const { phonePortrait, trayOpen, visibleColumns, cellSize, boardPaddingY } = useBoardLayout({
  boardViewport: viewport,
  workspaceTools,
  fullColumns,
  portraitColumns: 12,
  totalRows: boardRows,
  horizontalPadding: 32,
  maximumCellSize: 36,
  minimumLandscapeCellSize: 24,
  bottomGap: 8,
})
const editingDisabled = computed(() => !props.active || phonePortrait.value)
const scene = useAlgebraTileScene({ columns: fullColumns, rows: boardRows, editable: () => !editingDisabled.value })
const interaction = useAlgebraTileInteraction({ scene, viewport, disabled: () => editingDisabled.value, cancelVersion: () => props.cancelVersion?.() ?? 0 })
const actions: { label: string; action: AlgebraTileAction }[] = [
  { label: 'Clone', action: { type: 'clone' } },
  { label: 'Rotate', action: { type: 'rotate' } },
  { label: 'Change sign', action: { type: 'flip-sign' } },
  { label: 'Remove zero pairs', action: { type: 'remove-zero-pairs' } },
  { label: 'Delete', action: { type: 'delete' } },
]
const { choices, closeMenu } = useManipulativeMenu({ actions, scene, interaction, viewport, idAttribute: 'data-algebra-tile-id', exists: id => scene.tiles.value.some(tile => tile.id === id) })
function cancel() { interaction.cancel() }
function lostCapture(event: PointerEvent) { if (event.target === viewport.value) cancel() }
watch([cellSize, visibleColumns], cancel, { flush: 'sync' })
onMounted(() => window.addEventListener('blur', cancel))
onBeforeUnmount(() => window.removeEventListener('blur', cancel))
</script>

<template>
  <section class="algebra-tile-playground" aria-label="Algebra tile playground">
    <p v-if="phonePortrait" role="status">Portrait preview: columns 0–12. Rotate to landscape to edit.</p>
    <div ref="workspaceTools">
    <div class="toolbar" aria-label="Algebra tile controls">
      <PlaygroundActionButton :pressed="trayOpen" @click="trayOpen = !trayOpen">{{ trayOpen ? 'Hide tiles' : 'Show tiles' }}</PlaygroundActionButton>
      <PlaygroundActionButton
v-for="choice in choices" :key="choice.label" :disabled="!choice.result.allowed || interaction.rectangle.value !== null"
        :title="choice.result.allowed ? choice.label : choice.result.reason" @click="interaction.apply(choice.action)">{{ choice.label }}</PlaygroundActionButton>
    </div>
    <AlgebraTileTray v-show="trayOpen" :disabled="editingDisabled" @choose="(term, sign) => interaction.apply({ type: 'create', term, sign })" />
    </div>
    <div
ref="viewport" class="algebra-tile-viewport" :class="{ 'marquee-enabled': !editingDisabled }"
      tabindex="0" aria-label="Algebra tile board viewport"
      @pointerdown.capture="interaction.pointerDown" @pointermove="interaction.pointerMove" @pointerup="interaction.pointerUp" @pointercancel="cancel" @lostpointercapture="lostCapture" @scroll="interaction.cancel()" @keydown.esc="cancel">
      <GridSurface
:config="{ columns: visibleColumns, rows: boardRows, cellSize }" :view="{ tiltDegrees: 15 }"
        :viewport-padding="`${boardPaddingY}px 16px`" viewport-alignment="start">
        <DraggableAlgebraTile
v-for="tile in scene.tiles.value" v-show="!phonePortrait || (tile.anchor.x < visibleColumns && tile.anchor.x + algebraTileDimensions(tile).width > 0)" :key="tile.id" :tile="tile" :cell-size="cellSize"
          :selected="interaction.highlighted.value.has(tile.id)" :disabled="interaction.blocked.value" :preview-delta="interaction.previewFor(tile.id)"
          :begin-move="() => interaction.beginMove(tile.id)" :constrain-position="point => interaction.constrain(tile.id, point)"
          @select="mode => interaction.select(tile.id, mode)" @preview="point => interaction.preview(tile.id, point)"
          @settled="point => interaction.settle(tile.id, point)" @end="interaction.end(tile.id)" @menu="point => interaction.openMenu(tile.id, point)" />
        <SceneMarqueeOverlay :rectangle="interaction.rectangle.value" :cell-size="cellSize" />
      </GridSurface>
    </div>
    <AlgebraTileMenu v-if="interaction.menu.value" :x="interaction.menu.value.x" :y="interaction.menu.value.y" :choices="choices" @action="closeMenu" @close="closeMenu()" />
    <p role="status" aria-live="polite">{{ scene.message.value }}</p>
    <p data-testid="algebra-tile-summary">{{ scene.tiles.value.length }} objects · Expression: {{ scene.expression.value }}</p>
  </section>
</template>

<style scoped>
.algebra-tile-playground { max-width: 1100px; margin-inline: auto; min-width: 0; padding: 8px; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-block: 8px; }
.toolbar :deep(button) { min-height: 44px; padding: 8px 12px; border: 1px solid var(--mt-border); border-radius: var(--radius-md); background: var(--mt-bg-elevated); color: var(--mt-text); }
.algebra-tile-viewport { width: 100%; min-width: 0; }
.algebra-tile-viewport:focus-visible { outline: 2px solid var(--ui-primary); }
.marquee-enabled :deep([data-grid-world]) { touch-action: none; user-select: none; }
</style>
