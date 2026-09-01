<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { isActiveScaffoldSession, isCompletedScaffoldSession } from '#shared/types/scaffolds'
import ScaffoldQuestionContext from '~/components/scaffold/QuestionContext.vue'
import {
  ScaffoldSessionLoadStates,
  useScaffoldSessionStore,
} from './scaffold-session'

const route = useRoute()
const attemptId = computed(() => String(route.params.id ?? ''))
const store = useScaffoldSessionStore()
const {
  session,
  practiceItem,
  loadState,
  loadError,
  checking,
  checkError,
  completedPercent,
} = storeToRefs(store)

useSeoMeta({
  title: 'Guided walkthrough · TSIA Coach',
  description: 'Build the mathematical structure with a server-guided scaffold.',
})

await callOnce(
  `scaffold-session-${attemptId.value}`,
  () => store.load(attemptId.value),
)

watch(attemptId, id => store.load(id))

const activeSession = computed(() =>
  isActiveScaffoldSession(session.value) ? session.value : null,
)
const completedSession = computed(() =>
  isCompletedScaffoldSession(session.value) ? session.value : null,
)
const currentStep = computed(() => activeSession.value?.state.currentStep ?? null)
const completedCount = computed(() => Number(session.value?.completedStepCount ?? 0))
const totalCount = computed(() => Number(session.value?.totalStepCount ?? 0))
</script>

<template>
  <UContainer class="walkthrough-page py-8 sm:py-12">
    <UAlert
      v-if="loadState === ScaffoldSessionLoadStates.Error"
      color="error"
      icon="i-lucide-triangle-alert"
      title="The walkthrough is not available"
      :description="loadError ?? 'Return to practice and try again.'"
      :actions="[
        { label: 'Return to practice', to: '/sample-Items' },
        { label: 'Try again', color: 'error', variant: 'outline', onClick: () => store.load(attemptId, true) },
      ]"
      data-testid="scaffold-safe-error"
    />

    <div v-else-if="loadState === ScaffoldSessionLoadStates.Loading" class="loading-board">
      <UIcon name="i-lucide-loader-circle" class="size-7 animate-spin text-primary-600" />
      <p>Loading your saved walkthrough…</p>
    </div>

    <template v-else-if="session && practiceItem">
      <header class="lesson-header">
        <div>
          <p class="mt-eyebrow">Authorized scaffold session</p>
          <h1>Build the idea, <span>one move at a time</span></h1>
          <p>The server checks each move and decides what opens next. Reloading brings you back to this same place.</p>
        </div>
        <div class="persistent-rod" aria-label="Persistent red rod">
          <span>2</span>
          <small>same step rod</small>
        </div>
      </header>

      <div class="progress-shell" aria-label="Walkthrough progress">
        <div><span>{{ completedCount }} of {{ totalCount }} steps</span><span>{{ completedPercent }}%</span></div>
        <div class="progress-track"><span :style="{ width: `${completedPercent}%` }" /></div>
      </div>

      <ScaffoldQuestionContext
        v-if="currentStep"
        :practice-item="practiceItem"
        :focus-phrase-ids="currentStep.prompt.focusPhraseIds"
        :answers-revealed="currentStep.action.type === 'selectAnswerChoice'"
      />

      <main v-if="currentStep" class="runner-main">
        <div class="step-heading">
          <div>
            <p>Step {{ completedCount + 1 }} of {{ totalCount }}</p>
            <h2>{{ currentStep.prompt.text }}</h2>
          </div>
          <UBadge color="neutral" variant="subtle" class="font-mono">{{ currentStep.action.type }}</UBadge>
        </div>

        <ScaffoldParityLadderScene
          :key="currentStep.id"
          :resources="session.resources"
          :step="currentStep"
          :practice-item="practiceItem"
          :last-check="session.lastCheck"
          :checking="checking"
          @submit="store.submit"
        />

        <UAlert v-if="checkError" class="mt-4" color="error" icon="i-lucide-triangle-alert" title="Response not checked" :description="checkError" />
      </main>

      <section v-else-if="completedSession" class="finish-card" data-testid="scaffold-complete">
        <UIcon name="i-lucide-circle-check-big" class="size-12 text-primary-600" />
        <h2>Walkthrough complete</h2>
        <p>You built the relationship and checked every move with the coach.</p>
        <UButton label="Return to practice" to="/sample-Items" icon="i-lucide-arrow-right" trailing />
      </section>
    </template>
  </UContainer>
</template>

<style scoped>
.walkthrough-page { max-width: 78rem; }
.loading-board { display: grid; min-height: 28rem; place-items: center; align-content: center; gap: .8rem; border: 1px solid var(--mt-border); border-radius: 1rem; }
.loading-board p { margin: 0; color: var(--mt-text-sub); }
.lesson-header { display: flex; align-items: end; justify-content: space-between; gap: 2rem; margin-bottom: 1.5rem; }
.lesson-header h1 { max-width: 48rem; margin: .5rem 0 0; font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 650; letter-spacing: -.045em; line-height: 1; }
.lesson-header h1 span { color: #c9373b; }
.lesson-header p:last-child { max-width: 42rem; color: var(--mt-text-sub); line-height: 1.6; }
.persistent-rod { display: grid; justify-items: center; gap: .35rem; color: var(--mt-text-muted); font: .68rem "JetBrains Mono", monospace; }
.persistent-rod > span { display: grid; width: 6rem; height: 2.25rem; place-items: center; border: 1px solid #a82c32; border-radius: .4rem; background: linear-gradient(#e95a57, #c9373b); box-shadow: 0 3px 0 #9e2930; color: white; font-weight: 800; }
.progress-shell { margin-bottom: 1.2rem; }
.progress-shell > div:first-child { display: flex; justify-content: space-between; margin-bottom: .4rem; color: var(--mt-text-muted); font: .68rem "JetBrains Mono", monospace; }
.progress-track { overflow: hidden; height: .38rem; border-radius: 999px; background: var(--mt-bg-inset); }
.progress-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--color-primary-600), #d84a4a); transition: width 200ms ease; }
.step-heading { display: flex; min-height: 6rem; align-items: start; justify-content: space-between; gap: 1rem; padding: .5rem .2rem 1rem; }
.step-heading p { margin: 0 0 .35rem; color: var(--color-primary-700); font: 700 .68rem "JetBrains Mono", monospace; text-transform: uppercase; }
.step-heading h2 { max-width: 48rem; margin: 0; font-size: clamp(1.15rem, 2.5vw, 1.55rem); line-height: 1.3; }
.finish-card { display: grid; min-height: 28rem; place-items: center; align-content: center; gap: 1rem; border: 1px solid var(--mt-border); border-radius: 1rem; background: var(--mt-bg-elevated); text-align: center; }
.finish-card h2, .finish-card p { margin: 0; }
.finish-card p { color: var(--mt-text-sub); }
@media (max-width: 700px) { .lesson-header { align-items: start; flex-direction: column; } }
@media (prefers-reduced-motion: reduce) { .progress-track span { transition: none; } }
</style>
