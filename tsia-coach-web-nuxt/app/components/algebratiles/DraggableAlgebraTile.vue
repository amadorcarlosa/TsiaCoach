<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useInertialBoardDrag } from '~/composables/useInertialBoardDrag'
import type { Point } from '~/components/grid/gridPointer'
import { algebraTileAppearance, algebraTileLabel, algebraTileDimensions, type AlgebraTile } from './algebra-tile.types'
import AlgebraTileVisual from './AlgebraTileVisual.vue'
import raisedPiece from '~/components/grid/raised-piece.module.css'
import { raisedPieceStyle } from '~/components/grid/raised-piece'
const props = defineProps<{
  tile: AlgebraTile; cellSize: number; selected: boolean; disabled: boolean; previewDelta?: Point
  beginMove: () => boolean; constrainPosition: (point: Point) => Point
}>()
const emit = defineEmits<{
  select: [mode: 'toggle' | 'preserve' | 'replace']; preview: [point: Point]; settled: [point: Point]; end: []; menu: [point: Point]
}>()
const element = ref<HTMLElement | null>(null)
const appearance = computed(() => algebraTileAppearance(props.tile))
const label = computed(() => algebraTileLabel(props.tile))
const dimensions = computed(() => algebraTileDimensions(props.tile))
const drag = useInertialBoardDrag({
  el: element, position: () => props.tile.anchor, cellSize: () => props.cellSize, snapToGrid: () => true,
  enabled: () => !props.disabled, onStart: () => props.beginMove(), constrainPosition: point => props.constrainPosition(point),
  onPreview: point => emit('preview', point), onSettled: point => emit('settled', point), onEnd: () => emit('end'),
})
let timer: ReturnType<typeof setTimeout> | undefined
let touch: Point | null = null
function clearTouch() { clearTimeout(timer); touch = null }
function menu() {
  clearTouch()
  if (props.disabled) return
  drag.cancel()
  const bounds = element.value!.getBoundingClientRect()
  emit('menu', { x: bounds.left, y: bounds.bottom })
}
function pointerDown(event: PointerEvent) {
  if (props.disabled || !event.isPrimary || event.button !== 0) return
  const toggle = event.shiftKey || event.ctrlKey || event.metaKey
  emit('select', toggle ? 'toggle' : 'preserve')
  if (toggle) { event.preventDefault(); event.stopImmediatePropagation(); element.value?.focus({ preventScroll: true }); return }
  if (event.pointerType === 'touch') {
    touch = { x: event.clientX, y: event.clientY }
    timer = setTimeout(menu, 550)
  }
}
function pointerMove(event: PointerEvent) { if (touch && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 8) clearTouch() }
function keydown(event: KeyboardEvent) {
  if (props.disabled) return
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); event.stopPropagation(); menu() }
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) emit('select', event.key === ' ' ? 'toggle' : 'replace') }
}
watch(() => [props.tile.rotated, props.tile.sign, props.disabled], () => { drag.cancel(); clearTouch() }, { flush: 'sync' })
onBeforeUnmount(clearTouch)
</script>

<template>
  <div
ref="element" class="algebra-tile" :class="{ selected }" :data-algebra-tile-id="tile.id" :data-term="tile.term" :data-sign="tile.sign"
    :data-x="tile.anchor.x" :data-y="tile.anchor.y" :data-rotated="tile.rotated"
    role="button" aria-roledescription="movable algebra tile" aria-haspopup="menu" :aria-disabled="disabled" :aria-pressed="selected" :tabindex="disabled ? -1 : 0"
    :aria-label="`${label} tile at column ${tile.anchor.x}, row ${tile.anchor.y}. Use arrow keys to move.`"
    :style="{ left: `${tile.anchor.x * cellSize}px`, top: `${tile.anchor.y * cellSize}px`, width: `${dimensions.width * cellSize}px`, height: `${dimensions.depth * cellSize}px`, translate: previewDelta ? `${previewDelta.x * cellSize}px ${previewDelta.y * cellSize}px` : '0px 0px' }"
    @pointerdown.capture="pointerDown" @pointermove="pointerMove" @pointerup="clearTouch" @pointercancel="clearTouch" @lostpointercapture="clearTouch"
    @keydown.capture="keydown" @contextmenu.prevent.stop="menu">
    <div :class="raisedPiece.visual" :style="raisedPieceStyle">
      <AlgebraTileVisual :dimensions="dimensions" :unit-size="cellSize" :appearance="appearance" :label="label" />
    </div>
  </div>
</template>

<style scoped>
.algebra-tile { position: absolute; transform-style: preserve-3d; touch-action: none; user-select: none; cursor: grab; }
.selected { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
.algebra-tile:focus-visible { outline: 3px dashed var(--ui-primary); outline-offset: 4px; }
</style>
