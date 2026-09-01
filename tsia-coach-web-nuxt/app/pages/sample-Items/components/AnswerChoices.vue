<script setup lang="ts">
import {
  FocusTargetKinds,
  type FocusTarget,
  type SampleItemAnswerView
} from '../sample-items-ui'
import { Styles } from '../design'

defineProps<{
  answers: SampleItemAnswerView[]
  selectedAnswerId: string | null
  focusTarget: FocusTarget | null
  isDisabled?: boolean
}>()

const emit = defineEmits<{
  select: [answerId: string]
  focus: [target: FocusTarget]
}>()
</script>

<template>
  <div
    :class="Styles.AnswerGrid"
    role="radiogroup"
    aria-label="Answer choices"
  >
    <button
      v-for="answer in answers"
      :key="answer.id"
      type="button"
      role="radio"
      :class="[
        Styles.AnswerChoice,
        answer.id === selectedAnswerId
          ? Styles.AnswerChoiceSelected
          : Styles.AnswerChoiceIdle
      ]"
      :aria-checked="answer.id === selectedAnswerId"
      :data-answer-choice-id="answer.id"
      :data-math-object-id="answer.mathObjectId"
      :disabled="isDisabled"
      @click="emit('select', answer.id)"
      @focus="emit('focus', { kind: FocusTargetKinds.Answer, id: answer.id })"
      @pointerenter="emit('focus', { kind: FocusTargetKinds.Answer, id: answer.id })"
    >
      <span
        :class="[
          Styles.AnswerLabel,
          answer.id === selectedAnswerId
            ? Styles.AnswerLabelSelected
            : undefined
        ]"
        aria-hidden="true"
      >
        {{ answer.label }}
      </span>

      <span :class="Styles.AnswerExpression">
        <PracticeInteractiveText
          :segments="answer.segments"
          :focus-target="focusTarget"
          @focus="emit('focus', $event)"
        />
      </span>
    </button>
  </div>
</template>
