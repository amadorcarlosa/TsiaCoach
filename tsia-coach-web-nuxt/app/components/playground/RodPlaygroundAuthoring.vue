<script setup lang="ts">
import { ref } from 'vue'
import LevelFileControls from './files/LevelFileControls.vue'
import BoardGoalEditor from './goals/BoardGoalEditor.vue'
import PlaygroundAuthoringControls from './PlaygroundAuthoringControls.vue'
import type { BoardDescriptor } from './files/level-document'
import type { BoardGoalAdapter } from './goals/goal.types'
import type { useRodScene } from '~/composables/useRodScene'
import type { useRodPlaygroundInteraction } from '~/composables/useRodPlaygroundInteraction'
import { useLevelAuthoring } from '~/composables/useLevelAuthoring'
import { useAuthoringControls } from '~/composables/useAuthoringControls'
import { useLevelFiles } from '~/composables/useLevelFiles'

type Interaction = ReturnType<typeof useRodPlaygroundInteraction>

// Getters (like cancelVersion) keep the guards synchronous with the parent's state;
// plain boolean props would lag a tick behind.
const props = defineProps<{
  board: BoardDescriptor
  goalAdapter: BoardGoalAdapter
  scene: ReturnType<typeof useRodScene>
  captureScene: Interaction['captureScene']
  replaceScene: Interaction['replaceScene']
  blocked: () => boolean
  editingDisabled: () => boolean
}>()

const goalEditor = ref<InstanceType<typeof BoardGoalEditor> | null>(null)
const resolveDraft = () => goalEditor.value?.resolveDraft() ?? true

const authoring = useLevelAuthoring({
  goals: props.goalAdapter,
  beforeChange: resolveDraft,
  scene: {
    read: () => props.scene.trains.value,
    capture: props.captureScene,
    checkReplacement: props.scene.checkReplacement,
    replace: props.replaceScene,
  },
  editable: () => !props.editingDisabled(),
})

const authoringControls = useAuthoringControls(
  authoring,
  () => props.blocked(),
)

const levelFiles = useLevelFiles({
  adapter: { board: props.board, goals: props.goalAdapter, validateSnapshot: props.scene.validateSnapshot },
  authoring,
  editable: () => !props.editingDisabled(),
  hasWorkingRods: () => props.scene.trains.value.length > 0,
  resolveDrafts: resolveDraft,
  onImported: authoringControls.reset,
})
</script>

<template>
  <PlaygroundAuthoringControls
    :steps="authoring.steps.value"
    :active-step-id="authoring.activeStepId.value"
    :dirty="authoring.dirty.value"
    :blocked="blocked()"
    :pending-step-id="authoringControls.pendingStepId.value"
    :pending-delete-id="authoringControls.pendingDeleteId.value"
    :pending-delete-title="authoringControls.pendingDeleteTitle.value"
    :deleting-dirty-active="authoringControls.deletingDirtyActive.value"
    :message="authoringControls.message.value"
    @capture="authoringControls.capture"
    @update="authoringControls.update"
    @select-step="authoringControls.requestStep"
    @resolve="authoringControls.resolve"
    @patch="authoringControls.patch"
    @move="authoringControls.move"
    @request-delete="authoringControls.requestDelete"
    @confirm-delete="authoringControls.confirmDelete"
    @cancel-delete="authoringControls.cancelDelete"
  >
    <template #goal-editor="{ stepId, disabled }">
      <BoardGoalEditor
        ref="goalEditor"
        :step-id="stepId"
        :adapter="goalAdapter"
        :disabled="disabled"
        :goal="authoring.steps.value.find(step => step.id === stepId)?.goal ?? null"
        @apply="input => authoring.setGoal(stepId, input)"
      />
    </template>
  </PlaygroundAuthoringControls>
  <LevelFileControls :files="levelFiles" :disabled="editingDisabled()" />
</template>
