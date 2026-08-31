<script setup lang="ts">
import type { ChatTurn } from '~/utils/agent'

defineProps<{
  turns: ChatTurn[]
  sending?: boolean
}>()

function speakerFor(turn: ChatTurn): string {
  if (turn.kind === 'user') {
    return 'You'
  }

  if (turn.kind === 'assistant') {
    return turn.model
  }

  return 'Request error'
}
</script>

<template>
  <div
    v-if="turns.length === 0 && !sending"
    class="mt-board flex min-h-80 flex-1 items-center justify-center p-8 text-center"
  >
    <div class="max-w-md">
      <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-(--mt-border) bg-(--mt-bg-elevated)">
        <UIcon
          name="i-lucide-message-square-text"
          class="h-5 w-5 text-primary"
        />
      </div>
      <h2 class="mt-4 text-xl font-semibold tracking-tight">
        The thread is ready
      </h2>
      <p class="mt-2 text-sm leading-relaxed text-(--mt-text-sub)">
        Ask a question, test an instruction, or work through a TSIA2 problem.
      </p>
    </div>
  </div>

  <ol
    v-else
    class="flex flex-1 flex-col gap-4"
    aria-live="polite"
    aria-label="Conversation transcript"
  >
    <li
      v-for="turn in turns"
      :key="turn.id"
      class="max-w-[90%] rounded-xl border px-4 py-3 sm:max-w-[78%]"
      :class="{
        'ml-auto border-primary-500/30 bg-primary-500/8': turn.kind === 'user',
        'mr-auto border-(--mt-border) bg-(--mt-bg-elevated)': turn.kind === 'assistant',
        'mr-auto border-red-600/30 bg-red-600/8 text-red-600': turn.kind === 'error'
      }"
    >
      <div class="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-(--mt-text-muted)">
          {{ speakerFor(turn) }}
        </span>

        <span
          v-if="turn.kind === 'assistant'"
          class="font-mono text-[0.65rem] text-(--mt-text-faint)"
        >
          {{ turn.inputTokens }} in · {{ turn.outputTokens }} out
        </span>
      </div>

      <p class="whitespace-pre-wrap break-words text-sm leading-relaxed">
        {{ turn.text }}
      </p>
    </li>

    <li
      v-if="sending"
      class="mr-auto flex items-center gap-2 rounded-xl border border-(--mt-border) bg-(--mt-bg-elevated) px-4 py-3 text-sm text-(--mt-text-sub)"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="h-4 w-4 animate-spin text-primary"
      />
      Coach is thinking…
    </li>
  </ol>
</template>
