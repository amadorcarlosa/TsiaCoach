import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

type BoardLayoutOptions = {
  boardViewport: Ref<HTMLElement | null>
  workspaceTools: Ref<HTMLElement | null>

  fullColumns: number
  portraitColumns: number
  totalRows: number

  horizontalPadding: number
  maximumCellSize: number
  minimumLandscapeCellSize: number
  bottomGap: number
}

/**
 * The largest cell that fits the measured board. Width always limits it; in a
 * short landscape (phone on its side) height limits it too, but never below a
 * usable minimum, so the board scrolls rather than shrinking to nothing.
 */
export function boardCellSize(input: {
  availableWidth: number
  availableBoardHeight: number
  visibleColumns: number
  boardPaddingY: number
  shortLandscape: boolean
  totalRows: number
  horizontalPadding: number
  maximumCellSize: number
  minimumLandscapeCellSize: number
}): number {
  // Not measured yet (or collapsed): draw at full size rather than at zero.
  if (input.availableWidth <= input.horizontalPadding) {
    return input.maximumCellSize
  }

  const widthFit = (input.availableWidth - input.horizontalPadding) / input.visibleColumns

  // Grid layout height before the visual tilt.
  const heightFit = (input.availableBoardHeight - input.boardPaddingY * 2) / input.totalRows

  return Math.max(
    input.shortLandscape ? input.minimumLandscapeCellSize : 1,
    Math.min(
      input.maximumCellSize,
      widthFit,
      input.shortLandscape ? heightFit : input.maximumCellSize,
    ),
  )
}

export function useBoardLayout(options: BoardLayoutOptions) {
  // Responsive presentation state.
  const compactLayout = ref(false)
  const phonePortrait = ref(false)
  const shortLandscape = ref(false)
  const trayOpen = ref(false)

  // Measurements remain private to this composable.
  const availableWidth = ref(0)
  const availableBoardHeight = ref(0)

  let resizeObserver: ResizeObserver | null = null
  let measurementFrame: number | null = null
  let layoutQueries: MediaQueryList[] = []

  const boardPaddingY = computed(() =>
    shortLandscape.value ? 4 : 24,
  )

  const visibleColumns = computed(() =>
    phonePortrait.value
      ? options.portraitColumns
      : options.fullColumns,
  )

  const cellSize = computed(() => boardCellSize({
    availableWidth: availableWidth.value,
    availableBoardHeight: availableBoardHeight.value,
    visibleColumns: visibleColumns.value,
    boardPaddingY: boardPaddingY.value,
    shortLandscape: shortLandscape.value,
    totalRows: options.totalRows,
    horizontalPadding: options.horizontalPadding,
    maximumCellSize: options.maximumCellSize,
    minimumLandscapeCellSize: options.minimumLandscapeCellSize,
  }))

  function updateLayout(): void {
    const [compact, portrait, short] = layoutQueries
    if (!compact || !portrait || !short) return

    compactLayout.value = compact.matches || short.matches
    phonePortrait.value = portrait.matches
    shortLandscape.value = short.matches

    // Preserve the current behavior when layout modes change.
    trayOpen.value = !portrait.matches && !short.matches
  }

  function measureBoard(): void {
    const viewport = options.boardViewport.value
    if (!viewport) return

    availableWidth.value = viewport.clientWidth

    // Document coordinates prevent page scrolling from changing cell size.
    const boardTop =
      viewport.getBoundingClientRect().top + window.scrollY

    const viewportHeight =
      window.visualViewport?.height ?? window.innerHeight

    availableBoardHeight.value = Math.max(
      0,
      viewportHeight - boardTop - options.bottomGap,
    )
  }

  function scheduleBoardMeasurement(): void {
    if (measurementFrame !== null) return

    // Changing cell size can resize the observed elements.
    // Measure on the next frame, outside observer delivery.
    measurementFrame = window.requestAnimationFrame(() => {
      measurementFrame = null
      measureBoard()
    })
  }

  watch(
    [trayOpen, shortLandscape, phonePortrait],
    measureBoard,
    { flush: 'post' },
  )

  onMounted(() => {
    layoutQueries = [
      window.matchMedia('(max-width: 1119px)'),
      window.matchMedia(
        '(max-width: 600px) and (orientation: portrait)',
      ),
      window.matchMedia(
        '(max-height: 500px) and (orientation: landscape)',
      ),
    ]

    updateLayout()

    layoutQueries.forEach(query => {
      query.addEventListener('change', updateLayout)
    })

    resizeObserver = new ResizeObserver(
      scheduleBoardMeasurement,
    )

    if (options.boardViewport.value) {
      resizeObserver.observe(options.boardViewport.value)
    }

    if (options.workspaceTools.value) {
      resizeObserver.observe(options.workspaceTools.value)
    }

    window.addEventListener('resize', measureBoard)
    window.visualViewport?.addEventListener(
      'resize',
      measureBoard,
    )

    measureBoard()
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()

    if (measurementFrame !== null) {
      window.cancelAnimationFrame(measurementFrame)
    }

    window.removeEventListener('resize', measureBoard)
    window.visualViewport?.removeEventListener(
      'resize',
      measureBoard,
    )

    layoutQueries.forEach(query => {
      query.removeEventListener('change', updateLayout)
    })
  })

  return {
    compactLayout,
    phonePortrait,
    shortLandscape,
    trayOpen,
    visibleColumns,
    cellSize,
    boardPaddingY,
  }
}
