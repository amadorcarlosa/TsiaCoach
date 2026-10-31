// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { boardCellSize, useBoardLayout } from './useBoardLayout'
import { playgroundBoardLayout } from '~/components/playground/playground.types'

enableAutoUnmount(afterEach)

const base = {
  ...playgroundBoardLayout,
  availableWidth: 0,
  availableBoardHeight: 0,
  visibleColumns: 24,
  boardPaddingY: 24,
  shortLandscape: false,
  totalRows: 12,
}

describe('boardCellSize', () => {
  it('draws at full size before the board is measured', () => {
    expect(boardCellSize({ ...base, availableWidth: 0 })).toBe(36)
    expect(boardCellSize({ ...base, availableWidth: 32 })).toBe(36)
  })

  it('caps a wide board at the maximum cell size', () => {
    expect(boardCellSize({ ...base, availableWidth: 2000 })).toBe(36)
  })

  it('shrinks to fit the width, after padding, across the visible columns', () => {
    // (512 - 32) / 24 = 20
    expect(boardCellSize({ ...base, availableWidth: 512 })).toBe(20)
    // The portrait preview shows fewer columns, so each one is wider.
    expect(boardCellSize({ ...base, availableWidth: 512, visibleColumns: 12 })).toBe(36)
  })

  it('ignores height outside a short landscape', () => {
    expect(boardCellSize({ ...base, availableWidth: 2000, availableBoardHeight: 50 })).toBe(36)
  })

  it('fits height in a short landscape but never below the usable minimum', () => {
    // (12 * 30 + 4 * 2) / 12 rows = 30 per row
    expect(boardCellSize({ ...base, shortLandscape: true, boardPaddingY: 4, availableWidth: 2000, availableBoardHeight: 368 })).toBe(30)
    expect(boardCellSize({ ...base, shortLandscape: true, boardPaddingY: 4, availableWidth: 2000, availableBoardHeight: 100 })).toBe(24)
  })

  it('keeps at least one pixel per cell on a very narrow board', () => {
    expect(boardCellSize({ ...base, availableWidth: 40 })).toBe(1)
  })
})

describe('useBoardLayout', () => {
  // Media queries the composable reads, in its own order.
  const queries = {
    compact: '(max-width: 1119px)',
    portrait: '(max-width: 600px) and (orientation: portrait)',
    short: '(max-height: 500px) and (orientation: landscape)',
  }
  let matches: Set<string>

  beforeEach(() => {
    matches = new Set()
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() { return matches.has(query) },
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  async function setup(width: number) {
    let layout!: ReturnType<typeof useBoardLayout>
    const viewport = ref<HTMLElement | null>(null)

    mount(defineComponent({
      setup() {
        layout = useBoardLayout({
          ...playgroundBoardLayout,
          boardViewport: viewport,
          workspaceTools: ref(null),
          fullColumns: 24,
          totalRows: 12,
        })
        return () => h('div', {
          ref: (element: unknown) => {
            const node = element as HTMLElement | null
            if (node) Object.defineProperty(node, 'clientWidth', { value: width })
            viewport.value = node
          },
        })
      },
    }))
    await nextTick()
    return layout
  }

  it('shows every column with the tray open on a desktop', async () => {
    const layout = await setup(2000)

    expect(layout.phonePortrait.value).toBe(false)
    expect(layout.compactLayout.value).toBe(false)
    expect(layout.trayOpen.value).toBe(true)
    expect(layout.visibleColumns.value).toBe(24)
    expect(layout.cellSize.value).toBe(36)
    expect(layout.boardPaddingY.value).toBe(24)
  })

  it('previews the first columns with the tray closed in phone portrait', async () => {
    matches = new Set([queries.compact, queries.portrait])
    const layout = await setup(400)

    expect(layout.phonePortrait.value).toBe(true)
    expect(layout.compactLayout.value).toBe(true)
    expect(layout.trayOpen.value).toBe(false)
    expect(layout.visibleColumns.value).toBe(12)
    // (400 - 32) / 12
    expect(layout.cellSize.value).toBeCloseTo(30.67, 1)
  })

  it('tightens padding and closes the tray in a short landscape', async () => {
    matches = new Set([queries.compact, queries.short])
    const layout = await setup(900)

    expect(layout.shortLandscape.value).toBe(true)
    expect(layout.compactLayout.value).toBe(true)
    expect(layout.trayOpen.value).toBe(false)
    expect(layout.boardPaddingY.value).toBe(4)
    expect(layout.visibleColumns.value).toBe(24)
  })
})
