<script setup lang="ts">
import type { CharacterSpan, PracticeItemPrompt } from '#shared/types/sample-items'
import {
  createInteractiveTextSegments,
  sliceSourceText
} from '~/utils/interactive-text'

const props = withDefaults(defineProps<{
  practiceItem: PracticeItemPrompt
  focusPhraseIds?: string[]
  answersRevealed?: boolean
}>(), {
  focusPhraseIds: () => [],
  answersRevealed: false
})

const stemSpan = computed<CharacterSpan>(() => {
  const interaction = props.practiceItem.interaction
  const firstAnswerStart = Math.min(
    ...interaction?.answers.map(
      answer => Number(answer.labelCharacterSpan.start)
    ) ?? []
  )
  const end = Number.isFinite(firstAnswerStart)
    ? firstAnswerStart
    : props.practiceItem.text.sourceText.length

  return {
    start: 0,
    length: props.practiceItem.text.sourceText.slice(0, end).trimEnd().length
  }
})

const stemSegments = computed(() =>
  createInteractiveTextSegments(props.practiceItem, stemSpan.value)
)

const focusedPhraseLabels = computed(() => {
  const labels = props.focusPhraseIds
    .map(id => props.practiceItem.text.phrases.find(phrase => phrase.id === id))
    .filter(phrase => Boolean(phrase))
    .map(phrase => sliceSourceText(props.practiceItem, phrase!.characterSpan))

  return [...new Set(labels)]
})

function segmentIsFocused(phraseIds: string[]): boolean {
  return phraseIds.some(id => props.focusPhraseIds.includes(id))
}
</script>

<template>
  <aside class="question-context" aria-labelledby="source-question-label">
    <div class="question-label">
      <span class="question-index">Q</span>
      <div>
        <p id="source-question-label">Original question</p>
        <span>Keep the words beside the model.</span>
      </div>
    </div>

    <p class="question-stem">
      <span
        v-for="segment in stemSegments"
        :key="`${segment.characterStart}:${segment.characterLength}`"
        :class="{ 'is-focused': segmentIsFocused(segment.phraseIds) }"
      >{{ segment.text }}</span>
    </p>

    <div class="question-focus" aria-live="polite">
      <template v-if="answersRevealed">
        <UIcon name="i-lucide-list-checks" class="size-4" />
        <span>Choices A–D are open below.</span>
      </template>
      <template v-else-if="focusedPhraseLabels.length">
        <span class="focus-swatch" />
        <span>
          Words in focus:
          <strong>{{ focusedPhraseLabels.join(' · ') }}</strong>
        </span>
      </template>
      <template v-else>
        <UIcon name="i-lucide-eye" class="size-4" />
        <span>Read the whole relationship first.</span>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.question-context {
  display: grid;
  grid-template-columns: minmax(9.5rem, 0.8fr) minmax(18rem, 2.6fr) minmax(12rem, 1fr);
  align-items: center;
  gap: clamp(1rem, 2.5vw, 2rem);
  margin-bottom: 1.35rem;
  border: 1px solid var(--mt-border);
  border-left: 4px solid var(--color-primary-600);
  border-radius: 0.85rem;
  background:
    linear-gradient(90deg, rgb(13 148 136 / 0.055), transparent 35%),
    var(--mt-bg-elevated);
  padding: 1rem 1.15rem;
  box-shadow: var(--mt-shadow-sm);
}

.question-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.question-index {
  display: grid;
  width: 2.15rem;
  height: 2.15rem;
  flex: none;
  place-items: center;
  border: 1px solid var(--color-primary-300);
  border-radius: 50%;
  color: var(--color-primary-700);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.78rem;
  font-weight: 800;
}

.question-label p {
  margin: 0;
  color: var(--mt-text);
  font-size: 0.8rem;
  font-weight: 750;
}

.question-label div > span {
  color: var(--mt-text-muted);
  font-size: 0.68rem;
}

.question-stem {
  margin: 0;
  color: var(--mt-text);
  font-size: clamp(0.92rem, 1.6vw, 1.05rem);
  font-weight: 560;
  line-height: 1.6;
  text-wrap: pretty;
}

.question-stem span {
  border-radius: 0.18em;
  transition: background-color 160ms ease, box-shadow 160ms ease;
}

.question-stem span.is-focused {
  background: rgb(239 68 68 / 0.1);
  box-shadow: inset 0 -0.18em 0 rgb(216 74 74 / 0.5);
}

.question-focus {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--mt-text-muted);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  line-height: 1.45;
}

.question-focus strong {
  color: var(--mt-text-sub);
  font-weight: 700;
}

.focus-swatch {
  width: 1.4rem;
  height: 0.38rem;
  flex: none;
  border-radius: 999px;
  background: #d84a4a;
}

@media (max-width: 900px) {
  .question-context {
    grid-template-columns: minmax(9rem, 0.8fr) minmax(0, 2fr);
  }

  .question-focus {
    grid-column: 1 / -1;
    border-top: 1px solid var(--mt-border);
    padding-top: 0.75rem;
  }
}

@media (max-width: 560px) {
  .question-context {
    grid-template-columns: 1fr;
    padding: 0.9rem;
  }

  .question-focus {
    grid-column: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .question-stem span {
    transition: none;
  }
}
</style>
