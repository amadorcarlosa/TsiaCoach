<script setup lang="ts">
import SceneRod from './SceneRod.vue'
import SceneMarqueeOverlay from './SceneMarqueeOverlay.vue'
import type { trainView } from './train-view'
import type { useRodPlaygroundInteraction } from '~/composables/useRodPlaygroundInteraction'

type Piece = ReturnType<typeof trainView>

const props = defineProps<{
  pieces: readonly Piece[]
  cellSize: number
  controls: ReturnType<typeof useRodPlaygroundInteraction>
  // Portrait preview: hide pieces wholly outside the first N columns. Null shows all.
  clipColumns?: number | null
}>()

function visible(piece: Piece): boolean {
  const columns = props.clipColumns
  if (columns == null) return true

  return piece.x < columns && piece.x + piece.dimensions.width > 0
}
</script>

<template>
  <SceneRod
    v-for="piece in pieces"
    v-show="visible(piece)"
    :id="piece.id"
    :key="piece.id"
    :value="piece.value"
    :parts="piece.parts"
    :dimensions="piece.dimensions"
    :x="piece.x"
    :y="piece.y"
    :cell-size="cellSize"
    :selected="controls.highlightedIds.value.has(piece.id)"
    :disabled="controls.blocked.value"
    :snap-to-grid="true"
    :begin-move="() => controls.interaction.beginMove(piece.id)"
    :constrain-position="(position, direction) => controls.interaction.constrainPosition(piece.id, position, direction)"
    :preview-delta="controls.interaction.previewFor(piece.id)"
    @select="controls.interaction.select(piece.id, $event)"
    @move-preview="controls.interaction.previewMove(piece.id, $event)"
    @settled="controls.interaction.settleMove(piece.id, $event)"
    @move-end="controls.interaction.endMove(piece.id)"
    @menu-request="controls.menu.open"
  />
  <SceneMarqueeOverlay
    :rectangle="controls.marquee.rectangle.value"
    :cell-size="cellSize"
  />
</template>
