<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { CharacterSpan } from '#shared/types/sample-items'
import {
  LoadStates,
  SubmissionStates,
  feedbackFor,
  type SampleItemFeedback
} from './sample-items-ui'
import {
  createAnswerSegments,
  createInteractiveTextSegments,
  normalizeCharacterSpan,
  sliceSourceText
} from '~/utils/interactive-text'
import SampleItemsNavigator from './components/Navigator.vue'
import SampleItemsMultipleChoiceQuestion from './components/MultipleChoiceQuestion.vue'
import { Styles } from './design'
import { useSampleItemsStore } from './sample-items'

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
  submissionError,
  answerMathObjectIds,
  selectedInteraction
} = storeToRefs(store)
const { attemptProjection } = storeToRefs(store)

await callOnce('sample-items-load', () => store.load())

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
  const interaction = selectedInteraction.value

  if (!item || !interaction) {
    return []
  }

  return interaction.answers.map(answer => ({
    id: answer.id,
    label: sliceSourceText(item, answer.labelCharacterSpan),
    segments: createAnswerSegments(item, answer),
    mathObjectId: answerMathObjectIds.value.get(answer.id) ?? null
  }))
})

const itemPosition = computed(() => {
  const index = items.value.findIndex(item => item.id === selectedItemId.value)
  return index < 0 ? 0 : index + 1
})

const feedback = computed<SampleItemFeedback | null>(() => {
  if (submissionError.value) {
    return {
      color: 'error',
      icon: 'i-lucide-triangle-alert',
      title: 'Could not submit answer',
      description: submissionError.value,
    }
  }

  return feedbackFor(attemptProjection.value, submissionState.value)
})
</script>

<template>
  <UContainer :class="Styles.Container">
    <section :class="Styles.Section">
      <div :class="Styles.Header">
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
        v-if="loadState === LoadStates.Error"
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
        v-else-if="loadState === LoadStates.Loading"
        :class="Styles.LoadingBoard"
      >
        <div :class="Styles.LoadingContent">
          <UIcon
            name="i-lucide-loader-circle"
            :class="Styles.LoadingIcon"
          />
          <p :class="Styles.LoadingMessage">
            Loading practice item…
          </p>
        </div>
      </div>

      <template v-else-if="selectedItem">
        <SampleItemsNavigator
          :items="items"
          :selected-item-id="selectedItemId"
          @select="store.selectItem"
        />

        <SampleItemsMultipleChoiceQuestion
          v-if="selectedInteraction"
          :practice-item="selectedItem"
          :interaction="selectedInteraction"
          :item-position="itemPosition"
          :stem-segments="stemSegments"
          :answers="answerViews"
          :selected-answer-id="selectedAnswerId"
          :focus-target="focusTarget"
          :feedback="feedback"
          :is-terminal="store.isAttemptTerminal"
          :is-submitting="submissionState === SubmissionStates.Submitting"
          @select-answer="store.selectAnswer"
          @focus="store.focus"
          @submit="store.submitSelectedAnswer"
        />
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

<style src="./sample-items.css"></style>
