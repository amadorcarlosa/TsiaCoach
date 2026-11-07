<script setup lang="ts">
import { computed } from 'vue'
import PlaygroundActionButton from '~/components/playground/PlaygroundActionButton.vue'
import type { CandidateCounts, ExchangeStep } from './systems.candidates'
import type { ConversionAssessment } from './systems.count-conversion'

/**
 * The open conversion's bridge and its Apply and Cancel controls. Not a
 * modal: the board's tools stay usable on the draft while this is shown.
 * Emits intents only.
 */
const props = defineProps<{
  coefficients: { x: number; y: number }
  target: number
  step: ExchangeStep
  baseline: CandidateCounts
  next: CandidateCounts
  assessment: ConversionAssessment
  disabled: boolean
}>()

const emit = defineEmits<{
  apply: []
  cancel: []
}>()

const bridge = computed(() => {
  const { x: a, y: b } = props.coefficients
  const { removedX, addedY, preservedArea } = props.step
  return [
    `${removedX} × ${a} = ${preservedArea} = ${addedY} × ${b}`,
    `x: ${props.baseline.xCount} → ${props.next.xCount}     y: ${props.baseline.yCount} → ${props.next.yCount}`,
    `${a}(${props.next.xCount}) + ${b}(${props.next.yCount}) = ${props.target}`,
  ]
})
</script>

<template>
  <section
    class="conversion-tools"
    aria-label="Conversion workspace"
    data-systems-conversion
    :data-ready="assessment.ready ? 'true' : 'false'"
  >
    <strong class="conversion-title">Conversion workspace</strong>
    <span
      v-for="line in bridge"
      :key="line"
      class="conversion-bridge"
    >{{ line }}</span>
    <p
      class="conversion-status"
      role="status"
      aria-live="polite"
      data-systems-conversion-status
    >
      {{ assessment.summary }}. {{ assessment.reason }}
    </p>
    <div
      class="conversion-actions"
      role="group"
      aria-label="Finish conversion"
    >
      <PlaygroundActionButton
        :disabled="disabled || !assessment.ready"
        :title="assessment.ready ? undefined : assessment.reason"
        @click="emit('apply')"
      >
        Apply conversion
      </PlaygroundActionButton>
      <PlaygroundActionButton
        :disabled="disabled"
        @click="emit('cancel')"
      >
        Cancel conversion
      </PlaygroundActionButton>
    </div>
  </section>
</template>

<style scoped>
.conversion-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  margin-block: 6px;
  padding: 8px 12px;
  border: 2px solid var(--ui-primary);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--ui-primary) 8%, var(--mt-bg-elevated));
  font-size: 0.875rem;
}
.conversion-title { flex-basis: 100%; }
.conversion-bridge { font-variant-numeric: tabular-nums; white-space: pre; font-weight: 600; }
.conversion-status { flex-basis: 100%; margin: 0; }
.conversion-actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
