<script setup lang="ts">
import type { GridConfig, GridView } from './grid.types'
import { ariaGridView, gridStyle } from './grid.types'
import styles from './gridstyle.module.css'
const ready = ref(false)
onMounted(() => { ready.value = true })

withDefaults(defineProps<{
  config: GridConfig
  view: GridView
  showGrid?: boolean
  viewportPadding?: string
  viewportAlignment?: 'center' | 'start'
}>(), {
  showGrid: true,
  viewportPadding: '48px',
  viewportAlignment: 'center',
})
</script>

<template>
  <div
    :class="styles.viewport"
    :style="{
      '--grid-viewport-padding': viewportPadding,
      '--grid-viewport-alignment': viewportAlignment,
    }"
    data-role="viewport"
    :data-ready="ready"
  >
    <div
        :class="styles.surface"
        :aria-label="ariaGridView(config)"
        :style="gridStyle(config, view)"
        data-grid-world
    >
      <i :class="styles.axis" data-grid-axis="origin" aria-hidden="true" />
      <i :class="styles.axis" data-grid-axis="x" :style="{ left: `${config.cellSize}px` }" aria-hidden="true" />
      <i :class="styles.axis" data-grid-axis="y" :style="{ top: `${config.cellSize}px` }" aria-hidden="true" />
      <div v-if="showGrid" :class="styles['grid-lines']" aria-hidden="true" />
      <slot />
    </div>
  </div>
</template>
