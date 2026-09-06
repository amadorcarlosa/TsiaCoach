<script setup lang="ts">
const props = withDefaults(defineProps<{ cols?: number, rows?: number, tallest?: number }>(), { cols: 24
  , rows: 12, tallest: 0 })
const viewport = ref<HTMLElement | null>(null)
const size = ref({ width: 800, height: 480 })
const ready = ref(false)
const DEFAULT_PITCH = 25
const DEFAULT_YAW = 0
const pitch = ref(DEFAULT_PITCH)
const yaw = ref(DEFAULT_YAW)
const adjusting = ref(false)
const zoom = ref(1)
const valid = computed(() => [props.cols, props.rows].every(value => Number.isInteger(value) && value > 0 && value <= 100))
let observer: ResizeObserver | undefined
let drag: { x: number, y: number, pitch: number, yaw: number } | null = null
const worldStyle = computed(() => {
  const radians = Math.PI / 180
  const cos = Math.abs(Math.cos(yaw.value * radians))
  const sin = Math.abs(Math.sin(yaw.value * radians))
  const boardWidth = (props.cols * cos + props.rows * sin) * 28
  const boardHeight = (props.cols * sin + props.rows * cos) * 28 * Math.cos(pitch.value * radians)
  const height = props.tallest * 28
  const rise = height * Math.sin(pitch.value * radians)
  const fit = Math.min((size.value.width - 40) / boardWidth, (size.value.height - 50) / (boardHeight + rise))
  return {
    width: `${props.cols * 28}px`, height: `${props.rows * 28}px`,
    transform: `translate(-50%, -50%) translateY(${rise * fit * zoom.value / 2}px) scale(${fit * zoom.value}) rotateX(${pitch.value}deg) rotateZ(${yaw.value}deg)`,
  }
})
function depthView() { pitch.value = DEFAULT_PITCH; yaw.value = DEFAULT_YAW; adjusting.value = false; drag = null }
function reset() { depthView(); zoom.value = 1 }
function toggleAdjust() { adjusting.value = !adjusting.value; drag = null }
function begin(event: PointerEvent) {
  if (!adjusting.value || event.button !== 0 || !event.isPrimary || (event.target as Element).closest('button')) return
  drag = { x: event.clientX, y: event.clientY, pitch: pitch.value, yaw: yaw.value }
  viewport.value?.setPointerCapture(event.pointerId)
}
function move(event: PointerEvent) {
  if (!drag) return
  yaw.value = drag.yaw + (event.clientX - drag.x) * .4
  pitch.value = Math.max(0, Math.min(80, drag.pitch - (event.clientY - drag.y) * .3))
}
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) size.value = { width: entry.contentRect.width, height: entry.contentRect.height }
  })
  if (viewport.value) observer.observe(viewport.value)
  ready.value = true
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <section class="grid-3d" aria-label="3D grid" :data-ready="ready">
    <div class="toolbar">
      <span>{{ cols }} × {{ rows }} · 1 square = 1 unit</span>
      <button type="button" @click="depthView">Depth view</button>
      <button type="button" @click="pitch = 0; yaw = 0; adjusting = false; drag = null">Top view</button>
      <button type="button" :aria-pressed="adjusting" @click="toggleAdjust">Adjust view</button>
      <button type="button" aria-label="Zoom out" :disabled="zoom <= .5" @click="zoom -= .25">−</button>
      <button type="button" aria-label="Zoom in" :disabled="zoom >= 2" @click="zoom += .25">+</button>
      <button type="button" @click="reset">Reset view</button>
    </div>
    <div ref="viewport" class="viewport" :class="{ 'is-adjusting': adjusting }" data-role="viewport" @pointerdown="begin" @pointermove="move" @pointerup="drag = null" @pointercancel="drag = null" @lostpointercapture="drag = null">
      <div v-if="valid" class="world" data-grid-world :style="worldStyle" role="group" :aria-label="`${cols} by ${rows} CSS grid`">
        <i class="axis" data-grid-axis="origin" aria-hidden="true" />
        <i class="axis" data-grid-axis="x" style="left: 28px" aria-hidden="true" />
        <i class="axis" data-grid-axis="y" style="top: 28px" aria-hidden="true" />
        <div class="floor" aria-hidden="true" />
        <slot />
      </div>
    </div>
    <p v-if="!valid" role="alert">Grid dimensions must be whole numbers between 1 and 100.</p>
    <p v-else>{{ adjusting ? 'Drag empty space to adjust the view' : 'View locked · Drag rods to move them' }} · Use + and − to zoom</p>
  </section>
</template>

<style scoped>
.grid-3d { border: 1px solid #aec4d5; border-radius: 12px; background: #e5edf5; color: #173b57; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 16px; }
.toolbar span { margin-right: auto; }
button { border: 1px solid #829eb4; border-radius: 6px; padding: 6px 12px; background: white; cursor: pointer; }
button:focus-visible { outline: 3px solid #22557d; outline-offset: 3px; }
.viewport { position: relative; overflow: hidden; height: clamp(360px, 65vh, 680px); width: 100%; touch-action: none; }
.viewport.is-adjusting { cursor: grab; }
button[aria-pressed="true"] { background: #22557d; color: white; }
.world { position: absolute; left: 50%; top: 50%; transform-style: preserve-3d; }
.axis { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; }
.floor { position: absolute; inset: 0; background-color: #22557d; background-image: linear-gradient(90deg, #b9d4e7 1px, transparent 1px), linear-gradient(#b9d4e7 1px, transparent 1px); background-size: 28px 28px; border: 1px solid #b9d4e7; }
p { margin: 0; padding: 16px; font-size: 14px; }
</style>
