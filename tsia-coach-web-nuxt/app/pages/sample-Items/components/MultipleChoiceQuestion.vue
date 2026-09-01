<script setup lang="ts">
import type {
  PromptMultipleChoiceInteraction,
  PracticeItemPrompt
} from '#shared/types/sample-items'
import type { CoachMoveResponse } from '#shared/types/coaching'
import type { InteractiveTextSegment } from '~/utils/interactive-text'
import type {
  FocusTarget,
  SampleItemAnswerView,
  SampleItemFeedback
} from '../sample-items-ui'
import { Styles } from '../design'
import SampleItemsAnswerChoices from './AnswerChoices.vue'
import SampleItemsCoachingCard from './CoachingCard.vue'

defineProps<{
  practiceItem: PracticeItemPrompt
  interaction: PromptMultipleChoiceInteraction
  itemPosition: number
  stemSegments: InteractiveTextSegment[]
  answers: SampleItemAnswerView[]
  selectedAnswerId: string | null
  focusTarget: FocusTarget | null
  isTerminal: boolean
  isSubmitting: boolean
  feedback: SampleItemFeedback | null
  coachingButtonLabel: string | null
  isCoachingRequesting: boolean
  coachingMove: CoachMoveResponse | null
  coachingError: string | null
  coachingAttemptId: string | null
}>()

const emit = defineEmits<{
  selectAnswer: [answerId: string]
  focus: [target: FocusTarget]
  submit: []
  requestCoaching: []
  retryCoaching: []
}>()
</script>

<template>
  <article
    :class="Styles.QuestionCard"
    :data-practice-item-id="practiceItem.id"
    data-interaction-type="prompt"
  >
    <header :class="Styles.QuestionHeader">
      <div :class="Styles.QuestionHeaderLayout">
        <div :class="Styles.QuestionIdentity">
          <span :class="Styles.QuestionPosition">
            {{ itemPosition }}
          </span>

          <div>
            <p :class="Styles.QuestionMetaTitle">
              Algebraic reasoning
            </p>
            <p :class="Styles.QuestionMetaInstruction">
              Select one answer
            </p>
          </div>
        </div>

        <span :class="Styles.QuestionId">
          {{ practiceItem.id }}
        </span>
      </div>
    </header>

    <div :class="Styles.QuestionBody">
      <p :class="Styles.QuestionCopy">
        <PracticeInteractiveText
          :segments="stemSegments"
          :focus-target="focusTarget"
          @focus="emit('focus', $event)"
        />
      </p>

      <SampleItemsAnswerChoices
        :answers="answers"
        :selected-answer-id="selectedAnswerId"
        :focus-target="focusTarget"
        :is-disabled="isTerminal || isSubmitting"
        @select="emit('selectAnswer', $event)"
        @focus="emit('focus', $event)"
      />

      <div :class="Styles.QuestionActions">
        <p :class="Styles.QuestionHint">
          Choose the expression that answers the question.
        </p>

        <UButton
          v-if="coachingButtonLabel"
          :label="coachingButtonLabel"
          icon="i-lucide-message-circle-question"
          variant="outline"
          size="lg"
          data-testid="coaching-button"
          :loading="isCoachingRequesting"
          :disabled="isCoachingRequesting"
          @click="emit('requestCoaching')"
        />

        <UButton
          label="Check answer"
          icon="i-lucide-arrow-right"
          trailing
          size="lg"
          :loading="isSubmitting"
          :disabled="isTerminal || isSubmitting || !selectedAnswerId"
          @click="emit('submit')"
        />
      </div>

      <UAlert
        v-if="feedback"
        :class="Styles.Feedback"
        :color="feedback.color"
        :icon="feedback.icon"
        :title="feedback.title"
        :description="feedback.description"
        variant="subtle"
        aria-live="polite"
      />

      <SampleItemsCoachingCard
        :move="coachingMove"
        :error="coachingError"
        :attempt-id="coachingAttemptId"
        @retry="emit('retryCoaching')"
      />
    </div>
  </article>
</template>
