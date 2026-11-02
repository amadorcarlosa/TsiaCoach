<script setup lang="ts">
import { computed } from 'vue'
import type { RodProps, ZeroPlaneView } from '../rod.types'
import { rodStyle } from '../rod.types'

const props = defineProps<Omit<RodProps, 'zeroPlane'> & { view: ZeroPlaneView }>()
const negative = computed(() => props.sign === -1)
const style = computed(() => ({
  ...rodStyle(props.dimensions, props.unitSize),
  '--fill': props.appearance.fill,
  '--ink': props.appearance.ink,
  '--z-depth': `${props.view.depth}px`,
  '--label-offset': `${props.view.depth * Math.tan(props.view.tilt * Math.PI / 180)}px`,
  '--cell': `${props.unitSize}px`,
}))
</script>

<template>
  <div class="zero-rod" :class="{ negative, selected, transparent: view.transparent }" :style="style" :data-zero-sign="negative ? -1 : 1">
    <span class="hit-surface" data-rod-surface />
    <span class="cap" data-zero-face><span class="label">{{ negative ? label : `+${label}` }}</span></span>
    <span class="wall back" /><span class="wall front" />
    <span class="wall left" /><span class="wall right" />
    <span class="rim" />
  </div>
</template>

<style scoped>
.zero-rod { position: relative; width: var(--w); height: var(--d); transform-style: preserve-3d; color: var(--ink); pointer-events: none; }
/* Browser hit testing can hide negative-Z faces behind their ancestor plane.
   Project the visible face onto a transparent input surface above zero instead.
   Gestures still resolve to the original train and use measured board axes. */
.hit-surface { position: absolute; inset: 0; transform: translateY(calc(-1 * var(--label-offset))) translateZ(3px); pointer-events: auto; }
.negative .hit-surface { transform: translateY(var(--label-offset)) translateZ(3px); }
.cap { position: absolute; inset: 0; background: var(--fill); display: grid; place-items: center; border: 1px solid color-mix(in srgb, var(--fill) 65%, black); transform: translateZ(var(--z-depth)); font-weight: 650; }
.negative .cap { transform: translateZ(calc(-1 * var(--z-depth))); transform-style: preserve-3d; background: color-mix(in srgb, var(--fill) 58%, #25170f); box-shadow: inset 0 3px 5px #0006; }
.negative .label { color: white; background: #35200bf2; border: 1px solid #e9be80; padding: 1px 4px; border-radius: 3px; font-size: 12px; line-height: 1.1; transform: translateY(var(--label-offset)) translateZ(calc(var(--z-depth) + 2px)); pointer-events: none; }
.wall { position: absolute; background: color-mix(in srgb, var(--fill) 75%, black); transform-origin: 0 0; pointer-events: none; }
.front, .back { left: 0; width: 100%; height: var(--z-depth); transform: rotateX(90deg); }
.back { top: 0; } .front { top: 100%; }
.left, .right { top: 0; width: var(--z-depth); height: 100%; transform: rotateY(-90deg); }
.left { left: 0; } .right { left: 100%; }
.negative .front, .negative .back { transform: rotateX(-90deg); background: linear-gradient(var(--fill), color-mix(in srgb, var(--fill) 40%, black)); }
.negative .left, .negative .right { transform: rotateY(90deg); }
.negative.transparent .wall { background: color-mix(in srgb, var(--fill) 14%, transparent); border-inline: 1px solid color-mix(in srgb, var(--fill) 70%, white); }
.rim { position: absolute; inset: 0; border: 1px solid color-mix(in srgb, var(--fill) 60%, white); transform: translateZ(calc(var(--z-depth) + 1px)); pointer-events: none; }
.negative .rim { transform: translateZ(1px); }
.selected .rim { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
:global(.draggable-rod:focus-visible) .rim { outline: 3px dashed var(--ui-primary); outline-offset: 4px; }
</style>
