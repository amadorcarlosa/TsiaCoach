<script setup lang="ts">
import type { FocusTarget } from '~/pages/sample-Items/sample-items-ui'
import {
  focusTargetForSegment,
  segmentMatchesFocus,
  type InteractiveTextSegment
} from '~/utils/interactive-text'

const props = withDefaults(defineProps<{
  segments: InteractiveTextSegment[]
  focusTarget?: FocusTarget | null
  interactive?: boolean
}>(), {
  focusTarget: null,
  interactive: true
})

const emit = defineEmits<{
  focus: [target: FocusTarget]
}>()

function focusSegment(segment: InteractiveTextSegment) {
  if (!props.interactive) {
    return
  }

  const target = focusTargetForSegment(segment)

  if (target) {
    emit('focus', target)
  }
}
</script>

<template>
  <span class="interactive-text">
    <span
      v-for="segment in segments"
      :key="`${segment.characterStart}:${segment.characterLength}`"
      class="interactive-segment"
      :class="{
        'is-addressable': interactive && Boolean(focusTargetForSegment(segment)),
        'is-focused': segmentMatchesFocus(segment, focusTarget)
      }"
      :data-character-start="segment.characterStart"
      :data-character-length="segment.characterLength"
      :data-token-ids="segment.tokenIds.join(' ')"
      :data-phrase-ids="segment.phraseIds.join(' ')"
      :data-math-object-ids="segment.mathObjectIds.join(' ')"
      :data-math-node-ids="segment.mathNodeIds.join(' ')"
      @pointerenter="focusSegment(segment)"
    >{{ segment.text }}</span>
  </span>
</template>

<style scoped>
.interactive-text {
  white-space: pre-wrap;
}

.interactive-segment {
  border-radius: 0.2em;
  transition:
    background-color 140ms ease,
    box-shadow 140ms ease;
}

.is-addressable {
  cursor: default;
}

.is-focused {
  background: var(--color-purple-bg);
  box-shadow: inset 0 -2px 0 var(--color-purple-500);
}

@media (prefers-reduced-motion: reduce) {
  .interactive-segment {
    transition: none;
  }
}
</style>
