<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DeepReadonly } from 'vue'
import type { AuthoringGoal, BoardGoalAdapter, GoalCondition } from './goal.types'
const props = defineProps<{ stepId: string; adapter: BoardGoalAdapter; disabled: boolean; goal: DeepReadonly<AuthoringGoal> | null }>()
const emit = defineEmits<{ apply: [input: unknown] }>()
const draft = ref<GoalCondition[]>([])
const error = ref('')
const baseline = ref('[]')
const dirty = computed(() => JSON.stringify(draft.value) !== baseline.value)
const labels: Record<GoalCondition['type'], string> = {
  'fraction-exact': 'Exact fraction', 'empty-pair': 'Empty pair', 'empty-region': 'Empty region',
  'region-total': 'Region total', 'occupied-area': 'Occupied area', 'filled-rectangle': 'Filled rectangle',
}
function reset() {
  const parsed = props.adapter.parse(props.goal)
  draft.value = parsed.allowed ? parsed.value.conditions : []
  baseline.value = JSON.stringify(draft.value)
  error.value = ''
}
watch(() => [props.stepId, props.goal], reset, { immediate: true })
function resolveDraft(): boolean {
  if (!dirty.value) return true
  if (!window.confirm('Discard the unapplied goal draft? Cancel to keep editing, or apply it before continuing.')) return false
  reset()
  return true
}
defineExpose({ resolveDraft })
function make(type: GoalCondition['type']): GoalCondition {
  const pairId = props.adapter.pairs[0]?.id ?? ''
  const regionId = props.adapter.regions[0]?.id ?? ''
  switch (type) {
    case 'fraction-exact': return { type, pairId, numerator: 0, denominator: 1 }
    case 'empty-pair': return { type, pairId }
    case 'empty-region': return { type, regionId }
    case 'region-total': return { type, regionId, value: 0 }
    case 'occupied-area': return { type, regionId, cells: 0 }
    case 'filled-rectangle': return { type, regionId, x: 0, y: 0, columns: 1, rows: 1 }
  }
}
function changeType(index: number, event: Event) {
  const type = (event.target as HTMLSelectElement).value
  const supported = props.adapter.supportedTypes.find(value => value === type)
  if (supported) draft.value[index] = make(supported)
}
function apply() {
  const parsed = props.adapter.parse({ type: 'all', conditions: draft.value })
  if (!parsed.allowed) { error.value = parsed.reason; return }
  emit('apply', parsed.value)
  baseline.value = JSON.stringify(draft.value)
  error.value = ''
}
function clear() { emit('apply', null); draft.value = []; baseline.value = '[]'; error.value = '' }
</script>
<template>
  <fieldset class="goal-editor" :disabled="disabled">
    <legend>Goal</legend>
    <p v-if="!draft.length">No goal authored.</p>
    <fieldset v-for="(condition, index) in draft" :key="index">
      <legend>Condition {{ index + 1 }}</legend>
      <label>Condition type
        <select :value="condition.type" @change="changeType(index, $event)">
          <option v-for="type in adapter.supportedTypes" :key="type" :value="type">{{ labels[type] }}</option>
        </select>
      </label>
      <label v-if="'pairId' in condition">Pair
        <select v-model="condition.pairId"><option v-for="target in adapter.pairs" :key="target.id" :value="target.id">{{ target.label }}</option></select>
      </label>
      <label v-else>Region
        <select v-model="condition.regionId"><option v-for="target in adapter.regions" :key="target.id" :value="target.id">{{ target.label }}</option></select>
      </label>
      <template v-if="condition.type === 'fraction-exact'">
        <label>Numerator<input v-model.number="condition.numerator" type="number" min="0" step="1"></label>
        <label>Denominator<input v-model.number="condition.denominator" type="number" min="1" step="1"></label>
      </template>
      <label v-if="condition.type === 'region-total'">Value<input v-model.number="condition.value" type="number" min="0" step="1"></label>
      <label v-if="condition.type === 'occupied-area'">Cells<input v-model.number="condition.cells" type="number" min="0" step="1"></label>
      <template v-if="condition.type === 'filled-rectangle'">
        <label>X<input v-model.number="condition.x" type="number" min="0" step="1"></label>
        <label>Y<input v-model.number="condition.y" type="number" min="0" step="1"></label>
        <label>Columns<input v-model.number="condition.columns" type="number" min="1" step="1"></label>
        <label>Rows<input v-model.number="condition.rows" type="number" min="1" step="1"></label>
      </template>
      <button type="button" @click="draft.splice(index, 1)">Remove condition</button>
    </fieldset>
    <button type="button" @click="draft.push(make(adapter.supportedTypes[0]!))">Add condition</button>
    <button type="button" @click="apply">Apply goal</button>
    <button type="button" @click="clear">Clear goal</button>
    <span v-if="dirty">Unapplied goal draft</span>
    <p v-if="error" role="alert">{{ error }}</p>
  </fieldset>
</template>
<style scoped>
.goal-editor { display: grid; gap: 8px; min-width: 0; }
fieldset { border: 1px solid var(--mt-border); padding: 12px; }
label { display: inline-grid; gap: 4px; margin: 4px; }
input, select, button { font: inherit; color: var(--mt-text); background: var(--mt-bg-elevated); padding: 6px; border: 1px solid var(--mt-border); border-radius: 4px; }
</style>
