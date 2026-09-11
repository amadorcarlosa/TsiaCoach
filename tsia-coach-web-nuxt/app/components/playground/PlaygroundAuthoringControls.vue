<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import PlaygroundActionButton from './PlaygroundActionButton.vue'
import type {
  StepDirection,
  StepMetadataPatch,
  SwitchDecision,
} from './authoring.types'

const props = defineProps<{
  steps: readonly { id: string; title: string; prompt: string }[]
  activeStepId: string | null
  dirty: boolean
  blocked: boolean
  pendingStepId: string | null
  pendingDeleteId: string | null
  pendingDeleteTitle: string
  deletingDirtyActive: boolean
  message: string
}>()

const emit = defineEmits<{
  capture: []
  update: []
  'select-step': [id: string]
  resolve: [decision: SwitchDecision]
  patch: [id: string, patch: StepMetadataPatch]
  move: [id: string, direction: StepDirection]
  'request-delete': [id: string]
  'confirm-delete': [discardChanges: boolean]
  'cancel-delete': []
}>()

const active = computed(() =>
  props.steps.find(step => step.id === props.activeStepId),
)

const activeIndex = computed(() =>
  props.steps.findIndex(step => step.id === props.activeStepId),
)

const locked = computed(() =>
  props.blocked ||
  props.pendingStepId !== null ||
  props.pendingDeleteId !== null,
)

const captureRef = ref<InstanceType<typeof PlaygroundActionButton> | null>(
  null,
)
const stepRefs = new Map<string, InstanceType<typeof PlaygroundActionButton>>()

function setStepRef(
  el: InstanceType<typeof PlaygroundActionButton> | null,
  id: string,
): void {
  if (el) {
    stepRefs.set(id, el)
  } else {
    stepRefs.delete(id)
  }
}

function focusRemainingControl(): void {
  nextTick(() => {
    const target = props.activeStepId
      ? stepRefs.get(props.activeStepId)
      : null
    const el = (target?.$el ?? captureRef.value?.$el) as
      | HTMLElement
      | undefined
    el?.focus?.()
  })
}

function editMetadata(
  field: 'title' | 'prompt',
  event: Event,
): void {
  if (!active.value || locked.value) return

  const input = event.target as HTMLInputElement | HTMLTextAreaElement
  emit('patch', active.value.id, { [field]: input.value })
}

function confirmDelete(): void {
  emit('confirm-delete', props.deletingDirtyActive)
  focusRemainingControl()
}

function cancelDelete(): void {
  emit('cancel-delete')
  focusRemainingControl()
}
</script>

<template>
  <div class="authoring-controls" role="group" aria-label="Authoring steps">
    <PlaygroundActionButton
      ref="captureRef"
      :disabled="locked"
      @click="emit('capture')"
    >
      Capture step
    </PlaygroundActionButton>

    <PlaygroundActionButton
      :disabled="locked || activeStepId === null || !dirty"
      @click="emit('update')"
    >
      Update step
    </PlaygroundActionButton>

    <PlaygroundActionButton
      v-for="(step, index) in steps"
      :key="step.id"
      :ref="el => setStepRef(el as InstanceType<typeof PlaygroundActionButton> | null, step.id)"
      :disabled="locked"
      :pressed="activeStepId === step.id"
      @click="emit('select-step', step.id)"
    >
      {{ step.title || `Step ${index + 1}` }}
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

  <fieldset
    v-if="active"
    class="step-editor"
    :disabled="locked"
  >
    <legend>Step details</legend>

    <label>
      <span>Title</span>
      <input
        type="text"
        :value="active.title"
        @input="editMetadata('title', $event)"
      >
    </label>

    <label>
      <span>Prompt</span>
      <textarea
        :value="active.prompt"
        rows="3"
        @input="editMetadata('prompt', $event)"
      />
    </label>

    <div class="authoring-controls">
      <PlaygroundActionButton
        :disabled="locked || activeIndex === 0"
        @click="emit('move', active.id, 'earlier')"
      >
        Move earlier
      </PlaygroundActionButton>

      <PlaygroundActionButton
        :disabled="locked || activeIndex === steps.length - 1"
        @click="emit('move', active.id, 'later')"
      >
        Move later
      </PlaygroundActionButton>

      <PlaygroundActionButton
        :disabled="locked"
        @click="emit('request-delete', active.id)"
      >
        Delete step
      </PlaygroundActionButton>
    </div>
  </fieldset>

  <div
    v-if="pendingDeleteId !== null"
    class="authoring-controls authoring-decision"
    role="group"
    aria-label="Confirm step deletion"
  >
    <p>
      Delete "{{ pendingDeleteTitle || 'Untitled step' }}"?
      <span v-if="deletingDirtyActive">
        Its unsaved board changes will also be discarded.
        Cancel and capture another step if you want to keep them.
      </span>
    </p>

    <PlaygroundActionButton
      :disabled="blocked"
      @click="confirmDelete"
    >
      {{ deletingDirtyActive
        ? 'Delete step and discard changes'
        : 'Delete step' }}
    </PlaygroundActionButton>

    <PlaygroundActionButton @click="cancelDelete">
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

.step-editor {
  display: grid;
  gap: 12px;
  box-sizing: border-box;
  max-width: 1100px;
  min-width: 0;
  margin: 12px auto;
  padding: 12px;
  color: var(--mt-text);
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-md);
}

.step-editor label {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.step-editor input,
.step-editor textarea {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 8px;
  font: inherit;
  color: var(--mt-text);
  background: var(--mt-bg-elevated);
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-md);
}

.step-editor textarea {
  resize: vertical;
}

.step-editor .authoring-controls {
  margin: 0;
}
</style>
