import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { MathNode, SampleItem } from '#shared/types/sample-items'
import { getMultipleChoiceInteraction } from '#shared/types/sample-items'
import {
  FocusTargetKinds,
  LoadStates,
  SubmissionStates,
  type FocusTarget,
  type FocusTargetCommand,
  type LoadState,
  type SubmissionState
} from './sample-items-ui'

export {
  FocusTargetKinds,
  LoadStates,
  SubmissionStates
} from './sample-items-ui'
export type {
  FocusTarget,
  FocusTargetCommand,
  LoadState,
  SubmissionState
} from './sample-items-ui'

export const useSampleItemsStore = defineStore('sampleItems', () => {
  const items = ref<SampleItem[]>([])
  const selectedItemId = ref<string | null>(null)
  const selectedAnswerId = ref<string | null>(null)
  const focusTarget = ref<FocusTarget | null>(null)
  const loadState = ref<LoadState>(LoadStates.Idle)
  const submissionState = ref<SubmissionState>(SubmissionStates.Idle)
  const loadError = ref<string | null>(null)
  const submittedAnswerIsCorrect = ref<boolean | null>(null)

  const selectedItem = computed(() =>
    items.value.find(item => item.id === selectedItemId.value) ?? null
  )

  const selectedMultipleChoiceInteraction = computed(() => {
    const item = selectedItem.value
    return item ? getMultipleChoiceInteraction(item) : null
  })

  const selectedAnswer = computed(() =>
    selectedMultipleChoiceInteraction.value?.answers.find(
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
    selectedMultipleChoiceInteraction.value?.answers.map(
      answer => [answer.id, answer]
    ) ?? []
  ))

  const mathObjectsById = computed(() => new Map(
    selectedItem.value?.mathematics.objects.map(
      object => [object.id, object]
    ) ?? []
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
    selectedMultipleChoiceInteraction.value?.answerMathBindings.map(binding => [
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
    submissionState.value = SubmissionStates.Idle
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
    focusTarget.value = { kind: FocusTargetKinds.Answer, id: answerChoiceId }
    submissionState.value = SubmissionStates.Idle
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
    loadState.value = LoadStates.Loading
    loadError.value = null

    try {
      items.value = await $fetch<SampleItem[]>('/api/sample-items')
      loadState.value = LoadStates.Loaded

      const currentStillExists = items.value.some(
        item => item.id === selectedItemId.value
      )

      if (!currentStillExists) {
        selectedItemId.value = items.value[0]?.id ?? null
        resetInteraction()
      }
    } catch (error) {
      loadState.value = LoadStates.Error
      loadError.value = error instanceof Error
        ? error.message
        : 'Could not load the sample items.'
    }
  }

  async function submitSelectedAnswer() {
    const interaction = selectedMultipleChoiceInteraction.value
    const answerId = selectedAnswerId.value

    if (!interaction || !answerId) {
      submissionState.value = SubmissionStates.Error
      submittedAnswerIsCorrect.value = null
      return
    }

    submissionState.value = SubmissionStates.Submitting
    await Promise.resolve()
    submittedAnswerIsCorrect.value = answerId === interaction.correctAnswerId
    submissionState.value = SubmissionStates.Submitted
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
    selectedMultipleChoiceInteraction,
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
