<script setup lang="ts">
import { computed } from 'vue'
import GridSurface from '~/components/grid/surface/GridSurface.vue'
import type { RodTrain } from '~/components/rod/scene/rod.scene.types'
import { trainFootprints } from '~/components/rod/scene/part-footprint'
import { trainMagnitude } from '~/components/rod/scene/rod-arithmetic'
import { SYSTEMS_GUTTER_COLUMNS, equationText, systemsGeometry } from './systems.geometry'
import type { SystemEvaluation } from './systems.evaluate'
import { areaFeedback } from './systems.feedback'
import type { SystemsBoardConfig } from './systems.schema'

/**
 * The systems board surface. Everything drawn here is decoration: lanes,
 * brackets, headings and preview ghosts take no input and are never scene
 * material. The accessible description lives outside, in the readouts.
 */
const props = withDefaults(defineProps<{
  config: SystemsBoardConfig
  cellSize: number
  evaluation: SystemEvaluation
  activeRegion?: string | null
  /** Rows a previewed command would add. Outlines only, never counted. */
  ghosts?: readonly RodTrain[]
  viewportPadding?: string
}>(), {
  activeRegion: null,
  ghosts: () => [],
  viewportPadding: '16px',
})

const geometry = computed(() => systemsGeometry(props.config))
const gridConfig = computed(() => ({
  columns: geometry.value.columns,
  rows: geometry.value.rows,
  cellSize: props.cellSize,
}))

const box = (x: number, y: number, width: number, depth: number) => ({
  left: `${x * props.cellSize}px`,
  top: `${y * props.cellSize}px`,
  width: `${width * props.cellSize}px`,
  height: `${depth * props.cellSize}px`,
})

const headings = computed(() => geometry.value.headings.map(heading => {
  const equation = props.config.system.equations[heading.equationIndex]!
  const evaluated = props.evaluation.valid ? props.evaluation.equations[heading.equationIndex] : undefined
  return {
    ...heading,
    text: `Equation ${heading.equationIndex + 1}: ${equationText(equation)}`,
    area: evaluated ? areaFeedback(evaluated) : '',
    satisfied: evaluated?.satisfied ?? false,
  }
}))

const ghostParts = computed(() => props.ghosts.flatMap((train, index) =>
  trainFootprints(train).map((footprint, part) => ({ key: `${index}-${part}`, footprint }))))

const ghostLabels = computed(() => props.ghosts.map((train, index) => {
  const footprints = trainFootprints(train)
  const right = Math.max(...footprints.map(item => item.x + item.width))
  return { key: index, x: train.anchor.x, y: train.anchor.y, width: right - train.anchor.x, length: trainMagnitude(train) }
}))
</script>

<template>
  <GridSurface
    :config="gridConfig"
    :view="{ tiltDegrees: 0 }"
    :show-grid="false"
    :viewport-padding="viewportPadding"
    viewport-alignment="start"
  >
    <div
      v-for="heading in headings"
      :key="heading.equationId"
      class="sys-heading"
      :class="{ 'sys-heading--satisfied': heading.satisfied }"
      :data-systems-heading="heading.equationId"
      :style="box(0, heading.row, geometry.columns, 1)"
      aria-hidden="true"
    >
      <strong>{{ heading.text }}</strong>
      <span>{{ heading.area }}</span>
    </div>

    <template
      v-for="region in geometry.variableRegions"
      :key="region.id"
    >
      <div
        class="sys-bracket"
        :class="`sys-bracket--${region.variable}`"
        :style="box(0, region.y, SYSTEMS_GUTTER_COLUMNS - 0.25, region.depth)"
        aria-hidden="true"
      >
        <span class="sys-bracket-count">{{ region.coefficient }}{{ region.variable }}</span>
        <span class="sys-bracket-text">{{ region.coefficient }} {{ region.coefficient === 1 ? 'row' : 'rows' }}</span>
      </div>
      <div
        class="sys-region"
        :class="[`sys-region--${region.variable}`, { 'sys-region--active': activeRegion === region.id }]"
        :data-systems-region="region.id"
        :style="box(region.x, region.y, region.width, region.depth)"
        aria-hidden="true"
      />
    </template>

    <div
      class="sys-heading sys-heading--staging"
      :style="box(0, geometry.stagingHeadingRow, geometry.columns, 1)"
      aria-hidden="true"
    >
      <strong>{{ geometry.staging.label }}</strong>
    </div>
    <div
      class="sys-region sys-region--staging"
      :class="{ 'sys-region--active': activeRegion === geometry.staging.id }"
      :data-systems-region="geometry.staging.id"
      :style="box(geometry.staging.x, geometry.staging.y, geometry.staging.width, geometry.staging.depth)"
      aria-hidden="true"
    />

    <div
      v-for="ghost in ghostParts"
      :key="`ghost-${ghost.key}`"
      class="sys-ghost"
      data-systems-ghost
      :style="box(ghost.footprint.x, ghost.footprint.y, ghost.footprint.width, ghost.footprint.depth)"
      aria-hidden="true"
    />
    <div
      v-for="label in ghostLabels"
      :key="`ghost-label-${label.key}`"
      class="sys-ghost-label"
      :style="box(label.x, label.y, label.width, 1)"
      aria-hidden="true"
    >
      {{ label.length }}
    </div>

    <slot
      name="pieces"
      :cell-size="cellSize"
    />
  </GridSurface>
</template>

<style scoped>
.sys-heading {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  padding-inline: 4px;
  overflow: hidden;
  pointer-events: none;
  color: var(--mt-text);
  font-size: max(10px, calc(var(--cell-size) * 0.42));
  white-space: nowrap;
}

.sys-heading span {
  color: var(--mt-text-muted, var(--mt-text));
}

.sys-heading--satisfied strong::after {
  content: ' ✓';
  color: var(--ui-success, #16a34a);
}

.sys-region {
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
  background-color: var(--mt-surface-2);
  /* Lanes are space, not material: grid lines, one band per lane. */
  background-image:
    linear-gradient(to right, var(--mt-grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--mt-grid) 1px, transparent 1px);
  background-size: var(--cell-size) var(--cell-size);
  border: 2px solid var(--mt-border-accent);
}

.sys-region--x { border-color: color-mix(in srgb, #2563eb 70%, var(--mt-border)); }
.sys-region--y { border-color: color-mix(in srgb, #c2410c 70%, var(--mt-border)); border-style: dashed; }
.sys-region--staging { border-style: dotted; }

.sys-region--active {
  outline: 2px solid var(--ui-primary);
  outline-offset: 1px;
}

.sys-bracket {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  box-sizing: border-box;
  padding-right: 8px;
  pointer-events: none;
  border-right: 3px solid;
  border-radius: 0 6px 6px 0;
  color: var(--mt-text);
  line-height: 1.1;
}

.sys-bracket--x { border-color: #2563eb; }
.sys-bracket--y { border-color: #c2410c; border-right-style: double; border-right-width: 5px; }

.sys-bracket-count {
  font-size: max(11px, calc(var(--cell-size) * 0.5));
  font-weight: 700;
}

.sys-bracket-text {
  font-size: max(9px, calc(var(--cell-size) * 0.32));
}

.sys-ghost {
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
  border: 2px dashed var(--ui-primary);
  background: color-mix(in srgb, var(--ui-primary) 14%, transparent);
}

.sys-ghost-label {
  position: absolute;
  display: grid;
  place-items: center;
  pointer-events: none;
  color: var(--ui-primary);
  font-weight: 700;
  font-size: max(10px, calc(var(--cell-size) * 0.45));
}
</style>
