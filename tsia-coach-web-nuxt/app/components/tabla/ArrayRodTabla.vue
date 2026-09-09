<script setup lang="ts">
import { computed } from 'vue'
import GridSurface from '~/components/grid/surface/GridSurface.vue'
import type {
  GridConfig,
  GridView,
} from '~/components/grid/surface/grid.types'

const props = withDefaults(defineProps<{
  rows?: number
  visibleColumns?: number
  cellSize?: number
  tiltDegrees?: number
  viewportPadding?: string
}>(), {
  rows: 12,
  visibleColumns: 24,
  cellSize: 36,
  tiltDegrees: 15,
  viewportPadding: '16px',
})

const config = computed<GridConfig>(() => ({
  columns: props.visibleColumns,
  rows: props.rows,
  cellSize: props.cellSize,
}))

const view = computed<GridView>(() => ({
  tiltDegrees: props.tiltDegrees,
}))
</script>

<template>
  <GridSurface
      :config="config"
      :view="view"
      :show-grid="true"
      :viewport-padding="viewportPadding"
      viewport-alignment="start"
  >
    <slot name="pieces" :cell-size="config.cellSize" />
  </GridSurface>
</template>