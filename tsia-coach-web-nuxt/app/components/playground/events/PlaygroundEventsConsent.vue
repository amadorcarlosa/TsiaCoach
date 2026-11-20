<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { usePlaygroundConsent } from '~/composables/usePlaygroundEvents'

// Asks once per browser, and only where the action log is on and the
// deployment requires opt-in. Declining leaves every playground usable.
const consent = usePlaygroundConsent()
const retentionDays = Number(useRuntimeConfig().public.playgroundEventsRetentionDays) || 0
const description = 'If you allow it, we save the moves you make in these playgrounds, such as which pieces you add, move or combine, so the coach can give better hints. We never save your name or anything you type.'
  + (retentionDays > 0 ? ` Saved moves are deleted after ${retentionDays} days.` : '')
// The stored choice exists only in the browser; render after mount so
// server and client markup agree.
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})
</script>

<template>
  <UAlert
    v-if="mounted && consent?.required && consent.choice.value === null"
    data-testid="playground-events-consent"
    color="neutral"
    variant="subtle"
    icon="i-lucide-shield-check"
    title="Help your coach see what you tried?"
    :description="description"
  >
    <template #actions>
      <UButton
        label="Allow"
        size="xs"
        data-testid="playground-events-allow"
        @click="consent.choose('granted')"
      />
      <UButton
        label="No thanks"
        size="xs"
        variant="outline"
        color="neutral"
        data-testid="playground-events-decline"
        @click="consent.choose('declined')"
      />
    </template>
  </UAlert>
</template>
