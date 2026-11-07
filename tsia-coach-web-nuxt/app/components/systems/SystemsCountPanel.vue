<script setup lang="ts">
import { ref } from 'vue'
import PlaygroundActionButton from '~/components/playground/PlaygroundActionButton.vue'
import type { SceneResult } from '~/components/rod/scene/rod.scene.types'
import type { CandidateCounts, ExchangeStep } from './systems.candidates'
import type { CountPhase } from './systems.count-feedback'
import { difficultyLabels } from './systems.generator'
import { difficultyProfiles, type DifficultyProfile, type VariableId } from './systems.schema'

/** Controls and feedback for the rod-count activity. Emits intents only. */
defineProps<{
  coefficients: { x: number; y: number }
  counts: CandidateCounts
  phase: CountPhase
  status: string
  hint: string
  hintLevel: number
  history: readonly CandidateCounts[]
  step: ExchangeStep
  message: string
  disabled: boolean
  exchange: SceneResult
  arrange: SceneResult
  generatedProfile: DifficultyProfile | null
}>()

const emit = defineEmits<{
  add: [variable: VariableId, count: number]
  remove: [variable: VariableId]
  hint: []
  selectExchange: []
  exchange: []
  arrange: []
  generate: [profile: DifficultyProfile]
}>()

const profile = ref<DifficultyProfile>('introductory')
</script>

<template>
  <section
    class="count-panel"
    aria-label="Rod-count activity"
    data-systems-count-panel
  >
    <div
      class="count-row"
      role="group"
      aria-label="Build Equation 1"
    >
      <template
        v-for="variable in (['x', 'y'] as const)"
        :key="variable"
      >
        <span class="count-label">
          {{ variable }} rods ({{ coefficients[variable] }}-rods): <strong :data-count="variable">{{ variable === 'x' ? counts.xCount : counts.yCount }}</strong>
        </span>
        <PlaygroundActionButton
          :disabled="disabled"
          :aria-label="`Add one ${variable} rod`"
          @click="emit('add', variable, 1)"
        >
          + {{ variable }}
        </PlaygroundActionButton>
        <PlaygroundActionButton
          :disabled="disabled"
          :aria-label="`Add five ${variable} rods`"
          @click="emit('add', variable, 5)"
        >
          +5 {{ variable }}
        </PlaygroundActionButton>
        <PlaygroundActionButton
          :disabled="disabled"
          :aria-label="`Remove one ${variable} rod`"
          @click="emit('remove', variable)"
        >
          − {{ variable }}
        </PlaygroundActionButton>
      </template>
    </div>

    <div
      class="count-row"
      role="group"
      aria-label="Exchange"
    >
      <PlaygroundActionButton
        :disabled="disabled || phase === 'building' || phase === 'solved'"
        @click="emit('selectExchange')"
      >
        Select {{ step.removedX }} x rods to exchange
      </PlaygroundActionButton>
      <PlaygroundActionButton
        :disabled="disabled || !exchange.allowed"
        :title="exchange.allowed ? undefined : exchange.reason"
        @click="emit('exchange')"
      >
        Exchange for {{ step.addedY }} y rods…
      </PlaygroundActionButton>
      <PlaygroundActionButton
        :disabled="disabled || !arrange.allowed"
        :title="arrange.allowed ? undefined : arrange.reason"
        @click="emit('arrange')"
      >
        Arrange x, then y…
      </PlaygroundActionButton>
      <PlaygroundActionButton
        :disabled="disabled || phase === 'solved' || hintLevel >= 3"
        @click="emit('hint')"
      >
        {{ hintLevel ? 'More hint' : 'Hint' }}
      </PlaygroundActionButton>
    </div>

    <p
      class="count-status"
      role="status"
      aria-live="polite"
      data-systems-status
      :data-phase="phase"
    >
      {{ status }}
    </p>
    <p
      v-if="hint"
      class="count-hint"
      data-systems-hint
    >
      Hint: {{ hint }}
    </p>
    <p
      v-if="message"
      class="count-message"
      data-systems-count-message
    >
      {{ message }}
    </p>
    <p
      v-if="history.length"
      class="count-history"
      data-systems-history
    >
      Candidates so far:
      <span
        v-for="(item, index) in history"
        :key="index"
      >{{ index ? ' → ' : '' }}({{ item.xCount }}, {{ item.yCount }})</span>
    </p>
    <p class="count-note">
      Solid rods are yours. Equation 2's dashed rods are rebuilt from your counts; they are not saved or editable.
      Grey hatching marks unassigned material that counts toward neither x nor y.
    </p>

    <div
      class="count-row"
      role="group"
      aria-label="New problem"
    >
      <label class="count-select">
        Difficulty
        <select
          v-model="profile"
          :disabled="disabled"
          aria-label="Difficulty"
        >
          <option
            v-for="item in difficultyProfiles"
            :key="item"
            :value="item"
          >
            {{ difficultyLabels[item] }}
          </option>
        </select>
      </label>
      <PlaygroundActionButton
        :disabled="disabled"
        @click="emit('generate', profile)"
      >
        New problem
      </PlaygroundActionButton>
      <span
        v-if="generatedProfile"
        class="count-note"
      >Generated ({{ difficultyLabels[generatedProfile] }})</span>
    </div>
  </section>
</template>

<style scoped>
.count-panel { display: grid; gap: 6px; padding-block: 8px; font-size: 0.875rem; }
.count-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.count-label { min-width: 11rem; }
.count-status { margin: 0; font-weight: 600; }
.count-hint, .count-message, .count-history, .count-note { margin: 0; }
.count-note { color: var(--mt-text-muted, var(--mt-text)); }
.count-select { display: flex; gap: 8px; align-items: center; }
.count-select select { min-height: 40px; padding: 6px 10px; border: 1px solid var(--mt-border); border-radius: var(--radius-md); background: var(--mt-bg-elevated); color: var(--mt-text); }
</style>
