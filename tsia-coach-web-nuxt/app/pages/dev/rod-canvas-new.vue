<script setup lang="ts">
import GridSurface from '~/components/grid/surface/GridSurface.vue'
import CuisenaireRod from '~/components/rod/CuisenaireRod.vue'
import type {
  GridConfig,
  GridView,
} from '~/components/grid/surface/grid.types'
import {CuisenaireRodValues, getRodDefinition, type CuisenaireRodValue} from '~/components/rod/rod.types'
import { cusisenaireRodPalette } from '~/components/rod/rod.types'

const config: GridConfig = {
  columns: 24,
  rows: 12,
  cellSize: 36,
}

const view: GridView = {
  tiltDegrees: 35,
}
const workspaceStyle = {
  '--grid-top-inset': `${
      config.rows * config.cellSize *
      (1 - Math.cos(view.tiltDegrees * Math.PI / 180)) / 2
  }px`,
}

const rods = Object.values(CuisenaireRodValues)
    .map(getRodDefinition)

type PlacedRod = {
  id: number
  value: CuisenaireRodValue
  x: number
  y: number
}

const placedRods = ref<PlacedRod[]>([])
const toast = useToast()
let nextId = 1

function addRod(value: CuisenaireRodValue) {
  // Find a free horizontal space, scanning each row.
  for (let y = 0; y < config.rows; y++) {
    for (let x = 0; x <= config.columns - value; x++) {
      const occupied = placedRods.value.some(rod =>
          rod.y === y &&
          x < rod.x + rod.value &&
          x + value > rod.x
      )

      if (occupied) continue

      placedRods.value.push({ id: nextId++, value, x, y })
      toast.add({
        title: `Added a ${value} rod.`,
        color: 'success',
        duration: 1500,
      })
      return
    }
  }

  toast.add({
    title: `There is no space for a ${value} rod.`,
    color: 'warning',
    duration: 3000,
  })
}
</script>

<template>
  <div class="workspace" :style="workspaceStyle">
  <RodTray
      class="workspace-tray"
      :items="rods"
      :unit-size="16"
      @choose="addRod"
  />

  <GridSurface :config="config" :view="view">
    <div
        v-for="placed in placedRods"
        :key="placed.id"
        class="placement"
        :style="{
        left: `${placed.x * config.cellSize}px`,
        top: `${placed.y * config.cellSize}px`,
      }"
    >
      <CuisenaireRod
          :dimensions="{ width: placed.value, depth: 1, height: 1 }"
          :unit-size="config.cellSize"
          :appearance="cusisenaireRodPalette[placed.value]"
          :label="String(placed.value)"
      />
    </div>
  </GridSurface></div>
</template>


<style scoped>
.workspace {
  --grid-top-inset: 0px;

  display: flex;
  align-items: stretch;
  gap: 0;

  width: max-content;
  max-width: calc(100% - 32px);
  margin: 16px;
  padding: 0;
  overflow: auto;

  background: var(--mt-bg-elevated);
  color: var(--mt-text);
  border: 1px solid var(--mt-border);
  border-radius: var(--mt-radius-xl);
  box-shadow: var(--mt-shadow-sm);
}

.workspace > .workspace-tray {
  flex: 0 0 auto;
  width: max-content;
  padding: calc(24px + var(--grid-top-inset)) 16px 24px;
  background: transparent;
  border: 0;
  border-right: 1px solid var(--mt-border);
  border-radius: 0;
}

/* Remove GridSurface's surrounding 48px padding. */
.workspace :deep([data-role="viewport"]) {
  display: block;
  flex: 0 0 auto;
  padding: 24px 16px;
}

.placement {
  position: absolute;
  transform-style: preserve-3d;
}
.workspace-tray :deep(button:first-child) {
  padding-top: 0;
}
</style>
