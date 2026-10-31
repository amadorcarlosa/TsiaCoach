import type { BoardDescriptor } from './files/level-document'
import type { SceneSnapshot } from '~/components/rod/scene/scene-snapshot'
import type { SceneResult } from '~/components/rod/scene/rod.scene.types'

// The page opens on the first tab, so the default comes first.
export const playgroundTabs = [
  { id: 'barModelPlayground', label: 'Bar Rod Playground' },
  { id: 'arrayModelPlayground', label: 'Array Rod Playground' },
  { id: 'fractionModelPlayground', label: 'Fraction Rod Playground' },
  { id: 'mathTablaPlayground', label: 'MathTabla Playground' },
  { id: 'baseTenPlayground', label: 'Base ten' },
  { id: 'algebraTilePlayground', label: 'Algebra tiles' },
] as const

export type PlaygroundId = typeof playgroundTabs[number]['id']

/**
 * Board-sizing defaults every grid playground shares. Tabs spread this into
 * useBoardLayout and override only what differs (e.g. MathTabla's wider
 * portrait preview).
 */
export const playgroundBoardLayout = {
  portraitColumns: 12,
  horizontalPadding: 32,
  maximumCellSize: 36,
  minimumLandscapeCellSize: 24,
  bottomGap: 8,
} as const

/**
 * What every rod playground tab exposes through a template ref. The coach
 * playground reads boards this way, so each rod tab must provide it.
 */
export type RodPlaygroundExposed = {
  capture: () => { board: BoardDescriptor; trains: SceneSnapshot }
  clear: () => SceneResult
}
