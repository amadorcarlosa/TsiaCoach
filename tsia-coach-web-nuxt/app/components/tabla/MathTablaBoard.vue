<script setup lang="ts">
import { computed } from 'vue'
import GridSurface from '~/components/grid/surface/GridSurface.vue'
import { getMathTablaGeometry } from './mathtabla.geometry'
import type { MathTablaGuide } from './mathtabla.readouts'

const props = withDefaults(defineProps<{
  columns?: number
  rows?: number
  cellSize?: number
  viewportPadding?: string
  activeRegion?: string
  guide?: MathTablaGuide | null
}>(), {
  columns: 24,
  rows: 12,
  cellSize: 36,
  viewportPadding: '16px',
  activeRegion: 'array',
  guide: null,
})

const geometry = computed(() => getMathTablaGeometry(props.columns, props.rows, props.cellSize))
</script>

<template>
  <GridSurface
    :config="geometry.config"
    :view="geometry.view"
    :show-grid="false"
    :viewport-padding="viewportPadding"
    viewport-alignment="start"
  >
    <div
      v-for="region in geometry.regions"
      :key="region.id"
      class="math-region"
      :class="{ 'math-region--active': activeRegion === region.id }"
      :data-math-region="region.id"
      :style="{
        left: `${region.x * cellSize}px`,
        top: `${region.y * cellSize}px`,
        width: `${region.width * cellSize}px`,
        height: `${region.depth * cellSize}px`,
      }"
      aria-hidden="true"
    />
    <div
      v-if="guide"
      class="denominator-guide"
      data-math-guide
      :style="{
        left: `${guide.x * cellSize}px`,
        top: `${guide.y * cellSize}px`,
        width: `${guide.width * cellSize}px`,
        height: `${guide.depth * cellSize}px`,
      }"
      aria-hidden="true"
    />
    <slot name="pieces" :cell-size="cellSize" />
  </GridSurface>
</template>

<style scoped>
.math-region {
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
  background-color: var(--mt-surface-2);
  background-image:
    linear-gradient(to right, var(--mt-grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--mt-grid) 1px, transparent 1px);
  background-size: var(--cell-size) var(--cell-size);
  border: 2px solid var(--mt-border-accent);
  box-shadow: inset 0 2px 2px var(--mt-border);
}

.math-region--active {
  background-color: var(--mt-bg-elevated);
  outline: 1px solid var(--ui-primary);
  outline-offset: -3px;
}

.denominator-guide {
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
  border: 2px dashed var(--ui-primary);
  background: color-mix(in srgb, var(--ui-primary) 8%, transparent);
}
</style>
