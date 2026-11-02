<script setup lang="ts">
import { computed } from 'vue'
import SceneRod from './SceneRod.vue'
import SceneMarqueeOverlay from './SceneMarqueeOverlay.vue'
import type { trainView } from './train-view'
import type { RodPresentation, RodPreview, ZeroPlaneView } from '~/components/rod/rod.types'
import type { useRodPlaygroundInteraction } from '~/composables/useRodPlaygroundInteraction'

type Piece = ReturnType<typeof trainView>

const props = defineProps<{
  pieces: readonly Piece[]
  cellSize: number
  zeroPlane?: ZeroPlaneView
  controls: ReturnType<typeof useRodPlaygroundInteraction>
  // Portrait preview: hide pieces wholly outside the first N columns. Null shows all.
  clipColumns?: number | null
  /**
   * How a board wants individual pieces drawn. Anything the board omits stays
   * raised, so only the boards that opt in change.
   */
  presentations?: ReadonlyMap<string, RodPresentation> | null
  /**
   * Pieces that are not on the layer being edited. They still render in scene
   * order; they simply take no input, so the active layer stays reachable.
   */
  inertIds?: ReadonlySet<string> | null
  /**
   * Draw order only. Scene order and IDs are untouched, so snapshots and
   * restoration are unaffected by which layer paints on top.
   */
  order?: ((piece: Piece) => number) | null
  /** Decorative previews, such as a zero pair. Never counted or selectable. */
  previews?: ReadonlyMap<string, RodPreview> | null
}>()

const drawn = computed(() => {
  const rank = props.order
  if (!rank) return props.pieces

  return [...props.pieces].sort((a, b) => rank(a) - rank(b))
})

function visible(piece: Piece): boolean {
  const columns = props.clipColumns
  if (columns == null) return true

  return piece.x < columns && piece.x + piece.dimensions.width > 0
}
</script>

<template>
  <SceneRod
    v-for="piece in drawn"
    v-show="visible(piece)"
    :id="piece.id"
    :key="piece.id"
    :value="piece.value"
    :parts="piece.parts"
    :dimensions="piece.dimensions"
    :x="piece.x"
    :y="piece.y"
    :cell-size="cellSize"
    :zero-plane="zeroPlane"
    :presentation="presentations?.get(piece.id) ?? 'raised'"
    :preview="previews?.get(piece.id)"
    :layer-inert="inertIds?.has(piece.id) ?? false"
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
