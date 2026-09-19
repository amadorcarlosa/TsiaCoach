<script setup lang="ts">
import { computed } from 'vue'
import type { BaseTenProps } from './base10.types'
import { baseTenHeightLean, baseTenTiltDegrees, isUprightHundred } from './base-ten-view'

const props = defineProps<BaseTenProps>()
const labelFace = computed(() => {
  const { width, depth, height } = props.dimensions
  if (height > depth && width >= depth) return 'front'
  // In the edge-on pose the side face is too foreshortened for readable text.
  // Keep the value on the cap instead of distorting it along that face.
  return 'top'
})
const style = computed(() => {
  const { width, depth, height } = props.dimensions
  // Give upright hundreds thickness while anchoring their front floor edge.
  const uprightHundred = isUprightHundred(props.dimensions)
  const extraWidth = uprightHundred && width === 1 ? 0.5 : 0
  const extraDepth = uprightHundred && depth === 1 ? 0.5 : 0
  // Project the thin cap backward and right, rather than as a vertical strip.
  // Compensate at the front edge so the broad face and its grid anchor stay put.
  const capX = uprightHundred && depth === 1 ? -0.6 : 0
  const capY = uprightHundred && depth === 1 ? 0.8 : 1
  // All three faces share this affine projection. Compensate for the board's
  // tilt so the upright hundred has vertical edges and a square front.
  const tilt = baseTenTiltDegrees * Math.PI / 180
  const heightX = uprightHundred ? 0 : baseTenHeightLean.x
  const heightY = uprightHundred
    ? (Math.sin(tilt) - 1) / Math.cos(tilt)
    : baseTenHeightLean.y
  const offsetX = -extraWidth - capX * (depth + extraDepth)
  const offsetY = depth - capY * (depth + extraDepth)
  return {
  '--w': `${(width + extraWidth) * props.unitSize}px`,
  '--d': `${(depth + extraDepth) * props.unitSize}px`,
  '--x-unit': `${(1 + extraWidth) * props.unitSize}px`,
  '--y-unit': `${(1 + extraDepth) * props.unitSize}px`,
  '--h': `${props.dimensions.height * props.unitSize}px`,
  '--unit': `${props.unitSize}px`,
  '--fill': props.appearance.fill,
  '--ink': props.appearance.ink,
  '--projection': `translate(${offsetX * props.unitSize}px, ${offsetY * props.unitSize}px) matrix3d(1,0,0,0, ${capX},${capY},0,0, ${heightX},${heightY},1,0, 0,0,0,1)`,
  }
})
</script>

<template>
  <div class="base-ten-visual" :class="{ marked: unitSize >= 6 }" :style="style" aria-hidden="true">
    <div class="rod">
      <span v-for="face in ['front', 'right', 'top']" :key="face" class="face" :class="face">
        <span v-if="labelFace === face" class="value-label">{{ label }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.base-ten-visual { position: relative; transform-style: preserve-3d; pointer-events: none; }
.rod { position: relative; width: var(--w); height: var(--d); transform-origin: 0 0; transform: var(--projection); transform-style: preserve-3d; }
.face {
  position: absolute;
  inset: 0 auto auto 0;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  transform-origin: 0 0;
  pointer-events: auto;
  background-color: var(--fill);
  border: 1px solid color-mix(in srgb, var(--ink) 48%, transparent);
  box-shadow: inset 0 0 0 1px #ffffff24;
}
.marked .face {
  background-image: linear-gradient(to right, #3d20004a 1px, transparent 1px), linear-gradient(to bottom, #3d20004a 1px, transparent 1px);
  background-size: var(--unit) var(--unit);
}
.top { width: var(--w); height: var(--d); transform: translateZ(var(--h)); background-color: color-mix(in srgb, var(--fill) 87%, white); }
.front { width: var(--w); height: var(--h); transform: translate3d(0, var(--d), var(--h)) rotateX(-90deg); }
.right { width: var(--d); height: var(--h); transform: translate3d(var(--w), 0, var(--h)) rotateY(-90deg) rotateZ(90deg); background-color: color-mix(in srgb, var(--fill) 78%, #3d2000); }
.value-label {
  color: var(--ink);
  font: 650 clamp(9px, calc(var(--unit) * .5), 18px)/1.2 var(--font-sans, sans-serif);
  font-variant-numeric: tabular-nums;
  padding: .15em .3em;
  border-radius: 3px;
  background: color-mix(in srgb, var(--fill) 85%, white);
  box-shadow: 0 0 0 1px #3d200024;
  pointer-events: none;
}
.marked .top { background-size: var(--x-unit) var(--y-unit); }
.marked .front { background-size: var(--x-unit) var(--unit); }
.marked .right { background-size: var(--y-unit) var(--unit); }
.top .value-label { font-size: clamp(9px, calc(var(--unit) * .42), 16px); }
</style>
