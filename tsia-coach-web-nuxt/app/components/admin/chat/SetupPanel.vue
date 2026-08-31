<script setup lang="ts">
import type { components } from '~~/server/types/schema'

type Model = components['schemas']['FoundryDeploymentResponse']

const props = defineProps<{
  models: Model[]
  loading?: boolean
}>()

const emit = defineEmits<{
  start: []
}>()

const instructions = defineModel<string>('instructions', { required: true })
const model = defineModel<string>('model', { required: true })

const canStart = computed(() => (
  instructions.value.trim().length > 0
  && model.value.length > 0
  && !props.loading
))
</script>

<template>
  <section class="mt-board mx-auto w-full max-w-3xl overflow-hidden">
    <div class="border-b border-(--mt-border) bg-(--mt-bg-overlay) px-5 py-4 sm:px-6">
      <p class="mt-eyebrow">
        Thread setup
      </p>
      <h2 class="mt-2 text-2xl font-semibold tracking-tight">
        Give the coach a job
      </h2>
      <p class="mt-2 max-w-xl text-sm leading-relaxed text-(--mt-text-sub)">
        Set the instructions that should stay in effect for this conversation, then choose the model that will answer.
      </p>
    </div>

    <div class="space-y-5 bg-(--mt-bg-elevated) p-5 sm:p-6">
      <UFormField
        label="Thread instructions"
        description="Describe the role, tone, boundaries, or output format for the agent."
        required
      >
        <UTextarea
          v-model="instructions"
          :rows="6"
          autoresize
          :maxrows="12"
          placeholder="Example: Act as a TSIA2 math coach. Explain one step at a time and ask the learner to respond before continuing."
          class="w-full"
        />
      </UFormField>

      <div class="flex flex-col gap-4 border-t border-(--mt-border) pt-5 sm:flex-row sm:items-end sm:justify-between">
        <UFormField
          label="Model"
          class="min-w-0 flex-1 sm:max-w-xs"
        >
          <AdminChatModelSelect
            v-model="model"
            :models="models"
            :disabled="loading"
          />
        </UFormField>

        <UButton
          label="Start thread"
          icon="i-lucide-arrow-right"
          trailing
          :disabled="!canStart"
          :loading="loading"
          @click="emit('start')"
        />
      </div>
    </div>
  </section>
</template>
