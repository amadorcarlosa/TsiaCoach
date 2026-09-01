<script setup lang="ts">
import type { CoachMoveResponse } from '#shared/types/coaching'
import { coachingCardView, coachingErrorView } from '../sample-items-ui'
import { Styles } from '../design'

const props = defineProps<{
  move: CoachMoveResponse | null
  error: string | null
  attemptId: string | null
}>()

const emit = defineEmits<{
  retry: []
}>()

const errorView = computed(() => coachingErrorView(props.error))

const cardView = computed(() =>
  errorView.value ? null : coachingCardView(props.move, props.attemptId)
)
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

      <div
        v-if="cardView.walkthroughHref"
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
