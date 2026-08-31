<script setup lang="ts">
import type { SampleItem } from '#shared/types/sample-items'
import { getMultipleChoiceInteraction } from '#shared/types/sample-items'
import type {
  FreshScene,
  QuantityJoinScene,
  RodSeriesResource,
  Scaffold,
  ScaffoldStep
} from '#shared/types/scaffolds'
import { latentExpressionText, latentScalarValue } from '~/utils/scaffold-math'
import { sliceSourceText } from '~/utils/interactive-text'

const props = defineProps<{
  scaffold: Scaffold
  step: ScaffoldStep
  practiceItem: SampleItem
  completed: boolean
}>()

const emit = defineEmits<{
  complete: []
}>()

type CheckState = 'idle' | 'correct' | 'incorrect'

const whiteCount = ref(0)
const oddSelections = ref<Set<number>>(new Set())
const classificationName = ref<'odd' | 'even' | null>(null)
const gapProgress = ref(0)
const scalarAnswer = ref<number | null>(null)
const joinedParts = ref<Set<number>>(new Set())
const expressionAnswer = ref<string | null>(null)
const answerChoiceId = ref<string | null>(null)
const checkState = ref<CheckState>('idle')
const classificationNames = ['odd', 'even'] as const

const actionType = computed(() => props.step.action.type)

const rodSeries = computed(() => props.scaffold.resources.find(resource =>
  resource.type === 'rodSeriesResource'
) as RodSeriesResource | undefined)

const measurementLengths = computed(() =>
  rodSeries.value?.lengths.map(Number) ?? []
)

const freshScene = computed(() =>
  props.step.scene.type === 'freshScene'
    ? props.step.scene as FreshScene
    : null
)

const joinScene = computed(() => {
  const definition = freshScene.value?.definition
  return definition?.type === 'quantityJoinScene'
    ? definition as QuantityJoinScene
    : null
})

const isKnownJoin = computed(() =>
  (joinScene.value?.bindings.length ?? 0) > 0
)

const baseLabel = computed(() => isKnownJoin.value ? '15' : 'n')
const baseLength = computed(() => isKnownJoin.value ? 15 : 8)

const expectedScalar = computed(() => {
  const check = props.step.successCheck
  return check.type === 'matchesLatentScalar'
    ? latentScalarValue(props.practiceItem, check.expectedValueId)
    : null
})

const expectedExpression = computed(() => {
  const check = props.step.successCheck
  return check.type === 'matchesLatentExpression'
    ? latentExpressionText(props.practiceItem, check.expectedExpressionId)
    : null
})

const expressionOptions = computed(() => {
  if (expectedExpression.value === 'n + (n + 2)') {
    return ['n + 2', 'n + (n + 2)', '2n + 1']
  }

  return ['n + 2', '2n + 1', '2n + 2']
})

const multipleChoiceInteraction = computed(() =>
  getMultipleChoiceInteraction(props.practiceItem)
)

const answerViews = computed(() =>
  multipleChoiceInteraction.value?.answers.map(answer => ({
    id: answer.id,
    label: sliceSourceText(props.practiceItem, answer.labelCharacterSpan),
    expression: sliceSourceText(props.practiceItem, answer.contentCharacterSpan)
  })) ?? []
)

const canCheck = computed(() => {
  switch (actionType.value) {
    case 'matchEquivalentLength':
      return whiteCount.value > 0
    case 'classifyByFit':
      return oddSelections.value.size > 0
    case 'nameFitClassification':
      return classificationName.value !== null
    case 'traverseAllGaps':
      return gapProgress.value === 4
    case 'joinQuantities':
      return joinedParts.value.size === 2
    case 'enterScalar':
      return scalarAnswer.value !== null
    case 'buildExpression':
      return expressionAnswer.value !== null
    case 'selectAnswerChoice':
      return answerChoiceId.value !== null
    default:
      return false
  }
})

const checkLabel = computed(() => {
  switch (actionType.value) {
    case 'matchEquivalentLength': return 'Check the match'
    case 'classifyByFit': return 'Check the group'
    case 'nameFitClassification': return 'Check the name'
    case 'traverseAllGaps': return 'Check every gap'
    case 'joinQuantities': return 'Check the joined train'
    case 'selectAnswerChoice': return 'Check answer'
    default: return 'Check response'
  }
})

const feedbackText = computed(() => {
  if (checkState.value === 'correct') {
    return actionType.value === 'traverseAllGaps'
      ? 'The same red rod crosses every gap. The step stays 2.'
      : 'That structure is correct. Keep it on the board.'
  }

  if (checkState.value === 'incorrect') {
    if (actionType.value === 'classifyByFit') {
      return 'Try the red rod again. Select only lengths that leave one white unit.'
    }

    if (actionType.value === 'enterScalar') {
      return 'Read the object again: are you counting pieces, or measuring a length?'
    }

    return 'The pieces do not match yet. Adjust the board and check again.'
  }

  return null
})

function clearCheck() {
  if (checkState.value !== 'idle') {
    checkState.value = 'idle'
  }
}

function toggleOdd(length: number) {
  const next = new Set(oddSelections.value)
  next.has(length) ? next.delete(length) : next.add(length)
  oddSelections.value = next
  clearCheck()
}

function chooseClassification(value: 'odd' | 'even') {
  classificationName.value = value
  clearCheck()
}

function crossGap(index: number) {
  if (index === gapProgress.value) {
    gapProgress.value += 1
    clearCheck()
  }
}

function toggleJoinedPart(index: number) {
  const next = new Set(joinedParts.value)
  next.has(index) ? next.delete(index) : next.add(index)
  joinedParts.value = next
  clearCheck()
}

function chooseScalar(value: number) {
  scalarAnswer.value = value
  clearCheck()
}

function chooseExpression(value: string) {
  expressionAnswer.value = value
  clearCheck()
}

function chooseAnswer(id: string) {
  answerChoiceId.value = id
  clearCheck()
}

function checkResponse() {
  let correct = false

  switch (actionType.value) {
    case 'matchEquivalentLength':
      correct = whiteCount.value === 2
      break
    case 'classifyByFit':
      correct = [1, 3, 5, 7, 9].every(value => oddSelections.value.has(value))
        && oddSelections.value.size === 5
      break
    case 'nameFitClassification':
      correct = classificationName.value === 'odd'
      break
    case 'traverseAllGaps':
      correct = gapProgress.value === 4
      break
    case 'joinQuantities':
      correct = joinedParts.value.size === 2
      break
    case 'enterScalar':
      correct = scalarAnswer.value === expectedScalar.value
      break
    case 'buildExpression':
      correct = expressionAnswer.value === expectedExpression.value
      break
    case 'selectAnswerChoice':
      correct = answerChoiceId.value ===
        multipleChoiceInteraction.value?.correctAnswerId
      break
  }

  checkState.value = correct ? 'correct' : 'incorrect'

  if (correct) {
    emit('complete')
  }
}

function resetInteraction() {
  whiteCount.value = 0
  oddSelections.value = new Set()
  classificationName.value = null
  gapProgress.value = 0
  scalarAnswer.value = null
  joinedParts.value = new Set()
  expressionAnswer.value = null
  answerChoiceId.value = null
  checkState.value = props.completed ? 'correct' : 'idle'
}

watch(() => props.step.id, resetInteraction, { immediate: true })
watch(() => props.completed, value => {
  if (value) {
    checkState.value = 'correct'
  }
})
</script>

<template>
  <section
    class="lesson-board"
    :data-step-id="step.id"
    :data-action-type="actionType"
  >
    <div class="board-surface">
      <div class="board-key">
        <span class="key-chip">
          <span class="key-swatch is-red" />
          red = 2 units
        </span>
        <span class="key-chip">
          <span class="key-swatch is-white" />
          white = 1 unit
        </span>
      </div>

      <div
        v-if="actionType === 'matchEquivalentLength'"
        class="equivalence-stage"
      >
        <div class="comparison-row">
          <span class="lane-label">Match</span>
          <ScaffoldRodPiece
            :length="2"
            label="red"
            tone="red"
          />
        </div>
        <div class="comparison-row">
          <span class="lane-label">Build</span>
          <div class="white-train target-two">
            <ScaffoldRodPiece
              v-for="index in whiteCount"
              :key="index"
              :length="1"
              label="1"
              tone="white"
            />
            <button
              v-if="whiteCount < 3"
              type="button"
              class="add-piece"
              aria-label="Add one white rod"
              @click="whiteCount += 1; clearCheck()"
            >
              + white
            </button>
          </div>
        </div>
      </div>

      <div
        v-else-if="actionType === 'classifyByFit'"
        class="measure-stage"
      >
        <div class="probe-dock">
          <span class="lane-label">Probe</span>
          <ScaffoldRodPiece
            :length="2"
            label="2"
            tone="red"
          />
          <span class="probe-note">Select every length that leaves one white.</span>
        </div>
        <div class="rod-grid">
          <ScaffoldRodPiece
            v-for="length in measurementLengths"
            :key="length"
            :length="length"
            :label="String(length)"
            tone="ink"
            interactive
            :selected="oddSelections.has(length)"
            @select="toggleOdd(length)"
          />
        </div>
      </div>

      <div
        v-else-if="actionType === 'nameFitClassification'"
        class="name-stage"
      >
        <p class="board-caption">Every survivor leaves exactly one white unit.</p>
        <div class="survivor-row">
          <ScaffoldRodPiece
            v-for="length in [1, 3, 5, 7, 9]"
            :key="length"
            :length="length"
            :label="String(length)"
            tone="ink"
          />
        </div>
        <div class="choice-row" role="radiogroup" aria-label="Name this number group">
          <button
            v-for="name in classificationNames"
            :key="name"
            type="button"
            class="response-choice"
            :class="{ 'is-selected': classificationName === name }"
            :aria-pressed="classificationName === name"
            @click="chooseClassification(name)"
          >
            {{ name }}
          </button>
        </div>
      </div>

      <div
        v-else-if="actionType === 'traverseAllGaps'"
        class="staircase-stage"
      >
        <div
          v-for="(length, index) in [1, 3, 5, 7, 9]"
          :key="length"
          class="stair-row"
        >
          <span class="stair-number">{{ length }}</span>
          <ScaffoldRodPiece
            :length="length"
            :label="String(length)"
            tone="ink"
          />
          <ScaffoldRodPiece
            v-if="index < 4"
            :length="2"
            :label="index < gapProgress ? '+2' : '?'"
            tone="red"
            interactive
            :selected="index < gapProgress"
            :dimmed="index > gapProgress"
            @select="crossGap(index)"
          />
        </div>
      </div>

      <div
        v-else-if="actionType === 'joinQuantities'"
        class="join-stage"
      >
        <div class="join-lane">
          <span class="lane-label">First</span>
          <button
            type="button"
            class="quantity-part"
            :class="{ 'is-selected': joinedParts.has(0) }"
            @click="toggleJoinedPart(0)"
          >
            <ScaffoldRodPiece
              :length="baseLength"
              :label="baseLabel"
              tone="teal"
            />
          </button>
        </div>
        <div class="join-lane">
          <span class="lane-label">Next</span>
          <button
            type="button"
            class="quantity-part"
            :class="{ 'is-selected': joinedParts.has(1) }"
            @click="toggleJoinedPart(1)"
          >
            <ScaffoldRodPiece
              :length="baseLength"
              :label="baseLabel"
              tone="teal"
            />
            <ScaffoldRodPiece
              :length="2"
              label="+2"
              tone="red"
            />
          </button>
        </div>
        <div class="sum-lane" :class="{ 'has-sized-target': joinScene?.showSizedTarget }">
          <span class="lane-label">Sum</span>
          <div class="joined-train">
            <template v-if="joinedParts.has(0)">
              <ScaffoldRodPiece
                :length="baseLength"
                :label="baseLabel"
                tone="teal"
              />
            </template>
            <template v-if="joinedParts.has(1)">
              <ScaffoldRodPiece
                :length="baseLength"
                :label="baseLabel"
                tone="teal"
              />
              <ScaffoldRodPiece
                :length="2"
                label="2"
                tone="red"
              />
            </template>
            <span v-if="joinedParts.size === 0" class="empty-lane-copy">
              Select each part to copy it here.
            </span>
          </div>
        </div>
      </div>

      <div
        v-else-if="actionType === 'enterScalar'"
        class="scalar-stage"
      >
        <div
          v-if="step.id === 'step-state-odd-step-length'"
          class="single-measure"
        >
          <ScaffoldRodPiece :length="2" label="? units" tone="red" />
          <span class="measure-bracket">one odd-to-odd step</span>
        </div>
        <div v-else class="frozen-train">
          <ScaffoldRodPiece :length="8" label="15" tone="teal" />
          <ScaffoldRodPiece :length="8" label="15" tone="teal" />
          <ScaffoldRodPiece :length="2" label="2" tone="red" />
        </div>
        <div class="choice-row" role="radiogroup" aria-label="Choose a number">
          <button
            v-for="value in [1, 2, 3]"
            :key="value"
            type="button"
            class="response-choice is-number"
            :class="{ 'is-selected': scalarAnswer === value }"
            :aria-pressed="scalarAnswer === value"
            @click="chooseScalar(value)"
          >
            {{ value }}
          </button>
        </div>
      </div>

      <div
        v-else-if="actionType === 'buildExpression'"
        class="expression-stage"
      >
        <div class="frozen-train symbolic">
          <ScaffoldRodPiece :length="8" label="n" tone="teal" />
          <ScaffoldRodPiece :length="8" label="n" tone="teal" />
          <ScaffoldRodPiece :length="2" label="2" tone="red" />
        </div>
        <div class="expression-options" role="radiogroup" aria-label="Choose an expression">
          <button
            v-for="expression in expressionOptions"
            :key="expression"
            type="button"
            class="expression-choice"
            :class="{ 'is-selected': expressionAnswer === expression }"
            :aria-pressed="expressionAnswer === expression"
            @click="chooseExpression(expression)"
          >
            {{ expression }}
          </button>
        </div>
      </div>

      <div
        v-else-if="actionType === 'selectAnswerChoice'"
        class="answer-stage"
      >
        <div class="answer-grid" role="radiogroup" aria-label="Answer choices">
          <button
            v-for="answer in answerViews"
            :key="answer.id"
            type="button"
            class="answer-choice"
            :class="{ 'is-selected': answerChoiceId === answer.id }"
            :aria-pressed="answerChoiceId === answer.id"
            @click="chooseAnswer(answer.id)"
          >
            <span class="answer-label">{{ answer.label }}</span>
            <span class="answer-expression">{{ answer.expression }}</span>
          </button>
        </div>
      </div>
    </div>

    <footer class="response-dock">
      <p
        v-if="feedbackText"
        class="feedback-copy"
        :class="`is-${checkState}`"
        aria-live="polite"
      >
        <UIcon
          :name="checkState === 'correct' ? 'i-lucide-circle-check' : 'i-lucide-refresh-cw'"
          class="size-4 shrink-0"
        />
        {{ feedbackText }}
      </p>
      <p v-else class="response-hint">
        Work on the board, then check the structure.
      </p>

      <UButton
        :label="checkState === 'correct' ? 'Completed' : checkLabel"
        :icon="checkState === 'correct' ? 'i-lucide-check' : 'i-lucide-scan-line'"
        :color="checkState === 'incorrect' ? 'warning' : 'primary'"
        :variant="checkState === 'correct' ? 'soft' : 'solid'"
        :disabled="!canCheck || checkState === 'correct'"
        @click="checkResponse"
      />
    </footer>
  </section>
</template>

<style scoped>
.lesson-board {
  overflow: hidden;
  border: 1px solid var(--mt-border);
  border-radius: 1.25rem;
  background: var(--mt-bg-elevated);
  box-shadow: var(--mt-shadow-md);
}

.board-surface {
  --board-unit: clamp(0.75rem, 2.3vw, 1.55rem);
  min-height: 29rem;
  padding: clamp(1rem, 3vw, 2rem);
  background-color: #eef3f0;
  background-image:
    linear-gradient(rgb(24 50 58 / 0.09) 1px, transparent 1px),
    linear-gradient(90deg, rgb(24 50 58 / 0.09) 1px, transparent 1px);
  background-size: var(--board-unit) var(--board-unit);
  color: #18323a;
}

:global(.dark) .board-surface {
  background-color: #132126;
  background-image:
    linear-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 0.07) 1px, transparent 1px);
  color: #edf7f5;
}

.board-key {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-bottom: 1.75rem;
}

.key-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid rgb(24 50 58 / 0.16);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.72);
  padding: 0.35rem 0.65rem;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.7rem;
  font-weight: 600;
}

.key-swatch {
  width: 1.15rem;
  height: 0.55rem;
  border: 1px solid rgb(15 23 42 / 0.25);
  border-radius: 0.15rem;
}

.key-swatch.is-red { background: #d84a4a; }
.key-swatch.is-white { background: #fffef9; }

.equivalence-stage,
.measure-stage,
.name-stage,
.staircase-stage,
.join-stage,
.scalar-stage,
.expression-stage,
.answer-stage {
  min-height: 22rem;
}

.equivalence-stage,
.name-stage,
.scalar-stage,
.expression-stage {
  display: grid;
  align-content: center;
  gap: 2rem;
}

.comparison-row,
.join-lane,
.sum-lane {
  display: grid;
  grid-template-columns: 3.5rem minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
}

.comparison-row + .comparison-row,
.join-lane + .join-lane,
.sum-lane {
  margin-top: 1.35rem;
}

.lane-label,
.stair-number {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.62;
}

.white-train,
.joined-train,
.frozen-train,
.survivor-row {
  display: flex;
  min-width: 0;
  align-items: center;
}

.target-two {
  min-height: 3.65rem;
  padding: 0.4rem;
  border: 2px dashed rgb(24 50 58 / 0.28);
  border-radius: 0.65rem;
}

.add-piece {
  margin-left: 0.6rem;
  border: 1px dashed rgb(24 50 58 / 0.35);
  border-radius: 0.5rem;
  background: rgb(255 255 255 / 0.6);
  padding: 0.55rem 0.7rem;
  color: inherit;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.72rem;
  font-weight: 700;
}

.probe-dock {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.probe-note,
.board-caption,
.empty-lane-copy,
.measure-bracket {
  color: currentColor;
  font-size: 0.82rem;
  opacity: 0.68;
}

.rod-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
  gap: 0.75rem 1rem;
}

.survivor-row {
  align-items: flex-end;
  gap: 0.6rem;
  overflow-x: auto;
  padding: 0.5rem 0.25rem 0.8rem;
}

.choice-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
}

.response-choice,
.expression-choice {
  min-width: 7rem;
  border: 1px solid rgb(24 50 58 / 0.22);
  border-radius: 0.75rem;
  background: rgb(255 255 255 / 0.78);
  padding: 0.8rem 1rem;
  color: #18323a;
  font-weight: 700;
  text-transform: capitalize;
  transition: 150ms ease;
}

.response-choice.is-number {
  min-width: 3.5rem;
  font-family: "JetBrains Mono", monospace;
  font-size: 1.05rem;
}

.response-choice.is-selected,
.expression-choice.is-selected {
  border-color: #0f766e;
  background: #0f766e;
  box-shadow: 0 3px 0 #0b5c57;
  color: #fff;
  transform: translateY(-2px);
}

.staircase-stage {
  display: grid;
  align-content: center;
  gap: 0.55rem;
}

.stair-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0;
}

.stair-number {
  width: 2rem;
  flex: none;
}

.quantity-part {
  display: flex;
  width: fit-content;
  border: 0;
  border-radius: 0.65rem;
  background: transparent;
  padding: 0.25rem;
  transition: 150ms ease;
}

.quantity-part:hover,
.quantity-part.is-selected {
  background: rgb(15 118 110 / 0.12);
  box-shadow: 0 0 0 2px rgb(15 118 110 / 0.35);
}

.sum-lane {
  min-height: 5.2rem;
  border-top: 1px solid rgb(24 50 58 / 0.22);
  padding-top: 1.25rem;
}

.sum-lane.has-sized-target .joined-train {
  min-height: 3.75rem;
  border: 2px dashed rgb(15 118 110 / 0.34);
  border-radius: 0.65rem;
  padding: 0.4rem;
}

.single-measure {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
}

.frozen-train {
  justify-content: center;
  overflow-x: auto;
  padding: 1rem 0.25rem;
}

.expression-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.expression-choice {
  min-width: 0;
  font-family: "JetBrains Mono", monospace;
  font-size: clamp(0.8rem, 2vw, 1rem);
  text-transform: none;
}

.answer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.answer-choice {
  display: flex;
  min-height: 4.5rem;
  align-items: center;
  gap: 0.85rem;
  border: 1px solid rgb(24 50 58 / 0.2);
  border-radius: 0.8rem;
  background: rgb(255 255 255 / 0.78);
  padding: 0.8rem;
  color: #18323a;
  text-align: left;
}

.answer-choice.is-selected {
  border-color: #0f766e;
  box-shadow: inset 0 0 0 2px #0f766e;
}

.answer-label {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: #18323a;
  color: #fff;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.76rem;
  font-weight: 700;
}

.answer-expression {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.95rem;
  font-weight: 700;
}

.response-dock {
  display: flex;
  min-height: 4.8rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-top: 1px solid var(--mt-border);
  background: var(--mt-bg-elevated);
  padding: 1rem 1.25rem;
}

.feedback-copy,
.response-hint {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  color: var(--mt-text-sub);
  font-size: 0.85rem;
}

.feedback-copy.is-correct { color: var(--color-green-600); }
.feedback-copy.is-incorrect { color: var(--color-orange-500); }

@media (max-width: 640px) {
  .board-surface {
    min-height: 27rem;
    overflow-x: hidden;
  }

  .rod-grid,
  .answer-grid,
  .expression-options {
    grid-template-columns: 1fr;
  }

  .comparison-row,
  .join-lane,
  .sum-lane {
    grid-template-columns: 1fr;
    gap: 0.45rem;
  }

  .response-dock {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .response-choice,
  .expression-choice,
  .quantity-part {
    transition: none;
  }
}
</style>
