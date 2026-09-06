<script setup lang="ts">
import { rodPalette } from './rodPalette'
import type { SceneRod } from './rodCatalog'
import { rodSizeStyle } from './rodStyle'
import { useGridRodDrag } from '~/composables/useGridRodDrag'
import type { Point } from './gridPointer'

const props = defineProps<{ rod: SceneRod, cellSize: number, selected: boolean, canDrop: (point: Point) => boolean }>()
const emit = defineEmits<{ select: [], rotate: [direction: 1 | -1], drop: [point: Point], rejected: [] }>()
const el = ref<HTMLElement | null>(null)
const drag = useGridRodDrag({ el, position: () => props.rod, canDrop: point => props.canDrop(point), select: () => emit('select'), drop: point => emit('drop', point), rejected: () => emit('rejected') })
watch(() => [props.rod.x, props.rod.y, props.rod.rotation, props.rod.tower, props.cellSize], drag.cancel)
const orientation = computed(() => props.rod.tower ? 'tower' : props.rod.vertical ? 'vertical' : 'horizontal')
const style = computed(() => {
  const color = rodPalette[props.rod.length]
  return {
    left: `${(drag.preview.value?.x ?? props.rod.x) * props.cellSize}px`, top: `${(drag.preview.value?.y ?? props.rod.y) * props.cellSize}px`,
    ...rodSizeStyle(props.rod.dimensions, props.cellSize),
    '--fill': color.fill, '--ink': color.ink,
  }
})
</script>

<template>
  <button
    ref="el" type="button" class="rod" :class="{ selected, 'is-dragging': drag.preview.value, 'is-invalid': drag.invalid.value }" :style="style"
    :aria-label="`${rodPalette[rod.length].name} rod, length ${rod.length}, ${orientation}`" :aria-pressed="selected"
    data-role="rod" :data-length="rod.length" :data-x="rod.x" :data-y="rod.y" :data-orientation="orientation" :data-rotation="rod.rotation"
    @pointerdown.stop="drag.down" @pointermove.stop="drag.move" @pointerup.stop="drag.up" @pointercancel.stop="drag.cancel" @lostpointercapture="drag.cancel"
    @click="emit('select')" @keydown="drag.keydown" @keydown.r.prevent.stop="emit('rotate', $event.shiftKey ? -1 : 1)">
    <span class="face bottom" />
    <span class="face front" />
    <span class="face back" />
    <span class="face left" />
    <span class="face right" />
    <span class="face top">{{ rod.length }}</span>
  </button>
</template>

<style scoped>
.rod { position: absolute; width: var(--w); height: var(--d); padding: 0; border: 0; background: none; transform: translateZ(1px); transform-style: preserve-3d; cursor: pointer; color: var(--ink); }
.face { position: absolute; left: 0; top: 0; box-sizing: border-box; border: 1px solid rgb(0 0 0 / 40%); background: var(--fill); transform-origin: 0 0; pointer-events: auto; }
.top, .bottom { width: var(--w); height: var(--d); }
.top { transform: translateZ(var(--h)); display: grid; place-items: center; font: bold 14px sans-serif; }
.bottom { background: color-mix(in srgb, var(--fill), black 35%); }
.front, .back { width: var(--w); height: var(--h); background: color-mix(in srgb, var(--fill), black 15%); }
.front { transform: translateY(var(--d)) rotateX(90deg); }
.back { transform: rotateX(90deg); }
.left, .right { width: var(--d); height: var(--h); background: color-mix(in srgb, var(--fill), black 30%); }
.left { transform: rotateZ(90deg) rotateX(90deg); }
.right { transform: translateX(var(--w)) rotateZ(90deg) rotateX(90deg); }
.selected .face, .rod:focus-visible .face { border-color: white; box-shadow: inset 0 0 0 1px white; }
.rod:focus-visible { outline: 2px solid white; outline-offset: 3px; }
.rod { touch-action: none; user-select: none; cursor: grab; }
.is-dragging { cursor: grabbing; }
.is-invalid .face { border-color: #ff4040; box-shadow: inset 0 0 0 2px #ff4040; }
</style>
