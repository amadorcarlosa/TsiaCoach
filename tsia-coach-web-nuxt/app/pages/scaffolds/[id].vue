<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { isActiveScaffoldSession, isCompletedScaffoldSession, isGridScene } from '#shared/types/scaffolds'
import { MaxQuestionLength } from '#shared/types/coaching'
import ScaffoldQuestionContext from '~/components/scaffold/QuestionContext.vue'
import ScaffoldGridScene from '~/components/scaffold/GridScene.vue'
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
  coachReply,
  asking,
  askError,
} = storeToRefs(store)

useSeoMeta({
  title: 'Walkthrough · TSIA Coach',
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
const currentEvidence = computed(() => activeSession.value?.state.evidence ?? null)
const gridScene = computed(() =>
  currentStep.value && isGridScene(currentStep.value.scene) ? currentStep.value.scene : null,
)
const completedCount = computed(() => Number(session.value?.completedStepCount ?? 0))
const totalCount = computed(() => Number(session.value?.totalStepCount ?? 0))

/** Ask the coach: free text about the current step. The reply never moves the student. */
const askOpen = ref(false)
const question = ref('')

function toggleAsk() {
  askOpen.value = !askOpen.value
}

async function send() {
  const text = question.value.trim()
  if (!text || asking.value) {
    return
  }

  await store.askCoach(text)

  if (coachReply.value) {
    question.value = ''
  }
}
</script>

<template>
  <UContainer class="walkthrough-page py-6 sm:py-10">
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
      <p>Loading your walkthrough…</p>
    </div>

    <template v-else-if="session && practiceItem">
      <ScaffoldQuestionContext
        v-if="currentStep"
        :practice-item="practiceItem"
        :focus-phrase-ids="currentStep.prompt.focusPhraseIds"
        :answers-revealed="currentStep.action.type === 'selectAnswerChoice'"
      />

      <main v-if="currentStep" class="runner-main">
        <div class="step-bar" aria-label="Walkthrough progress">
          <span class="step-count">Step {{ completedCount + 1 }} of {{ totalCount }}</span>
          <span class="progress-track" aria-hidden="true"><span :style="{ width: `${completedPercent}%` }" /></span>
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            icon="i-lucide-message-circle-question"
            :label="askOpen ? 'Close' : 'Ask the coach'"
            :aria-expanded="askOpen"
            aria-controls="coach-panel"
            data-testid="ask-coach"
            @click="toggleAsk"
          />
        </div>

        <div class="step-heading">
          <h2>{{ currentStep.prompt.text }}</h2>
        </div>

        <ScaffoldGridScene
          v-if="gridScene"
          :key="currentStep.id"
          :step="currentStep"
          :scene="gridScene"
          :evidence="currentEvidence"
          :last-check="session.lastCheck"
          :checking="checking"
          :error="checkError"
          @submit="store.submit"
        />
        <ScaffoldParityLadderScene
          v-else
          :key="currentStep.id"
          :resources="session.resources"
          :step="currentStep"
          :practice-item="practiceItem"
          :last-check="session.lastCheck"
          :checking="checking"
          @submit="store.submit"
        />

        <UAlert v-if="checkError" class="mt-4" color="error" icon="i-lucide-triangle-alert" title="Response not checked" :description="checkError" />

        <section
          v-if="askOpen"
          id="coach-panel"
          class="coach-panel"
          aria-label="Ask the coach"
          data-testid="coach-panel"
        >
          <form class="coach-form" @submit.prevent="send">
            <UTextarea
              v-model="question"
              class="coach-input"
              :rows="2"
              autoresize
              :maxlength="MaxQuestionLength"
              :disabled="asking"
              placeholder="What are you wondering about this step?"
              aria-label="Your question for the coach"
              data-testid="coach-question"
            />
            <UButton
              type="submit"
              size="sm"
              label="Send"
              :loading="asking"
              :disabled="!question.trim() || asking"
              data-testid="coach-send"
            />
          </form>
          <p v-if="coachReply" class="coach-reply" aria-live="polite" data-testid="coach-reply">
            <span class="coach-tag">Coach</span>{{ coachReply }}
          </p>
          <p v-else-if="askError" class="coach-error" role="alert" data-testid="coach-error">{{ askError }}</p>
        </section>
      </main>

      <section v-else-if="completedSession" class="finish-card" data-testid="scaffold-complete">
        <UIcon name="i-lucide-circle-check-big" class="size-12 text-primary-600" />
        <h2>Walkthrough complete</h2>
        <p>You built the relationship and checked every move.</p>
        <UButton label="Return to practice" to="/sample-Items" icon="i-lucide-arrow-right" trailing />
      </section>
    </template>
  </UContainer>
</template>

<style scoped>
.walkthrough-page { max-width: 72rem; }
.loading-board { display: grid; min-height: 24rem; place-items: center; align-content: center; gap: .8rem; border: 1px solid var(--mt-border); border-radius: 1rem; }
.loading-board p { margin: 0; color: var(--mt-text-sub); }
.runner-main { margin-top: 1.25rem; }
.step-bar { display: flex; align-items: center; gap: 1rem; }
.step-count { flex: none; color: var(--mt-text-muted); font: 700 .68rem "JetBrains Mono", monospace; text-transform: uppercase; letter-spacing: .04em; }
.progress-track { flex: 1; overflow: hidden; height: .3rem; border-radius: 999px; background: var(--mt-bg-inset); }
.progress-track span { display: block; height: 100%; border-radius: inherit; background: var(--color-primary-600); transition: width 200ms ease; }
.step-heading { padding: .9rem .1rem 1rem; }
.step-heading h2 { max-width: 46rem; margin: 0; font-size: clamp(1.1rem, 2.4vw, 1.45rem); font-weight: 550; line-height: 1.35; }
.coach-panel { margin-top: 1rem; padding: .9rem 1rem; border: 1px solid var(--mt-border); border-radius: .8rem; background: var(--mt-bg-elevated); }
.coach-form { display: flex; align-items: end; gap: .6rem; }
.coach-input { flex: 1; }
.coach-reply, .coach-error { margin: .8rem 0 0; line-height: 1.55; }
.coach-reply { color: var(--mt-text); }
.coach-tag { display: inline-block; margin-right: .5rem; padding: .05rem .4rem; border-radius: .3rem; background: var(--mt-bg-inset); color: var(--mt-text-muted); font: 700 .62rem "JetBrains Mono", monospace; text-transform: uppercase; vertical-align: middle; }
.coach-error { color: var(--color-error-600); }
.finish-card { display: grid; min-height: 24rem; place-items: center; align-content: center; gap: 1rem; border: 1px solid var(--mt-border); border-radius: 1rem; background: var(--mt-bg-elevated); text-align: center; }
.finish-card h2, .finish-card p { margin: 0; }
.finish-card p { color: var(--mt-text-sub); }
@media (max-width: 640px) { .step-bar { flex-wrap: wrap; } .progress-track { order: 3; flex-basis: 100%; } .coach-form { flex-direction: column; align-items: stretch; } }
@media (prefers-reduced-motion: reduce) { .progress-track span { transition: none; } }
</style>
