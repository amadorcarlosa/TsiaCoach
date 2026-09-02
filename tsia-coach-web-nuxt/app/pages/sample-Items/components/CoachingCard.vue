<script setup lang="ts">
import type { CoachMoveResponse } from '#shared/types/coaching'
import { MaxProbeAnswerLength } from '#shared/types/coaching'
import { coachingCardView, coachingErrorView } from '../sample-items-ui'
import { Styles } from '../design'

const props = defineProps<{
  move: CoachMoveResponse | null
  error: string | null
  attemptId: string | null
  isRequesting: boolean
}>()

const emit = defineEmits<{
  retry: []
  answerProbe: [answer: string]
}>()

const probeAnswer = ref('')

const errorView = computed(() => coachingErrorView(props.error))

const cardView = computed(() =>
  errorView.value ? null : coachingCardView(props.move, props.attemptId)
)

const canAnswer = computed(() =>
  probeAnswer.value.trim().length > 0 && !props.isRequesting
)

watch(() => props.move, () => {
  probeAnswer.value = ''
})

function submitAnswer() {
  if (!canAnswer.value) {
    return
  }

  emit('answerProbe', probeAnswer.value.trim())
}
</script>

<template>
  <div aria-live="polite">
    <UAlert
      v-if="errorView"
      data-testid="coaching-error"
      :class="Styles.Feedback"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="errorView.title"
      :description="errorView.description"
      variant="subtle"
      :actions="[{
        'label': errorView.retryLabel,
        'color': 'error',
        'variant': 'outline',
        'data-testid': 'coaching-retry',
        'onClick': () => emit('retry')
      }]"
    />

    <div
      v-else-if="cardView"
      data-testid="coaching-card"
      :class="Styles.CoachingCard"
    >
      <p :class="Styles.CoachingLabel">
        {{ cardView.role === 'question' ? 'Coach question' : 'Coach' }}
      </p>

      <p
        data-testid="coaching-message"
        :class="Styles.CoachingMessage"
      >
        {{ cardView.message }}
      </p>

      <form
        v-if="cardView.probeInput"
        :class="Styles.CoachingActions"
        @submit.prevent="submitAnswer"
      >
        <UTextarea
          v-model="probeAnswer"
          :rows="2"
          :maxlength="MaxProbeAnswerLength"
          autoresize
          placeholder="Answer in your own words"
          aria-label="Your answer to the coach"
          data-testid="coaching-probe-answer"
          class="w-full"
          @keydown.enter.exact.prevent="submitAnswer"
        />
        <UButton
          type="submit"
          label="Answer"
          icon="i-lucide-send"
          :loading="isRequesting"
          :disabled="!canAnswer"
          data-testid="coaching-probe-submit"
        />
      </form>

      <div
        v-else-if="cardView.walkthroughHref"
        :class="Styles.CoachingActions"
      >
        <UButton
          label="Open guided walkthrough"
          icon="i-lucide-blocks"
          :to="cardView.walkthroughHref"
          data-testid="coaching-open-scaffold"
        />
      </div>
    </div>
  </div>
</template>
