<script setup lang="ts">
import { computed } from 'vue'
import type { SystemEvaluation } from './systems.evaluate'
import { systemsGeometry } from './systems.geometry'
import { equationCorrectness } from './systems.feedback'
import type { SystemsBoardConfig } from './systems.schema'

const props = defineProps<{
  config: SystemsBoardConfig
  evaluation: SystemEvaluation
  cellSize: number
  paddingY: number
  scrollTop: number
}>()

const summaries = computed(() => {
  const geometry = systemsGeometry(props.config)
  return props.config.system.equations.map((equation, index) => {
    const regions = geometry.variableRegions.filter(region => region.equationId === equation.id)
    const start = Math.min(...regions.map(region => region.y))
    const end = Math.max(...regions.map(region => region.y + region.depth))
    const evaluated = props.evaluation.valid ? props.evaluation.equations[index] : undefined
    return {
      id: equation.id,
      index,
      evaluated,
      correctness: equationCorrectness(evaluated),
      style: {
        top: `${1 + props.paddingY + start * props.cellSize - props.scrollTop}px`,
        height: `${(end - start) * props.cellSize}px`,
      },
    }
  })
})
</script>

<template>
  <div
    class="sys-area-summaries"
    :style="{ '--summary-cell-size': `${cellSize}px` }"
    aria-live="polite"
    aria-atomic="true"
  >
    <section
      v-for="summary in summaries"
      :key="summary.id"
      class="sys-area-summary"
      :class="`sys-area-summary--${summary.correctness}`"
      :style="summary.style"
      :aria-label="`Equation ${summary.index + 1} area summary`"
      :data-systems-area-summary="summary.id"
      :data-correctness="summary.correctness"
    >
      <strong>Equation {{ summary.index + 1 }}</strong>
      <template v-if="summary.evaluated">
        <div>x area: {{ summary.evaluated.groups.x.occupiedArea }}</div>
        <div>y area: {{ summary.evaluated.groups.y.occupiedArea }}</div>
        <div class="sys-area-summary-total">
          Total area: {{ summary.evaluated.occupiedArea }}
        </div>
        <div class="sys-area-summary-status">
          <template v-if="summary.correctness === 'correct'">
            <span aria-hidden="true">&#10003;</span> Correct
          </template>
          <template v-else-if="summary.correctness === 'incorrect'">
            <span aria-hidden="true">&#10005;</span> Expected area: {{ summary.evaluated.targetArea }}
          </template>
          <template v-else>
            Incomplete
          </template>
        </div>
      </template>
      <p v-else-if="!evaluation.valid">
        {{ evaluation.reason }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.sys-area-summaries {
  position: absolute;
  inset: 0;
  overflow: hidden;
  color: var(--mt-text);
}

.sys-area-summary {
  position: absolute;
  inset-inline: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
  padding-inline: 4px;
  border-inline-start: 2px solid var(--mt-border-accent);
  font-size: clamp(8px, calc(var(--summary-cell-size) * 0.55), 14px);
  line-height: 1.15;
}

.sys-area-summary-total {
  border-top: 2px solid var(--summary-correctness-color, var(--mt-border-accent));
  font-size: 1.15em;
  font-weight: 700;
}

.sys-area-summary--correct { --summary-correctness-color: var(--ui-success, #16a34a); }
.sys-area-summary--incorrect { --summary-correctness-color: var(--ui-error, #dc2626); }
.sys-area-summary--correct, .sys-area-summary--incorrect {
  color: var(--summary-correctness-color);
  border-color: var(--summary-correctness-color);
  box-shadow: inset 0 0 0 1px var(--summary-correctness-color);
}
.sys-area-summary-status { font-weight: 600; }
</style>
