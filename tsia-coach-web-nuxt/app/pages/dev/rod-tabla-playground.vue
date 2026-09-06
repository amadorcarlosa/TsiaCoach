<script setup lang="ts">
import { ref } from 'vue'
import RodTabla from '~/components/tabla/RodTabla.vue'
import {type CuisenaireRodValue, CuisenaireRodValues, getRodDefinition} from '~/components/rod/rod.types'
import type {GridConfig, GridView} from "~/components/grid/surface/grid.types.ts";

type TablaLane = {
  id: string
  values: CuisenaireRodValue[]
}

const lanes = ref<TablaLane[]>([
  { id: 'lane-1', values: [8, 8, 8] },
  { id: 'lane-2', values: [10, 10, 4] },
  { id: 'lane-3', values: [] },
  { id: 'lane-4', values: [] },
])
const targetCount = 3

const config: GridConfig = {
  columns: 24,
  rows: targetCount * 2 + 1,
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
  })}
</script>

<template>
  <div class="tabla-playground">
    <div class="workspace" :style="workspaceStyle">
      <RodTray
          class="workspace-tray"
          :items="rods"
          :unit-size="16"
          @choose="addRod"
      />

      <RodTabla
          class="workspace-board"
          :target-count="targetCount"
      />
    </div>
  </div>
</template>

<style scoped>
.tabla-playground {
  padding: 16px;
}
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