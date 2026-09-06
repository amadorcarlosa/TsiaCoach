<script setup lang="ts">
import { computed } from 'vue'
import GridSurface from '~/components/grid/surface/GridSurface.vue'
import { getTablaGeometry } from './tabla.geometry'

type TablaRow = {
  id: string
  kind: 'unit-grid' | 'ten-grid' | 'target'
}

const props = withDefaults(defineProps<{
  targetCount?: number
  embedded?: boolean
  viewportPadding?: string
}>(), {
  targetCount: 3,
  embedded: false,
  viewportPadding: '16px',
})

const rows = computed<TablaRow[]>(() => {
  const result: TablaRow[] = [
    { id: 'reference-0', kind: 'unit-grid' },
  ]

  for (let index = 0; index < props.targetCount; index++) {
    result.push(
        { id: `target-${index}`, kind: 'target' },
        {
          id: `reference-${index + 1}`,
          kind: index % 2 === 0 ? 'ten-grid' : 'unit-grid',
        },
    )
  }

  return result
})

const geometry = computed(() => getTablaGeometry(props.targetCount))
const config = computed(() => geometry.value.config)
</script>

<template>
  <div class="tabla" :class="{ 'tabla--embedded': embedded }">
    <GridSurface
      :config="config"
      :view="geometry.view"
      :show-grid="false"
      :viewport-padding="viewportPadding"
      viewport-alignment="start"
    >
      <div
          v-for="(row, index) in rows"
          :key="row.id"
          class="tabla-row"
          :class="`tabla-row--${row.kind}`"
          :style="{
          top: `${index * config.cellSize}px`,
          height: `${config.cellSize}px`,
        }"
        >
        <template v-if="row.kind === 'unit-grid'">
          <span
            v-for="n in config.columns + 1"
            :key="n"
            class="unit-number"
            :class="{
              'unit-number--start': n === 1,
              'unit-number--end': n === config.columns + 1,
              'unit-number--ten': n - 1 === 10 || n - 1 === 20,
            }"
            :style="{
              left: `${(n - 1) * config.cellSize}px`,
            }"
          >
            {{ n - 1 }}
          </span>
        </template>

        <template v-else-if="row.kind === 'ten-grid'">
          <span
              v-for="boundary in [10, 20]"
              :key="boundary"
              class="ten-marker"
              :style="{
              left: `${boundary * config.cellSize}px`,
            }"
          >
            {{ boundary }} = {{ boundary / 10 }}
            {{ boundary === 10 ? 'ten' : 'tens' }}
          </span>
        </template>

        <div
            v-else
            class="target-content"
            :data-target-id="row.id"
            role="group"
            :aria-label="`Rod target ${Math.floor(index / 2) + 1}`"
        >
          <slot
              name="target"
              :target-id="row.id"
              :cell-size="config.cellSize"
          />
        </div>
      </div>
    </GridSurface>
  </div>
</template>

<style scoped>
.tabla {
  width: max-content;
  max-width: 100%;
  overflow: auto;
  color: var(--mt-text);
  background: var(--mt-bg-elevated);
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-xl);
}

.tabla--embedded {
  flex: 0 0 auto;
  max-width: none;
  overflow: visible;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.tabla-row {
  position: absolute;
  left: 0;
  right: 0;
  box-sizing: border-box;
  border-bottom: 1px solid var(--mt-border);
  transform-style: preserve-3d;
}

.tabla-row--unit-grid {
  background-image: none;
}

.tabla-row--target {
  background-color: var(--mt-surface-2);
  background-image: linear-gradient(
      to right,
      var(--mt-grid) 1px,
      transparent 1px
  );
  background-size: var(--cell-size) 100%;

  border: 1px solid var(--mt-border-accent);

  /* Recessed edges, like the channels in your photo. */
  box-shadow:
      inset 0 3px 3px -2px var(--mt-border-accent),
      inset 3px 0 3px -2px var(--mt-border-accent);
}

.target-content {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
}

.unit-number {
  position: absolute;
  bottom: 3px;
  transform: translateX(-50%);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--mt-text-muted);
  pointer-events: none;
}

.unit-number--ten {
  font-size: 1rem;
  font-weight: 700;
  color: var(--mt-text);
}

.unit-number--start {
  transform: none;
}

.unit-number--end {
  transform: translateX(-100%);
}

.ten-marker {
  position: absolute;
  top: 0;
  height: 100%;
  border-left: 2px solid var(--mt-border-accent);
  padding-left: 4px;
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
}
</style>
