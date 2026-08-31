<script setup lang="ts">
import type { SampleItem } from '#shared/types/sample-items'
import type { Scaffold, ScaffoldPhase, ScaffoldStep } from '#shared/types/scaffolds'
import ScaffoldQuestionContext from '~/components/scaffold/QuestionContext.vue'

const route = useRoute()
const scaffoldId = computed(() => String(route.params.id ?? ''))

useSeoMeta({
  title: 'Parity ladder · TSIA Coach',
  description: 'Build the step between consecutive odd integers, then carry it into the algebra.'
})

const { data: lesson, error, status, refresh } = await useAsyncData(
  () => `scaffold-${scaffoldId.value}`,
  async () => {
    const scaffold = await $fetch<Scaffold>(
      `/api/scaffolds/${encodeURIComponent(scaffoldId.value)}`
    )
    const practiceItem = await $fetch<SampleItem>(
      `/api/sample-items/${encodeURIComponent(scaffold.practiceItemId)}`
    )

    return { scaffold, practiceItem }
  }
)

interface StepEntry {
  phase: ScaffoldPhase
  phaseIndex: number
  step: ScaffoldStep
  globalIndex: number
}

const phaseLabels: Record<string, string> = {
  conceptFormation: 'Build oddness',
  languageInterpretation: 'Find the step',
  representation: 'Join known parts',
  generalization: 'Replace 15 with n',
  verification: 'Match the answer'
}

const steps = computed<StepEntry[]>(() => {
  const entries: StepEntry[] = []

  for (const [phaseIndex, phase] of (lesson.value?.scaffold.phases ?? []).entries()) {
    for (const step of phase.steps) {
      entries.push({
        phase,
        phaseIndex,
        step,
        globalIndex: entries.length
      })
    }
  }

  return entries
})

const currentStepIndex = ref(0)
const completedStepIds = ref<Set<string>>(new Set())
const lessonFinished = ref(false)

const currentEntry = computed(() => steps.value[currentStepIndex.value] ?? null)
const currentStepComplete = computed(() =>
  currentEntry.value
    ? completedStepIds.value.has(currentEntry.value.step.id)
    : false
)

const completionPercent = computed(() => {
  if (steps.value.length === 0) {
    return 0
  }

  return Math.round((completedStepIds.value.size / steps.value.length) * 100)
})

const furthestUnlockedIndex = computed(() => {
  const completedIndexes = steps.value
    .filter(entry => completedStepIds.value.has(entry.step.id))
    .map(entry => entry.globalIndex)

  return Math.min(
    steps.value.length - 1,
    (completedIndexes.length ? Math.max(...completedIndexes) + 1 : 0)
  )
})

function phaseLabel(phase: ScaffoldPhase): string {
  return phaseLabels[phase.purpose] ?? phase.purpose
}

function phaseIsComplete(phase: ScaffoldPhase): boolean {
  return phase.steps.every(step => completedStepIds.value.has(step.id))
}

function markCurrentComplete() {
  const entry = currentEntry.value
  if (!entry) {
    return
  }

  const next = new Set(completedStepIds.value)
  next.add(entry.step.id)
  completedStepIds.value = next
}

function goToStep(index: number) {
  if (index < 0 || index > furthestUnlockedIndex.value) {
    return
  }

  currentStepIndex.value = index
  lessonFinished.value = false
  window?.scrollTo?.({ top: 0, behavior: 'smooth' })
}

function previousStep() {
  goToStep(currentStepIndex.value - 1)
}

function nextStep() {
  if (!currentStepComplete.value) {
    return
  }

  if (currentStepIndex.value === steps.value.length - 1) {
    lessonFinished.value = true
    return
  }

  goToStep(currentStepIndex.value + 1)
}
</script>

<template>
  <UContainer class="walkthrough-page py-8 sm:py-12">
    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      title="The walkthrough could not be loaded"
      :description="error.message"
      :actions="[{ label: 'Try again', onClick: () => refresh() }]"
    />

    <div
      v-else-if="status === 'pending'"
      class="mt-board grid min-h-128 place-items-center"
    >
      <div class="text-center">
        <UIcon name="i-lucide-loader-circle" class="size-7 animate-spin text-primary-600" />
        <p class="mt-3 text-sm text-(--mt-text-sub)">Loading the parity ladder…</p>
      </div>
    </div>

    <template v-else-if="lesson && currentEntry">
      <header class="lesson-header">
        <div>
          <p class="mt-eyebrow">Cuisenaire walkthrough</p>
          <h1>Why the next odd integer is <span>n + 2</span></h1>
          <p class="lesson-intro">
            Use one red rod all the way through. First it measures parity; then it becomes the algebraic +2.
          </p>
        </div>

        <div class="persistent-rod" aria-label="Persistent red rod, length two units">
          <span class="persistent-rod-piece">2</span>
          <span>same piece, every phase</span>
        </div>
      </header>

      <div class="progress-shell" aria-label="Lesson progress">
        <div class="progress-copy">
          <span>{{ completedStepIds.size }} of {{ steps.length }} steps</span>
          <span>{{ completionPercent }}%</span>
        </div>
        <div class="progress-track">
          <span :style="{ width: `${completionPercent}%` }" />
        </div>
      </div>

      <ScaffoldQuestionContext
        :practice-item="lesson.practiceItem"
        :focus-phrase-ids="currentEntry.step.prompt.focusPhraseIds"
        :answers-revealed="currentEntry.step.action.type === 'selectAnswerChoice'"
      />

      <div class="runner-layout">
        <aside class="phase-rail" aria-label="Walkthrough phases">
          <ol>
            <li
              v-for="(phase, phaseIndex) in lesson.scaffold.phases"
              :key="phase.id"
              :class="{
                'is-current': phaseIndex === currentEntry.phaseIndex,
                'is-complete': phaseIsComplete(phase)
              }"
            >
              <span class="phase-marker">
                <UIcon
                  v-if="phaseIsComplete(phase)"
                  name="i-lucide-check"
                  class="size-3.5"
                />
                <span v-else>{{ phaseIndex + 1 }}</span>
              </span>
              <span class="phase-name">{{ phaseLabel(phase) }}</span>
              <span class="phase-count">
                {{ phase.steps.filter(step => completedStepIds.has(step.id)).length }}/{{ phase.steps.length }}
              </span>
            </li>
          </ol>

          <div class="step-dots" aria-label="Steps in this walkthrough">
            <button
              v-for="entry in steps"
              :key="entry.step.id"
              type="button"
              class="step-dot"
              :class="{
                'is-current': entry.globalIndex === currentStepIndex,
                'is-complete': completedStepIds.has(entry.step.id)
              }"
              :disabled="entry.globalIndex > furthestUnlockedIndex"
              :aria-label="`Go to step ${entry.globalIndex + 1}`"
              :aria-current="entry.globalIndex === currentStepIndex ? 'step' : undefined"
              @click="goToStep(entry.globalIndex)"
            />
          </div>
        </aside>

        <main class="runner-main">
          <div class="step-heading">
            <div>
              <p class="step-kicker">
                {{ phaseLabel(currentEntry.phase) }} · Step {{ currentStepIndex + 1 }} of {{ steps.length }}
              </p>
              <h2>{{ currentEntry.step.prompt.text }}</h2>
            </div>
            <UBadge color="neutral" variant="subtle" class="font-mono">
              {{ currentEntry.step.action.type }}
            </UBadge>
          </div>

          <ScaffoldParityLadderScene
            :key="currentEntry.step.id"
            :scaffold="lesson.scaffold"
            :step="currentEntry.step"
            :practice-item="lesson.practiceItem"
            :completed="currentStepComplete"
            @complete="markCurrentComplete"
          />

          <div class="runner-controls">
            <UButton
              label="Previous"
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="ghost"
              :disabled="currentStepIndex === 0"
              @click="previousStep"
            />

            <p v-if="!currentStepComplete" class="advance-hint">
              Complete the board before moving on.
            </p>

            <UButton
              :label="currentStepIndex === steps.length - 1 ? 'Finish walkthrough' : 'Next step'"
              icon="i-lucide-arrow-right"
              trailing
              size="lg"
              :disabled="!currentStepComplete"
              @click="nextStep"
            />
          </div>
        </main>
      </div>

      <UModal v-model:open="lessonFinished" title="The red rod became +2">
        <template #body>
          <div class="finish-dialog">
            <div class="finish-equation">
              <span>n</span><span>+</span><span>(n + <b>2</b>)</span><span>=</span><strong>2n + 2</strong>
            </div>
            <p>
              You did not memorize the gap. You built it, measured it, and carried the same length into the expression.
            </p>
          </div>
        </template>
        <template #footer>
          <div class="flex w-full justify-end gap-3">
            <UButton
              label="Review steps"
              color="neutral"
              variant="ghost"
              @click="lessonFinished = false"
            />
            <UButton
              label="Return to practice"
              to="/sample-Items"
              icon="i-lucide-arrow-right"
              trailing
            />
          </div>
        </template>
      </UModal>
    </template>
  </UContainer>
</template>

<style scoped>
.walkthrough-page {
  max-width: 82rem;
}

.lesson-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.lesson-header h1 {
  max-width: 48rem;
  margin: 0.55rem 0 0;
  font-size: clamp(2rem, 5vw, 3.65rem);
  font-weight: 650;
  letter-spacing: -0.045em;
  line-height: 0.98;
  text-wrap: balance;
}

.lesson-header h1 span {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.82em;
  color: #c9373b;
  letter-spacing: -0.055em;
}

.lesson-intro {
  max-width: 42rem;
  margin: 1rem 0 0;
  color: var(--mt-text-sub);
  font-size: 1rem;
  line-height: 1.65;
}

.persistent-rod {
  display: grid;
  flex: none;
  justify-items: end;
  gap: 0.45rem;
  color: var(--mt-text-muted);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.68rem;
}

.persistent-rod-piece {
  display: grid;
  width: 6rem;
  height: 2.25rem;
  place-items: center;
  border: 1px solid #a82c32;
  border-radius: 0.4rem;
  background: linear-gradient(180deg, #e95a57, #c9373b);
  box-shadow: 0 3px 0 #9e2930;
  color: #fff;
  font-size: 0.76rem;
  font-weight: 700;
}

.progress-shell {
  margin-bottom: 1.2rem;
}

.progress-copy {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.4rem;
  color: var(--mt-text-muted);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.68rem;
}

.progress-track {
  overflow: hidden;
  height: 0.35rem;
  border-radius: 999px;
  background: var(--mt-bg-inset);
}

.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--color-primary-600), #d84a4a);
  transition: width 260ms ease;
}

.runner-layout {
  display: grid;
  grid-template-columns: minmax(12rem, 15rem) minmax(0, 1fr);
  align-items: start;
  gap: clamp(1rem, 3vw, 2rem);
}

.phase-rail {
  position: sticky;
  top: 6.5rem;
  border: 1px solid var(--mt-border);
  border-radius: 1rem;
  background: var(--mt-bg-elevated);
  padding: 0.65rem;
  box-shadow: var(--mt-shadow-sm);
}

.phase-rail ol {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.phase-rail li {
  display: grid;
  grid-template-columns: 1.75rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
  border-radius: 0.65rem;
  padding: 0.65rem;
  color: var(--mt-text-muted);
  font-size: 0.78rem;
}

.phase-rail li.is-current {
  background: var(--color-primary-50);
  color: var(--color-primary-800);
}

:global(.dark) .phase-rail li.is-current {
  background: rgb(20 184 166 / 0.12);
  color: var(--color-primary-200);
}

.phase-marker {
  display: grid;
  width: 1.65rem;
  height: 1.65rem;
  place-items: center;
  border: 1px solid var(--mt-border-strong);
  border-radius: 50%;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.64rem;
  font-weight: 700;
}

.is-complete .phase-marker {
  border-color: var(--color-primary-600);
  background: var(--color-primary-600);
  color: #fff;
}

.phase-name { font-weight: 650; }
.phase-count { font-family: "JetBrains Mono", monospace; font-size: 0.62rem; }

.step-dots {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.35rem;
  margin: 0.8rem 0.35rem 0.25rem;
  border-top: 1px solid var(--mt-border);
  padding-top: 0.8rem;
}

.step-dot {
  width: 100%;
  height: 0.35rem;
  border: 0;
  border-radius: 999px;
  background: var(--mt-border-strong);
}

.step-dot.is-complete { background: var(--color-primary-500); }
.step-dot.is-current { background: #d84a4a; }
.step-dot:disabled { opacity: 0.35; }

.runner-main { min-width: 0; }

.step-heading {
  display: flex;
  min-height: 6.4rem;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 0.2rem 1rem;
}

.step-kicker {
  margin: 0 0 0.35rem;
  color: var(--color-primary-700);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.67rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.step-heading h2 {
  max-width: 48rem;
  margin: 0;
  font-size: clamp(1.15rem, 2.5vw, 1.55rem);
  font-weight: 620;
  line-height: 1.25;
  text-wrap: pretty;
}

.runner-controls {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0.15rem 0;
}

.advance-hint {
  margin: 0;
  color: var(--mt-text-muted);
  font-size: 0.78rem;
  text-align: center;
}

.finish-dialog { text-align: center; }

.finish-equation {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 0.75rem;
  margin: 1rem 0 1.5rem;
  font-family: "JetBrains Mono", monospace;
  font-size: clamp(1rem, 4vw, 1.45rem);
}

.finish-equation b { color: #c9373b; }
.finish-equation strong { color: var(--color-primary-700); }
.finish-dialog p { color: var(--mt-text-sub); line-height: 1.65; }

@media (max-width: 860px) {
  .lesson-header {
    align-items: start;
    flex-direction: column;
  }

  .persistent-rod { justify-items: start; }

  .runner-layout {
    grid-template-columns: 1fr;
  }

  .phase-rail {
    position: static;
    overflow-x: auto;
  }

  .phase-rail ol {
    grid-template-columns: repeat(5, minmax(9rem, 1fr));
  }

  .step-dots {
    grid-template-columns: repeat(12, minmax(1rem, 1fr));
  }
}

@media (max-width: 560px) {
  .step-heading {
    min-height: 0;
    flex-direction: column;
  }

  .runner-controls {
    grid-template-columns: 1fr 1fr;
  }

  .advance-hint {
    grid-column: 1 / -1;
    grid-row: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress-track span { transition: none; }
}
</style>
