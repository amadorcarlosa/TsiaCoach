<script setup lang="ts">
import { computed } from 'vue'
import PreviewDialog from './PreviewDialog.vue'
import type { ZeroPairPlan } from './zero-pair-cancellation'
import { zeroPairEquations, zeroPairExplanation, zeroPairTitle } from './zero-pair-text'

/** Presents a zero-pair plan through the shared confirmation dialog. */
const props = defineProps<{
  plan: ZeroPairPlan | null
  announcement: string
}>()

const emit = defineEmits<{
  confirm: []
  keep: []
}>()

const title = computed(() => props.plan ? zeroPairTitle(props.plan) : '')
const equations = computed(() => props.plan ? zeroPairEquations(props.plan) : [])
const explanation = computed(() => props.plan ? zeroPairExplanation(props.plan) : '')
</script>

<template>
  <PreviewDialog
    :open="plan !== null"
    :title="title"
    :lines="equations"
    lines-label="Equations"
    :description="explanation"
    confirm-label="Cancel pair"
    :announcement="announcement"
    @confirm="emit('confirm')"
    @keep="emit('keep')"
  />
</template>
