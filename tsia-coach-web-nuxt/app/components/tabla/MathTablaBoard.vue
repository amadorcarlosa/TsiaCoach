<script setup lang="ts">
import { computed } from 'vue'
import GridSurface from '~/components/grid/surface/GridSurface.vue'
import { getMathTablaGeometry } from './mathtabla.geometry'
import { areaGroupPartitions, type AreaGrouping } from './area-grouping'
import type { MathTablaGuide } from './mathtabla.readouts'

const props = withDefaults(defineProps<{
  columns?: number
  rows?: number
  cellSize?: number
  viewportPadding?: string
  activeRegion?: string
  guide?: MathTablaGuide | null
  /** How the whole is partitioned. Presentation only: it creates no material. */
  wholeGrouping?: AreaGrouping | null
}>(), {
  columns: 24,
  rows: 12,
  cellSize: 36,
  viewportPadding: '16px',
  activeRegion: 'array',
  guide: null,
  wholeGrouping: null,
})

const geometry = computed(() => getMathTablaGeometry(props.columns, props.rows, props.cellSize))

// Recomputed from the current guide; no earlier dimensions are retained.
const groupBands = computed(() => {
  const guide = props.guide
  const grouping = props.wholeGrouping
  if (!guide || !grouping) return []

  return areaGroupPartitions(
    { offset: { x: guide.x, y: guide.y }, width: guide.width, depth: guide.depth },
    grouping,
  ) ?? []
})
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
    <!-- The whole: a flat area on the board plane, under the raised rods that follow. -->
    <div
      v-if="guide"
      class="denominator-area"
      data-math-guide
      :style="{
        left: `${guide.x * cellSize}px`,
        top: `${guide.y * cellSize}px`,
        width: `${guide.width * cellSize}px`,
        height: `${guide.depth * cellSize}px`,
      }"
      aria-hidden="true"
    />
    <!-- Flat grouping marks: after the fill, still below every raised rod. -->
    <div
      v-for="(band, index) in groupBands"
      :key="`${wholeGrouping}-${index}`"
      class="group-band"
      :class="{ 'group-band--tinted': index % 2 === 1 }"
      :data-math-grouping="wholeGrouping"
      :data-math-group-band="index"
      :style="{
        left: `${band.offset.x * cellSize}px`,
        top: `${band.offset.y * cellSize}px`,
        width: `${band.width * cellSize}px`,
        height: `${band.depth * cellSize}px`,
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

/* A surface, not a rod: translucent fill, solid perimeter, grid lines aligned to
   the board cells (border-box origin), and no raised side faces. */
.denominator-area {
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
  border: 2px solid var(--ui-primary);
  background-color: color-mix(in srgb, var(--ui-primary) 18%, transparent);
  background-image:
    linear-gradient(to right, color-mix(in srgb, var(--ui-primary) 45%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--ui-primary) 45%, transparent) 1px, transparent 1px);
  background-size: var(--cell-size) var(--cell-size);
  background-origin: border-box;
  background-clip: border-box;
}

/* A boundary drawn on the surface: dashed edges and a translucent tint, so the
   unit grid stays readable and nothing reads as a raised piece. */
.group-band {
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
  border: 2px dashed color-mix(in srgb, var(--ui-primary) 75%, transparent);
}

.group-band--tinted {
  background-color: color-mix(in srgb, var(--ui-primary) 16%, transparent);
}
</style>
