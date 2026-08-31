import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { MathNode, SampleItem } from '#shared/types/sample-items'

export type FocusTarget =
  | { kind: 'token', id: string }
  | { kind: 'phrase', id: string }
  | { kind: 'answer', id: string }
  | { kind: 'mathObject', id: string }
  | { kind: 'mathNode', id: string }
  | { kind: 'semanticFact', id: string }

export interface FocusTargetCommand {
  itemId: string
  target: FocusTarget
}

export type LoadState = 'idle' | 'loading' | 'loaded' | 'error'
export type SubmissionState = 'idle' | 'submitting' | 'submitted' | 'error'

export const useSampleItemsStore = defineStore('sampleItems', () => {
  const items = ref<SampleItem[]>([])
  const selectedItemId = ref<string | null>(null)
  const selectedAnswerId = ref<string | null>(null)
  const focusTarget = ref<FocusTarget | null>(null)
  const loadState = ref<LoadState>('idle')
  const submissionState = ref<SubmissionState>('idle')
  const loadError = ref<string | null>(null)
  const submittedAnswerIsCorrect = ref<boolean | null>(null)

  const selectedItem = computed(() =>
    items.value.find(item => item.id === selectedItemId.value) ?? null
  )

  const selectedAnswer = computed(() =>
    selectedItem.value?.answers.find(
      answer => answer.id === selectedAnswerId.value
    ) ?? null
  )

  const tokensById = computed(() => new Map(
    selectedItem.value?.text.tokens.map(token => [token.id, token]) ?? []
  ))

  const phrasesById = computed(() => new Map(
    selectedItem.value?.text.phrases.map(phrase => [phrase.id, phrase]) ?? []
  ))

  const answersById = computed(() => new Map(
    selectedItem.value?.answers.map(answer => [answer.id, answer]) ?? []
  ))

  const mathObjectsById = computed(() => new Map(
    selectedItem.value?.mathematics.objects.map(object => [object.id, object]) ?? []
  ))

  const mathNodesById = computed(() => {
    const entries: Array<[string, MathNode]> = []

    for (const object of selectedItem.value?.mathematics.objects ?? []) {
      for (const node of object.nodes) {
        entries.push([node.id, node])
      }
    }

    return new Map(entries)
  })

  const answerMathObjectIds = computed(() => new Map(
    selectedItem.value?.answerMathBindings.map(binding => [
      binding.answerChoiceId,
      binding.mathObjectId
    ]) ?? []
  ))

  const semanticFactsById = computed(() => new Map(
    selectedItem.value?.semantics.latentFacts.map(fact => [fact.id, fact]) ?? []
  ))

  const semanticFactIdsByMathObjectId = computed(() => {
    const entries: Array<[string, string[]]> = []

    for (const fact of selectedItem.value?.semantics.latentFacts ?? []) {
      if (fact.type !== 'derivedExpression') {
        continue
      }

      const existing = entries.find(([mathObjectId]) =>
        mathObjectId === fact.mathObjectId
      )

      if (existing) {
        existing[1].push(fact.id)
      } else {
        entries.push([fact.mathObjectId, [fact.id]])
      }
    }

    return new Map(entries)
  })

  function resetInteraction() {
    selectedAnswerId.value = null
    focusTarget.value = null
    submissionState.value = 'idle'
    submittedAnswerIsCorrect.value = null
  }

  function selectItem(itemId: string) {
    if (!items.value.some(item => item.id === itemId)) {
      return
    }

    if (selectedItemId.value !== itemId) {
      selectedItemId.value = itemId
      resetInteraction()
    }
  }

  function selectAnswer(answerChoiceId: string) {
    if (!answersById.value.has(answerChoiceId)) {
      return
    }

    selectedAnswerId.value = answerChoiceId
    focusTarget.value = { kind: 'answer', id: answerChoiceId }
    submissionState.value = 'idle'
    submittedAnswerIsCorrect.value = null
  }

  function focus(target: FocusTarget) {
    focusTarget.value = target
  }

  function focusForItem(command: FocusTargetCommand) {
    selectItem(command.itemId)

    if (selectedItemId.value === command.itemId) {
      focus(command.target)
    }
  }

  function clearFocus() {
    focusTarget.value = null
  }

  async function load() {
    loadState.value = 'loading'
    loadError.value = null

    try {
      items.value = await $fetch<SampleItem[]>('/api/sample-items')
      loadState.value = 'loaded'

      const currentStillExists = items.value.some(
        item => item.id === selectedItemId.value
      )

      if (!currentStillExists) {
        selectedItemId.value = items.value[0]?.id ?? null
        resetInteraction()
      }
    } catch (error) {
      loadState.value = 'error'
      loadError.value = error instanceof Error
        ? error.message
        : 'Could not load the sample items.'
    }
  }

  async function submitSelectedAnswer() {
    const item = selectedItem.value
    const answerId = selectedAnswerId.value

    if (!item || !answerId) {
      submissionState.value = 'error'
      submittedAnswerIsCorrect.value = null
      return
    }

    submissionState.value = 'submitting'
    await Promise.resolve()
    submittedAnswerIsCorrect.value = answerId === item.correctAnswerId
    submissionState.value = 'submitted'
  }

  return {
    items,
    selectedItemId,
    selectedAnswerId,
    focusTarget,
    loadState,
    submissionState,
    loadError,
    submittedAnswerIsCorrect,
    selectedItem,
    selectedAnswer,
    tokensById,
    phrasesById,
    answersById,
    mathObjectsById,
    mathNodesById,
    answerMathObjectIds,
    semanticFactsById,
    semanticFactIdsByMathObjectId,
    load,
    selectItem,
    selectAnswer,
    focus,
    focusForItem,
    clearFocus,
    submitSelectedAnswer
  }
})
