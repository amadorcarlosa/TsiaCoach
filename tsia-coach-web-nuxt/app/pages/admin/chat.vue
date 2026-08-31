<script setup lang="ts">
import type { components } from '~~/server/types/schema'
import {
  requestAgentTurn,
  toHistory,
  type ChatTurn
} from '~/utils/agent'

type Model = components['schemas']['FoundryDeploymentResponse']
type ChatPhase = 'setup' | 'chatting'

definePageMeta({
  layout: 'admin'
})

useSeoMeta({
  title: 'Agent chat · TSIA Coach',
  description: 'Run and inspect TSIA Coach agent conversations.'
})

const {
  data: models,
  status: modelsStatus,
  error: modelsError,
  refresh: refreshModels
} = await useFetch<Model[]>('/api/models', {
  default: () => []
})

const phase = ref<ChatPhase>('setup')
const model = ref('')
const instructions = ref('')
const prompt = ref('')
const turns = ref<ChatTurn[]>([])
const isSending = ref(false)

watch(models, (availableModels) => {
  if (!availableModels?.some(item => item.name === model.value)) {
    model.value = availableModels?.[0]?.name ?? ''
  }
}, { immediate: true })

function startThread() {
  if (!instructions.value.trim() || !model.value) {
    return
  }

  phase.value = 'chatting'
}

function newThread() {
  phase.value = 'setup'
  instructions.value = ''
  prompt.value = ''
  turns.value = []
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Agent request failed.'
}

async function send() {
  const text = prompt.value.trim()

  if (isSending.value || !text || !model.value) {
    return
  }

  isSending.value = true

  try {
    const result = await requestAgentTurn({
      model: model.value,
      instructions: instructions.value,
      prompt: text,
      history: toHistory(turns.value)
    })

    turns.value.push({
      id: crypto.randomUUID(),
      kind: 'user',
      text
    }, {
      id: crypto.randomUUID(),
      kind: 'assistant',
      text: result.text,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens
    })

    prompt.value = ''
  } catch (error) {
    turns.value.push({
      id: crypto.randomUUID(),
      kind: 'error',
      text: messageFor(error)
    })
  } finally {
    isSending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-9rem)] flex-col gap-6">
    <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="mt-eyebrow">
          Agent workspace
        </p>
        <h1 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Coach chat
        </h1>
        <p class="mt-3 max-w-2xl text-base leading-relaxed text-(--mt-text-sub)">
          Configure a thread, select an available deployment, and inspect each response from the coaching agent.
        </p>
      </div>

      <UButton
        v-if="phase === 'chatting'"
        label="New thread"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        class="self-start sm:self-auto"
        @click="newThread"
      />
    </section>

    <UAlert
      v-if="modelsError"
      title="The model catalog could not be loaded"
      description="Confirm the API is available, then try loading the catalog again."
      icon="i-lucide-triangle-alert"
      color="error"
      variant="subtle"
      :actions="[{ label: 'Try again', color: 'error', variant: 'outline', onClick: () => refreshModels() }]"
    />

    <AdminChatSetupPanel
      v-if="phase === 'setup'"
      v-model:instructions="instructions"
      v-model:model="model"
      :models="models"
      :loading="modelsStatus === 'pending'"
      @start="startThread"
    />

    <section
      v-else
      class="flex flex-1 flex-col gap-4"
    >
      <AdminChatTranscript
        :turns="turns"
        :sending="isSending"
        class="min-h-0"
      />

      <div class="mt-overlay sticky bottom-0 z-10 -mx-2 px-2 pt-3">
        <UChatPrompt
          v-model="prompt"
          placeholder="Ask the coach…"
          color="neutral"
          variant="outline"
          :disabled="isSending"
          :autofocus="true"
          :maxrows="10"
          :ui="{ root: 'mt-panel', base: 'px-1.5' }"
          @submit="send"
        >
          <template #footer>
            <AdminChatModelSelect
              v-model="model"
              :models="models"
              :disabled="isSending"
            />

            <UButton
              type="submit"
              icon="i-lucide-arrow-up"
              color="primary"
              :loading="isSending"
              :disabled="!prompt.trim() || !model"
              aria-label="Send message"
              class="ml-auto rounded-full"
            />
          </template>
        </UChatPrompt>

        <p class="py-2 text-center text-xs text-(--mt-text-faint)">
          Enter sends · Shift+Enter adds a line
        </p>
      </div>
    </section>
  </div>
</template>
