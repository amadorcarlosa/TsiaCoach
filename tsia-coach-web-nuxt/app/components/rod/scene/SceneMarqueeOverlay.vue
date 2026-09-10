<script setup lang="ts">
import type { MarqueeRect } from './scene-marquee'

defineProps<{
  rectangle: MarqueeRect | null
  cellSize: number
}>()
</script>

<template>
  <div
    v-if="rectangle"
    data-scene-marquee
    aria-hidden="true"
    class="scene-marquee"
    :style="{
      left: `${rectangle.x * cellSize}px`,
      top: `${rectangle.y * cellSize}px`,
      width: `${rectangle.width * cellSize}px`,
      height: `${rectangle.depth * cellSize}px`,
    }"
  />
</template>

<style scoped>
.scene-marquee {
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
  border: 1px solid var(--mt-text);
  background: color-mix(in srgb, var(--mt-text) 12%, transparent);
}
</style>
