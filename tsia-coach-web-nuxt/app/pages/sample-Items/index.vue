<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { CharacterSpan } from '#shared/types/sample-items'
import { useSampleItemsStore } from '~/pages/sample-Items/store'
import {
  createAnswerSegments,
  createInteractiveTextSegments,
  normalizeCharacterSpan,
  sliceSourceText
} from '~/utils/interactive-text'

useSeoMeta({
  title: 'Practice items · TSIA Coach',
  description: 'Work through addressable TSIA mathematics practice items.'
})

const store = useSampleItemsStore()
const {
  items,
  selectedItem,
  selectedItemId,
  selectedAnswerId,
  focusTarget,
  loadState,
  loadError,
  submissionState,
  submittedAnswerIsCorrect,
  answerMathObjectIds
} = storeToRefs(store)

await store.load()

const stemCharacterSpan = computed<CharacterSpan | null>(() => {
  const sentences = selectedItem.value?.text.sentences ?? []
  const first = sentences[0]
  const last = sentences.at(-1)

  if (!first || !last) {
    return null
  }

  const start = normalizeCharacterSpan(first.characterSpan).start
  const end = normalizeCharacterSpan(last.characterSpan).end

  return { start, length: end - start }
})

const stemSegments = computed(() => {
  const item = selectedItem.value
  const span = stemCharacterSpan.value

  return item && span
    ? createInteractiveTextSegments(item, span)
    : []
})

const answerViews = computed(() => {
  const item = selectedItem.value

  if (!item) {
    return []
  }

  return item.answers.map(answer => ({
    ...answer,
    label: sliceSourceText(item, answer.labelCharacterSpan),
    segments: createAnswerSegments(item, answer),
    mathObjectId: answerMathObjectIds.value.get(answer.id) ?? null
  }))
})

const itemPosition = computed(() => {
  const index = items.value.findIndex(item => item.id === selectedItemId.value)
  return index < 0 ? 0 : index + 1
})

const feedback = computed(() => {
  if (submissionState.value !== 'submitted') {
    return null
  }

  return submittedAnswerIsCorrect.value
    ? {
        color: 'success' as const,
        icon: 'i-lucide-circle-check',
        title: 'Correct',
        description: 'That expression represents the requested quantity.'
      }
    : {
        color: 'warning' as const,
        icon: 'i-lucide-lightbulb',
        title: 'Try another expression',
        description: 'Trace the quantities in the question, then choose again.'
      }
})
</script>

<template>
  <UContainer class="py-10 sm:py-14">
    <section class="mx-auto max-w-4xl">
      <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="mt-eyebrow">
            Practice lab
          </p>
          <h1 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Read the structure. Choose the expression.
          </h1>
          <p class="mt-3 max-w-2xl text-base leading-relaxed text-(--mt-text-sub)">
            Every word and math symbol keeps its authored position, so coaching can point to the exact part that matters.
          </p>
        </div>

        <UBadge
          v-if="items.length"
          color="neutral"
          variant="subtle"
          size="lg"
        >
          Item {{ itemPosition }} of {{ items.length }}
        </UBadge>
      </div>

      <UAlert
        v-if="loadState === 'error'"
        color="error"
        icon="i-lucide-triangle-alert"
        title="Practice items could not be loaded"
        :description="loadError ?? 'Start the application through Aspire and try again.'"
        :actions="[{
          label: 'Try again',
          color: 'error',
          variant: 'outline',
          onClick: () => store.load()
        }]"
      />

      <div
        v-else-if="loadState === 'loading'"
        class="mt-board grid min-h-96 place-items-center p-8"
      >
        <div class="text-center">
          <UIcon
            name="i-lucide-loader-circle"
            class="size-7 animate-spin text-primary-600"
          />
          <p class="mt-3 text-sm text-(--mt-text-sub)">
            Loading practice item…
          </p>
        </div>
      </div>

      <template v-else-if="selectedItem">
        <nav
          v-if="items.length > 1"
          class="mb-4 flex flex-wrap gap-2"
          aria-label="Practice item selection"
        >
          <button
            v-for="(item, index) in items"
            :key="item.id"
            type="button"
            class="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-3 focus-visible:outline-primary/25"
            :class="item.id === selectedItemId
              ? 'border-primary-600 bg-primary-600 text-white'
              : 'border-(--mt-border) bg-(--mt-bg-elevated) text-(--mt-text-sub) hover:border-primary-500 hover:text-(--mt-text)'"
            :aria-current="item.id === selectedItemId ? 'page' : undefined"
            :data-practice-item-id="item.id"
            @click="store.selectItem(item.id)"
          >
            Question {{ index + 1 }}
          </button>
        </nav>

        <article
          class="mt-board overflow-hidden"
          :data-practice-item-id="selectedItem.id"
        >
          <header class="border-b border-(--mt-border) bg-(--mt-bg-overlay) px-5 py-4 sm:px-8">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <span class="grid size-9 place-items-center rounded-lg bg-primary-600 font-mono text-sm font-bold text-white">
                  {{ itemPosition }}
                </span>
                <div>
                  <p class="text-sm font-semibold text-(--mt-text)">
                    Algebraic reasoning
                  </p>
                  <p class="text-xs text-(--mt-text-muted)">
                    Select one answer
                  </p>
                </div>
              </div>

              <span class="font-mono text-xs text-(--mt-text-faint)">
                {{ selectedItem.id }}
              </span>
            </div>
          </header>

          <div class="px-5 py-7 sm:px-8 sm:py-10">
            <p class="question-copy text-lg leading-8 text-(--mt-text) sm:text-xl sm:leading-9">
              <PracticeInteractiveText
                :segments="stemSegments"
                :focus-target="focusTarget"
                @focus="store.focus"
              />
            </p>

            <div
              class="mt-8 grid gap-3 sm:grid-cols-2"
              role="radiogroup"
              aria-label="Answer choices"
            >
              <button
                v-for="answer in answerViews"
                :key="answer.id"
                type="button"
                role="radio"
                class="answer-choice group relative flex min-h-20 items-center gap-4 rounded-xl border bg-(--mt-bg-elevated) px-4 py-4 text-left transition focus-visible:outline-3 focus-visible:outline-primary/25"
                :class="answer.id === selectedAnswerId
                  ? 'is-selected border-primary-600'
                  : 'border-(--mt-border) hover:border-primary-400'"
                :aria-checked="answer.id === selectedAnswerId"
                :data-answer-choice-id="answer.id"
                :data-math-object-id="answer.mathObjectId"
                @click="store.selectAnswer(answer.id)"
                @focus="store.focus({ kind: 'answer', id: answer.id })"
                @pointerenter="store.focus({ kind: 'answer', id: answer.id })"
              >
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-full border border-(--mt-border-strong) font-mono text-sm font-bold text-(--mt-text-sub) transition-colors"
                  :class="answer.id === selectedAnswerId
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : ''"
                  aria-hidden="true"
                >
                  {{ answer.label }}
                </span>

                <span class="answer-expression font-mono text-lg font-semibold tracking-wide text-(--mt-text)">
                  <PracticeInteractiveText
                    :segments="answer.segments"
                    :focus-target="focusTarget"
                    @focus="store.focus"
                  />
                </span>
              </button>
            </div>

            <div class="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-(--mt-border) pt-6">
              <p class="text-sm text-(--mt-text-muted)">
                Choose the expression that answers the question.
              </p>

              <UButton
                label="Check answer"
                icon="i-lucide-arrow-right"
                trailing
                size="lg"
                :loading="submissionState === 'submitting'"
                :disabled="!selectedAnswerId"
                @click="store.submitSelectedAnswer()"
              />
            </div>

            <UAlert
              v-if="feedback"
              class="mt-5"
              :color="feedback.color"
              :icon="feedback.icon"
              :title="feedback.title"
              :description="feedback.description"
              variant="subtle"
              aria-live="polite"
            />
          </div>
        </article>
      </template>

      <UAlert
        v-else
        color="neutral"
        icon="i-lucide-inbox"
        title="No practice items are available"
        description="Add a sample item to the API, then reload this page."
      />
    </section>
  </UContainer>
</template>

<style scoped>
.question-copy {
  text-wrap: pretty;
}

.answer-choice {
  box-shadow: 0 1px 0 rgb(0 0 0 / 0.04);
}

.answer-choice:hover {
  transform: translateY(-1px);
  box-shadow: var(--mt-shadow-sm);
}

.answer-choice.is-selected {
  background:
    linear-gradient(135deg, rgb(20 184 166 / 0.09), transparent 55%),
    var(--mt-bg-elevated);
  box-shadow: inset 0 0 0 1px var(--color-primary-600);
}

.answer-expression {
  font-variant-numeric: lining-nums;
}

@media (prefers-reduced-motion: reduce) {
  .answer-choice {
    transition: none;
  }

  .answer-choice:hover {
    transform: none;
  }
}
</style>
