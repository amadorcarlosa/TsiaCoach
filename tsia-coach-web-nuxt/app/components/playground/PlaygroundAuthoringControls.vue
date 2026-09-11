<script setup lang="ts">
import PlaygroundActionButton from './PlaygroundActionButton.vue'
import type { SwitchDecision } from './authoring.types'

defineProps<{
  steps: readonly { id: string; title: string }[]
  activeStepId: string | null
  dirty: boolean
  blocked: boolean
  pendingStepId: string | null
  message: string
}>()

const emit = defineEmits<{
  capture: []
  update: []
  'select-step': [id: string]
  resolve: [decision: SwitchDecision]
}>()
</script>

<template>
  <div class="authoring-controls" role="group" aria-label="Authoring steps">
    <PlaygroundActionButton
      :disabled="blocked || pendingStepId !== null"
      @click="emit('capture')"
    >
      Capture step
    </PlaygroundActionButton>

    <PlaygroundActionButton
      :disabled="
        blocked ||
        activeStepId === null ||
        !dirty ||
        pendingStepId !== null
      "
      @click="emit('update')"
    >
      Update step
    </PlaygroundActionButton>

    <PlaygroundActionButton
      v-for="step in steps"
      :key="step.id"
      :disabled="blocked || pendingStepId !== null"
      :pressed="activeStepId === step.id"
      @click="emit('select-step', step.id)"
    >
      {{ step.title }}
      <span v-if="activeStepId === step.id && dirty">
        (unsaved)
      </span>
    </PlaygroundActionButton>
  </div>

  <div
    v-if="pendingStepId !== null"
    class="authoring-controls authoring-decision"
    role="group"
    aria-label="Unsaved step changes"
  >
    <p>Save changes to the current step before switching?</p>

    <PlaygroundActionButton
      :disabled="blocked"
      @click="emit('resolve', 'save')"
    >
      Save and switch
    </PlaygroundActionButton>

    <PlaygroundActionButton
      :disabled="blocked"
      @click="emit('resolve', 'discard')"
    >
      Discard and switch
    </PlaygroundActionButton>

    <PlaygroundActionButton @click="emit('resolve', 'cancel')">
      Cancel
    </PlaygroundActionButton>
  </div>

  <p class="authoring-message" role="status">
    {{ message }}
  </p>
</template>

<style scoped>
.authoring-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 1100px;
  min-width: 0;
  margin: 8px auto;
  color: var(--mt-text);
}

.authoring-controls > button {
  min-width: 0;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}

.authoring-decision > p {
  flex-basis: 100%;
  margin: 0;
}

.authoring-message {
  max-width: 1100px;
  margin: 8px auto;
  color: var(--mt-text);
  overflow-wrap: anywhere;
}

.authoring-message:empty {
  margin: 0;
}
</style>
