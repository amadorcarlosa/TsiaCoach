<script setup lang="ts">
import { computed } from 'vue'
import GridSurface from '~/components/grid/surface/GridSurface.vue'
import { getFractionTablaGeometry } from './fraction-tabla.geometry'

const props = withDefaults(defineProps<{
  pairCount?: number
  embedded?: boolean
  viewportPadding?: string
  cellSize?: number
  visibleColumns?: number
  activeRow?: number
}>(), {
  pairCount: 2,
  embedded: false,
  viewportPadding: '16px',
  cellSize: 36,
  visibleColumns: 24,
  activeRow: 1,
})

const geometry = computed(() =>
    getFractionTablaGeometry(
        props.pairCount,
        props.cellSize,
        props.visibleColumns,
    ),
)

const config = computed(() => geometry.value.config)

const tracks = computed(() =>
  geometry.value.targets.flatMap(target => [
    {
      id: `${target.id}-numerator`,
      row: target.numeratorRow,
    },
    {
      id: `${target.id}-denominator`,
      row: target.denominatorRow,
    },
  ]),
)
</script>

<template>
  <div
      class="fraction-tabla"
      :class="{ 'fraction-tabla--embedded': embedded }"
  >
    <GridSurface
        :config="config"
        :view="geometry.view"
        :show-grid="false"
        :viewport-padding="viewportPadding"
        viewport-alignment="start"
    >
      <div class="reference-row" :style="{ height: `${cellSize}px` }">
        <span
            v-for="n in config.columns + 1"
            :key="n"
            class="unit-number"
            :class="{
            'unit-number--start': n === 1,
            'unit-number--end': n === config.columns + 1,
            'unit-number--ten': n - 1 === 10 || n - 1 === 20,
          }"
            :style="{ left: `${(n - 1) * cellSize}px` }"
        >
          {{ n - 1 }}
        </span>
      </div>

      <div
          v-for="track in tracks"
          :key="track.id"
          class="fraction-track"
          :class="{ 'fraction-track--active': activeRow === track.row }"
          :data-fraction-track="track.id"
          :data-track-row="track.row"
          :style="{
          top: `${track.row * cellSize}px`,
          height: `${cellSize}px`,
        }"
          aria-hidden="true"
      />

      <div
          v-for="target in geometry.targets"
          :key="target.id"
          class="vinculum"
          :style="{ top: `${target.denominatorRow * cellSize}px` }"
          aria-hidden="true"
      />

      <slot name="pieces" :cell-size="config.cellSize" />
    </GridSurface>
  </div>
</template>

<style scoped>
.fraction-tabla {
  width: max-content;
  max-width: 100%;
  overflow: auto;
  color: var(--mt-text);
  background: var(--mt-bg-elevated);
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-xl);
}

.fraction-tabla--embedded {
  max-width: none;
  overflow: visible;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.reference-row,
.fraction-track {
  position: absolute;
  left: 0;
  right: 0;
  box-sizing: border-box;
  pointer-events: none;
}

.unit-number {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  color: var(--mt-text-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.unit-number--start {
  transform: none;
}

.unit-number--end {
  transform: translateX(-100%);
}

.unit-number--ten {
  color: var(--mt-text);
  font-weight: 700;
}

.fraction-track {
  background-color: var(--mt-surface-2);
  background-image: linear-gradient(
      to right,
      var(--mt-grid) 1px,
      transparent 1px
  );
  background-size: var(--cell-size) 100%;
  border: 1px solid var(--mt-border-accent);
}

.fraction-track--active {
  box-shadow: inset 0 0 0 2px var(--ui-primary);
}

.vinculum {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 2px solid var(--mt-text);
  pointer-events: none;
}
</style>
