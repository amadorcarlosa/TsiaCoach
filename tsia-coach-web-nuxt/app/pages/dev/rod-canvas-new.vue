<script setup lang="ts">
import GridSurface from '~/components/grid/surface/GridSurface.vue'
import CuisenaireRod from '~/components/rod/CuisenaireRod.vue'
import type {
  GridConfig,
  GridView,
} from '~/components/grid/surface/grid.types'
import {CuisenaireRodValues, getRodDefinition, type RodProps} from '~/components/rod/rod.types'
import { cusisenaireRodPalette } from '~/components/rod/rod.types'

const config: GridConfig = {
  columns: 24,
  rows: 12,
  cellSize: 36,
}

const view: GridView = {
  tiltDegrees: 35,
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
  <div class="workspace">
  <RodTray
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
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
}
.placement {
  position: absolute;
  transform-style: preserve-3d;
}

.board {
  min-width: 0;
  overflow-x: auto;
}

.board-surface {
  padding: 24px 12px;
}

.status {
  min-height: 1.5em;
  margin: 8px 12px;
}

@media (max-width: 640px) {
  .workspace {
    flex-direction: column;
  }

  .board {
    width: 100%;
  }

}
</style>
