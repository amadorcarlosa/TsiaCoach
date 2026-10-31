import { computed, type Ref } from 'vue'

/**
 * Sizing shared by the track-based Tabla playgrounds (Bar, Fraction): the CSS
 * variables that align the tray with the first track, the board frame width,
 * and the board's accessible name for the portrait preview.
 */
export function useTablaWorkspace(options: {
  /** The board's top inset at the current cell size, from its geometry. */
  topInset: () => number
  cellSize: Readonly<Ref<number>>
  visibleColumns: Readonly<Ref<number>>
  boardPaddingY: Readonly<Ref<number>>
  phonePortrait: Readonly<Ref<boolean>>
  horizontalPadding: number
}) {
  const workspaceStyle = computed(() => ({
    '--grid-top-inset': `${options.topInset()}px`,
    '--workspace-padding-y': `${options.boardPaddingY.value}px`,
  }))

  const boardWidth = computed(() =>
    options.visibleColumns.value * options.cellSize.value + options.horizontalPadding,
  )

  const boardAriaLabel = computed(() =>
    options.phonePortrait.value
      ? 'Rod board preview, columns zero to twelve'
      : 'Rod board, columns zero to twenty-four',
  )

  return { workspaceStyle, boardWidth, boardAriaLabel }
}
