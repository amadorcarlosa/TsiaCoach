<script setup lang="ts">
import type { PracticeItemPrompt } from '#shared/types/sample-items'
import type {
  ScaffoldLastCheck,
  ScaffoldLearnerResource,
  ScaffoldLearnerRodResource,
  ScaffoldLearnerRodSeriesResource,
  ScaffoldLearnerStep,
  ScaffoldStepSubmission,
} from '#shared/types/scaffolds'
import { mathObjectText } from '~/utils/scaffold-math'
import { sliceSourceText } from '~/utils/interactive-text'

const props = defineProps<{
  resources: ScaffoldLearnerResource[]
  step: ScaffoldLearnerStep
  practiceItem: PracticeItemPrompt
  lastCheck: ScaffoldLastCheck | null
  checking: boolean
}>()

const emit = defineEmits<{
  submit: [submission: ScaffoldStepSubmission]
}>()

const unitRodCount = ref(0)
const leftoverSelections = ref<Set<number>>(new Set())
const integerDomain = ref<'integers' | 'oddIntegers' | 'evenIntegers' | null>(null)
const traversedGapCount = ref(0)
const selectedPartIndexes = ref<Set<number>>(new Set())
const scalarValue = ref<number | null>(null)
const selectedMathObjectId = ref<string | null>(null)
const selectedAnswerChoiceId = ref<string | null>(null)
const equivalenceBoardEl = ref<HTMLElement | null>(null)
const matchBuildZoneEl = ref<HTMLElement | null>(null)
const joinBoardEl = ref<HTMLElement | null>(null)
const joinFirstPartEl = ref<HTMLElement | null>(null)
const joinNextPartEl = ref<HTMLElement | null>(null)
const joinSumLaneEl = ref<HTMLElement | null>(null)
const joinFirstPartLabelText = computed(() => props.step.scene.type === 'quantityJoinScene' && props.step.scene.bindings?.length > 0 ? '15' : 'n')
const joinSecondPartLabelText = computed(() => props.step.scene.type === 'quantityJoinScene' && props.step.scene.bindings?.length > 0 ? '17' : 'n + 2')
const matchSupplyPieceEl = ref<HTMLElement | null>(null)

const matchDropZones = useDropZones(equivalenceBoardEl)
matchDropZones.registerZone('match-build-row', matchBuildZoneEl, { accepts: () => unitRodCount.value < 3 })

const matchDragAnnouncer = useDragAnnouncer()
const { activeZoneId, resetToOrigin } = useDraggablePiece({
  pieceId: 'match-equivalent-length-white-rod',
  el: matchSupplyPieceEl,
  boardEl: equivalenceBoardEl,
  zones: matchDropZones,
  onDropped: () => {
    unitRodCount.value += 1
    clearCheck()
    resetToOrigin()
  },
  announce: matchDragAnnouncer.announce,
  announceLabel: 'white rod',
})

const joinDropZones = useDropZones(joinBoardEl)
joinDropZones.registerZone('sum-lane', joinSumLaneEl, { accepts: pieceId => !selectedPartIndexes.value.has(Number(pieceId)) })
const joinDragAnnouncer = useDragAnnouncer()
const { activeZoneId: joinActiveZoneId0, resetToOrigin: resetJoinFirstToOrigin } = useDraggablePiece({
  pieceId: '0',
  el: joinFirstPartEl,
  boardEl: joinBoardEl,
  zones: joinDropZones,
  onDropped: () => joinPartDropped(0, resetJoinFirstToOrigin),
  announce: message => announceJoinPart(message, 0),
  announceLabel: `First part, ${joinFirstPartLabelText.value}`,
})
const { activeZoneId: joinActiveZoneId1, resetToOrigin: resetJoinNextToOrigin } = useDraggablePiece({
  pieceId: '1',
  el: joinNextPartEl,
  boardEl: joinBoardEl,
  zones: joinDropZones,
  onDropped: () => joinPartDropped(1, resetJoinNextToOrigin),
  announce: message => announceJoinPart(message, 1),
  announceLabel: `Next part, ${joinSecondPartLabelText.value}`,
})

const joinSumLaneIsActive = computed(() => (joinActiveZoneId0.value ?? joinActiveZoneId1.value) === 'sum-lane')

function joinPartLabel(index: number): string {
  if (index === 0) return joinFirstPartLabelText.value
  if (index === 1) return joinSecondPartLabelText.value
  return 'n'
}

function announceJoinPart(message: string, index: number) {
  if (message.startsWith(index === 0 ? 'picked up First part,' : 'picked up Next part,')) {
    joinDragAnnouncer.announce(`picked up ${index === 0 ? 'First' : 'Next'} part, ${joinPartLabel(index)}`)
    return
  }

  joinDragAnnouncer.announce(message)
}

function joinPartDropped(index: number, resetToOrigin: () => void) {
  const next = new Set(selectedPartIndexes.value)
  next.add(index)
  selectedPartIndexes.value = next
  resetToOrigin()
}

function clearCheck() {
  // no-op placeholder for local check-state reset hooks
}

const actionType = computed(() => props.step.action.type)
const scene = computed(() => props.step.scene)
const rodResources = computed(() => props.resources.filter(
  resource => resource.type === 'rodResource',
) as ScaffoldLearnerRodResource[])
const seriesResource = computed(() => props.resources.find(
  resource => resource.type === 'rodSeriesResource',
) as ScaffoldLearnerRodSeriesResource | undefined)
const measurementLengths = computed(() => seriesResource.value?.lengths.map(Number) ?? [])

function rodById(id: string | undefined): ScaffoldLearnerRodResource | undefined {
  return rodResources.value.find(resource => resource.id === id)
}

const unitRod = computed(() => {
  if (scene.value.type === 'rodEquivalenceScene') return rodById(scene.value.unitRodId)
  return rodResources.value.find(resource => resource.role.toLowerCase().includes('unit'))
})

const stepRod = computed(() => {
  if (scene.value.type === 'rodEquivalenceScene') return rodById(scene.value.probeRodId)
  if (scene.value.type === 'rodMeasurementScene') return rodById(scene.value.probeRodId)
  if (scene.value.type === 'rodGapScene') return rodById(scene.value.stepRodId)
  return rodResources.value.find(resource => resource.role.toLowerCase().includes('step'))
})

const stepLength = computed(() => Number(stepRod.value?.length ?? 2))
const unitLength = computed(() => Number(unitRod.value?.length ?? 1))
const displayedClass = computed(() => measurementLengths.value.filter(length =>
  (length - unitLength.value) % stepLength.value === 0,
))
const gapPairs = computed(() => displayedClass.value.slice(0, -1).map((from, index) => ({
  from,
  to: displayedClass.value[index + 1]!,
  resourceId: stepRod.value?.id ?? '',
})))
const joinScene = computed(() => scene.value.type === 'quantityJoinScene' ? scene.value : null)
const answerViews = computed(() => props.practiceItem.interaction.answers.map(answer => ({
  id: answer.id,
  label: sliceSourceText(props.practiceItem, answer.labelCharacterSpan),
  expression: sliceSourceText(props.practiceItem, answer.contentCharacterSpan),
})))
const expressionOptions = computed(() => props.practiceItem.mathematics.objects
  .map(object => ({ id: object.id, text: mathObjectText(props.practiceItem, object.id) }))
  .filter((option): option is { id: string, text: string } => Boolean(option.text)))
const lastResponseWasWrong = computed(() =>
  props.lastCheck?.stepId === props.step.id && !props.lastCheck.satisfied,
)

const canSubmit = computed(() => {
  switch (actionType.value) {
    case 'matchEquivalentLength': return unitRodCount.value > 0
    case 'classifyByFit': return measurementLengths.value.length > 0
    case 'nameFitClassification': return integerDomain.value !== null
    case 'traverseAllGaps': return traversedGapCount.value > 0
    case 'joinQuantities': return selectedPartIndexes.value.size > 0
    case 'enterScalar': return scalarValue.value !== null
    case 'buildExpression': return selectedMathObjectId.value !== null
    case 'selectAnswerChoice': return selectedAnswerChoiceId.value !== null
    default: return false
  }
})

const checkLabel = computed(() => {
  switch (actionType.value) {
    case 'matchEquivalentLength': return 'Check the match'
    case 'classifyByFit': return 'Check the group'
    case 'nameFitClassification': return 'Check the name'
    case 'traverseAllGaps': return 'Check the gaps'
    case 'joinQuantities': return 'Check the joined parts'
    case 'selectAnswerChoice': return 'Check answer'
    default: return 'Check response'
  }
})

function toggleNumber(length: number) {
  const next = new Set(leftoverSelections.value)
  next.has(length) ? next.delete(length) : next.add(length)
  leftoverSelections.value = next
}

function createSubmission(): ScaffoldStepSubmission | null {
  switch (actionType.value) {
    case 'matchEquivalentLength': return { type: 'matchEquivalentLength', unitRodCount: unitRodCount.value }
    case 'classifyByFit': return {
      type: 'classifyByFit',
      classifications: measurementLengths.value.map(length => ({
        length,
        classification: leftoverSelections.value.has(length) ? 'oneUnitLeftover' : 'flush',
      })),
    }
    case 'nameFitClassification': return integerDomain.value
      ? { type: 'nameFitClassification', domain: integerDomain.value }
      : null
    case 'traverseAllGaps': return {
      type: 'traverseAllGaps',
      traversals: gapPairs.value.slice(0, traversedGapCount.value),
    }
    case 'joinQuantities': return {
      type: 'joinQuantities',
      parts: (joinScene.value?.parts ?? [])
        .filter((_, index) => selectedPartIndexes.value.has(index))
        .map(part => 'semanticEntityId' in part
          ? { type: 'semanticQuantity' as const, semanticEntityId: part.semanticEntityId }
          : { type: 'latentExpression' as const, latentMathId: part.latentMathId }),
    }
    case 'enterScalar': return scalarValue.value === null ? null : { type: 'enterScalar', value: scalarValue.value }
    case 'buildExpression': return selectedMathObjectId.value ? { type: 'buildExpression', mathObjectId: selectedMathObjectId.value } : null
    case 'selectAnswerChoice': return selectedAnswerChoiceId.value ? { type: 'selectAnswerChoice', answerChoiceId: selectedAnswerChoiceId.value } : null
    default: return null
  }
}

function submit() {
  const submission = createSubmission()
  if (submission) emit('submit', submission)
}

function resetInputs() {
  unitRodCount.value = 0
  leftoverSelections.value = new Set()
  integerDomain.value = null
  traversedGapCount.value = 0
  selectedPartIndexes.value = new Set()
  scalarValue.value = null
  selectedMathObjectId.value = null
  selectedAnswerChoiceId.value = null
}

watch(() => props.step.id, resetInputs, { immediate: true })
</script>

<template>
  <section class="lesson-board" :data-step-id="step.id" :data-action-type="actionType">
    <div class="board-key">
      <span><i class="rod-swatch is-red" /> step rod = {{ stepLength }} units</span>
      <span><i class="rod-swatch is-white" /> unit rod = {{ unitLength }} unit</span>
    </div>

    <div v-if="actionType === 'matchEquivalentLength'" ref="equivalenceBoardEl" class="board-stage equivalence-stage">
      <p class="stage-label">Build the same length with unit rods.</p>
      <div
        ref="matchBuildZoneEl"
        class="comparison-row"
        :class="{ 'is-active': activeZoneId === 'match-build-row' }"
      >
        <ScaffoldRodPiece :length="stepLength" :label="String(stepLength)" tone="red" />
        <span class="equals">=</span>
        <ScaffoldRodPiece v-for="index in unitRodCount" :key="index" :length="unitLength" :label="String(unitLength)" tone="white" />
      </div>
      <div class="control-row">
        <div class="supply-dock">
          <span>Supply</span>
          <div ref="matchSupplyPieceEl" class="quantity-part" aria-label="White rod supply">
            <ScaffoldRodPiece :length="1" label="1" tone="white" />
          </div>
        </div>
        <button v-if="unitRodCount > 0" type="button" class="add-piece" aria-label="Remove one white rod" @click="unitRodCount--; clearCheck()">
          – white
        </button>
      </div>
      <div class="sr-only" aria-live="polite">{{ matchDragAnnouncer.message }}</div>
    </div>

    <div v-else-if="actionType === 'classifyByFit'" class="board-stage">
      <p class="stage-label">Select the lengths that leave one unit after measuring with the step rod.</p>
      <div class="rod-grid">
        <ScaffoldRodPiece v-for="length in measurementLengths" :key="length" :length="length" :label="String(length)" tone="ink" interactive :selected="leftoverSelections.has(length)" @select="toggleNumber(length)" />
      </div>
    </div>

    <div v-else-if="actionType === 'nameFitClassification'" class="board-stage">
      <div class="rod-grid compact">
        <ScaffoldRodPiece v-for="length in displayedClass" :key="length" :length="length" :label="String(length)" tone="ink" />
      </div>
      <div class="choice-row">
        <button v-for="option in [{ value: 'oddIntegers', label: 'odd' }, { value: 'evenIntegers', label: 'even' }]" :key="option.value" type="button" :class="{ selected: integerDomain === option.value }" @click="integerDomain = option.value as 'oddIntegers' | 'evenIntegers'">{{ option.label }}</button>
      </div>
    </div>

    <div v-else-if="actionType === 'traverseAllGaps'" class="board-stage gap-stage">
      <button v-for="(gap, index) in gapPairs" :key="`${gap.from}-${gap.to}`" type="button" class="gap-card" :class="{ selected: index < traversedGapCount }" @click="traversedGapCount = index + 1">
        <span>{{ gap.from }}</span>
        <ScaffoldRodPiece :length="stepLength" :label="index < traversedGapCount ? String(stepLength) : '?'" tone="red" />
        <span>{{ gap.to }}</span>
      </button>
    </div>

    <div v-else-if="actionType === 'joinQuantities'" class="board-stage">
      <p class="stage-label">Drag the parts into the sum lane.</p>
      <div ref="joinBoardEl" class="join-layout">
        <div class="join-source-row">
          <section class="join-lane">
            <h2 class="join-lane-label">First</h2>
            <div class="join-lane-content">
              <div v-if="joinScene?.parts?.[0]" ref="joinFirstPartEl" class="quantity-part" :class="{ 'is-joined': selectedPartIndexes.has(0) }" :aria-label="`First part, ${joinPartLabel(0)}`">
                <ScaffoldRodPiece :length="8" :label="joinPartLabel(0)" tone="teal" />
              </div>
            </div>
          </section>
          <span class="join-plus" aria-hidden="true">+</span>
          <section class="join-lane">
            <h2 class="join-lane-label">Next</h2>
            <div class="join-lane-content">
              <div v-if="joinScene?.parts?.[1]" ref="joinNextPartEl" class="quantity-part" :class="{ 'is-joined': selectedPartIndexes.has(1) }" :aria-label="`Next part, ${joinPartLabel(1)}`">
                <ScaffoldRodPiece :length="10" :label="joinPartLabel(1)" tone="red" />
              </div>
            </div>
          </section>
        </div>

        <div v-if="joinScene?.parts && joinScene.parts.length > 2" class="join-extra-parts">
          <h2 class="join-lane-label">Extras</h2>
          <div class="join-extra-content">
            <ScaffoldRodPiece v-for="(_part, extraIndex) in joinScene.parts.slice(2)" :key="extraIndex" :length="extraIndex % 2 === 0 ? 8 : 10" :label="`n + ${extraIndex + 2}`" tone="ink" />
          </div>
        </div>

        <section ref="joinSumLaneEl" class="join-sum-lane" :class="{ 'is-active': joinSumLaneIsActive }">
          <h2 class="join-lane-label">Sum</h2>
          <div class="join-sum-content">
            <template v-for="index in [0, 1]" :key="index">
              <div v-if="selectedPartIndexes.has(index)" class="quantity-part">
                <ScaffoldRodPiece :length="index === 0 ? 8 : 10" :label="joinPartLabel(index)" :tone="index === 0 ? 'teal' : 'red'" />
              </div>
            </template>
          </div>
        </section>
      </div>
      <div class="sr-only" aria-live="polite">{{ joinDragAnnouncer.message }}</div>
    </div>

    <div v-else-if="actionType === 'enterScalar'" class="board-stage">
      <section v-if="joinScene?.parts?.length" class="join-sum-lane is-static" aria-label="The joined train: n, n, and a two">
        <h2 class="join-lane-label">Sum</h2>
        <div class="join-sum-content">
          <div class="quantity-part"><ScaffoldRodPiece :length="8" :label="joinPartLabel(0)" tone="teal" /></div>
          <div class="quantity-part"><ScaffoldRodPiece :length="8" :label="joinPartLabel(0)" tone="teal" /></div>
          <div class="quantity-part"><ScaffoldRodPiece :length="2" :label="String(stepLength)" tone="red" /></div>
        </div>
      </section>
      <p class="stage-label">Enter the number you read from the model.</p>
      <UInputNumber v-model="scalarValue" :min="0" size="xl" class="number-input" />
    </div>

    <div v-else-if="actionType === 'buildExpression'" class="board-stage">
      <div class="expression-grid">
        <button v-for="option in expressionOptions" :key="option.id" type="button" :class="{ selected: selectedMathObjectId === option.id }" @click="selectedMathObjectId = option.id">{{ option.text }}</button>
      </div>
    </div>

    <div v-else-if="actionType === 'selectAnswerChoice'" class="board-stage">
      <div class="answer-grid">
        <button v-for="answer in answerViews" :key="answer.id" type="button" :class="{ selected: selectedAnswerChoiceId === answer.id }" @click="selectedAnswerChoiceId = answer.id"><strong>{{ answer.label }}</strong><span>{{ answer.expression }}</span></button>
      </div>
    </div>

    <footer class="response-dock">
      <p v-if="lastResponseWasWrong" class="feedback" aria-live="polite"><UIcon name="i-lucide-refresh-cw" class="size-4" />That does not match the model yet. Adjust your response and try again.</p>
      <p v-else>Build your response, then let the coach check it.</p>
      <UButton :label="checkLabel" icon="i-lucide-scan-line" :loading="checking" :disabled="!canSubmit || checking" data-testid="check-scaffold-response" @click="submit" />
    </footer>
  </section>
</template>

<style scoped>
.lesson-board { overflow: hidden; border: 1px solid var(--mt-border); border-radius: 1.1rem; background: var(--mt-bg-elevated); box-shadow: var(--mt-shadow-sm); }
.board-key { display: flex; flex-wrap: wrap; gap: 1rem; border-bottom: 1px solid var(--mt-border); padding: .75rem 1rem; color: var(--mt-text-muted); font: .68rem "JetBrains Mono", monospace; }
.board-key span { display: flex; align-items: center; gap: .4rem; }
.rod-swatch { width: 1.5rem; height: .45rem; border-radius: 999px; background: #c9373b; }
.rod-swatch.is-white { border: 1px solid var(--mt-border-strong); background: #fff; }
.board-stage { display: grid; min-height: 22rem; align-content: center; gap: 1.5rem; padding: clamp(1.25rem, 4vw, 3rem); background-image: linear-gradient(var(--mt-border) 1px, transparent 1px), linear-gradient(90deg, var(--mt-border) 1px, transparent 1px); background-size: 2rem 2rem; }
.stage-label { margin: 0; color: var(--mt-text-sub); text-align: center; }
.rod-row, .control-row, .choice-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: .75rem; }
.comparison-row {
  --comparison-gap: .75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--comparison-gap);
  width: min(100%, 68rem);
  min-height: 4.8rem;
  margin-inline: auto;
  padding: .85rem 1rem;
  border-radius: .9rem;
  border: 2px dashed color-mix(in srgb, var(--mt-border-strong) 55%, transparent);
  background: color-mix(in srgb, var(--mt-bg-elevated) 92%, transparent);
  transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
}
.comparison-row.is-active {
  border-color: var(--color-primary-600);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--color-primary-500) 14%, transparent);
  background: color-mix(in srgb, var(--color-primary-100) 26%, transparent);
}
.equals { font: 700 1.4rem "JetBrains Mono", monospace; }
.rod-grid { display: grid; grid-template-columns: repeat(5, minmax(5rem, 1fr)); align-items: end; gap: .8rem; }
.rod-grid.compact { grid-template-columns: repeat(5, minmax(3rem, 7rem)); justify-content: center; }
.choice-row button, .expression-grid button, .answer-grid button, .join-grid button, .gap-card { border: 1px solid var(--mt-border-strong); border-radius: .8rem; background: var(--mt-bg-elevated); padding: .8rem 1rem; color: var(--mt-text); }
button.selected { border-color: var(--color-primary-600); background: color-mix(in srgb, var(--color-primary-500) 12%, var(--mt-bg-elevated)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary-500) 22%, transparent); }
.gap-stage { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.gap-card { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .6rem; font: 700 .8rem "JetBrains Mono", monospace; }
.expression-grid, .answer-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; }
.supply-dock {
  display: inline-flex;
  align-items: center;
  gap: .65rem;
  flex-wrap: wrap;
  justify-content: center;
}
.supply-dock span {
  font: 600 .74rem "JetBrains Mono", monospace;
  color: var(--mt-text-muted);
  letter-spacing: .02em;
  text-transform: uppercase;
}
.quantity-part {
  min-width: 44px;
  min-height: 44px;
  padding: .25rem;
  border-radius: .7rem;
  touch-action: none;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: box-shadow 140ms ease;
}
.quantity-part:active { cursor: grabbing; }
.add-piece {
  min-height: 44px;
  border: 1px solid var(--mt-border-strong);
  border-radius: .6rem;
  background: var(--mt-bg-elevated);
  color: var(--mt-text);
  padding: .35rem .8rem;
  font: 700 .74rem "JetBrains Mono", monospace;
  cursor: pointer;
}
.add-piece:hover {
  background: color-mix(in srgb, var(--mt-bg-elevated) 72%, var(--color-primary-500));
}
.add-piece:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--color-primary-500) 34%, transparent);
  outline-offset: 3px;
}
.add-piece:active { transform: translateY(1px); }
.expression-grid button { font: 700 1rem "JetBrains Mono", monospace; }
.answer-grid button { display: grid; grid-template-columns: auto 1fr; gap: .8rem; text-align: left; }
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.number-input { width: min(12rem, 100%); margin: 0 auto; }
.response-dock { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-top: 1px solid var(--mt-border); padding: 1rem; }
.response-dock p { display: flex; align-items: center; gap: .45rem; margin: 0; color: var(--mt-text-muted); font-size: .78rem; }
.response-dock .feedback { color: var(--color-warning-700); }
.join-layout {
  display: grid;
  gap: 1rem;
}
.join-source-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  justify-items: center;
  gap: 1rem;
}
.join-lane {
  width: 100%;
  display: grid;
  justify-items: center;
  gap: .7rem;
}
.join-lane-label {
  margin: 0;
  font: 700 .8rem "JetBrains Mono", monospace;
  color: var(--mt-text-muted);
  text-transform: uppercase;
  letter-spacing: .02em;
}
.join-lane-content {
  min-height: 5rem;
  display: grid;
  place-items: center;
}
.join-plus {
  display: flex;
  align-items: center;
  justify-content: center;
  font: 700 1.2rem "JetBrains Mono", monospace;
  color: var(--mt-text-sub);
  padding-top: 1.6rem;
}
.join-sum-lane.is-static { margin: 0 auto 1rem; max-width: 40rem; }
.join-sum-lane {
  min-height: 5rem;
  border: 2px dashed color-mix(in srgb, var(--mt-border-strong) 60%, transparent);
  border-radius: .9rem;
  background: color-mix(in srgb, var(--mt-bg-elevated) 92%, transparent);
  padding: .85rem 1rem;
  display: grid;
  gap: .7rem;
  align-content: start;
  transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
}
.join-sum-lane.is-active {
  border-color: var(--color-primary-600);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--color-primary-500) 14%, transparent);
  background: color-mix(in srgb, var(--color-primary-100) 26%, transparent);
}
.join-sum-content {
  display: flex;
  flex-wrap: wrap;
  gap: .6rem;
}
.quantity-part.is-joined {
  opacity: .45;
}
.join-extra-parts {
  display: grid;
  gap: .7rem;
  justify-items: center;
}
.join-extra-content {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: .6rem;
}
@media (max-width: 700px) { .rod-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .gap-stage, .join-grid, .expression-grid, .answer-grid { grid-template-columns: 1fr; } .response-dock { align-items: stretch; flex-direction: column; } }
</style>
