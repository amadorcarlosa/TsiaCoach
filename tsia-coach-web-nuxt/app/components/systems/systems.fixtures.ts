import type { SystemsBoardConfig } from './systems.schema'

/**
 * Development problems. The runtime never reads a solution from here: tests
 * may know that x=3, y=5 and x=14, y=4 solve them, but nothing on screen does.
 */
export const systemsFixtures = {
  development: {
    label: '3x + 5y = 34, 4x + 2y = 22',
    config: {
      layout: 'continuous',
      staging: false,
      system: {
        equations: [
          { id: 'equation-1', coefficients: { x: 3, y: 5 }, targetArea: 34 },
          { id: 'equation-2', coefficients: { x: 4, y: 2 }, targetArea: 22 },
        ],
      },
      laneColumns: 34,
      regionGapRows: 1,
    },
  },
  longVariable: {
    label: '2x + y = 32, x + 3y = 26',
    config: {
      layout: 'continuous',
      staging: false,
      system: {
        equations: [
          { id: 'equation-1', coefficients: { x: 2, y: 1 }, targetArea: 32 },
          { id: 'equation-2', coefficients: { x: 1, y: 3 }, targetArea: 26 },
        ],
      },
      laneColumns: 32,
      regionGapRows: 1,
    },
  },
  /** Artboards 1-8: candidates (21,1), (13,4), (5,7). */
  rodCountReference: {
    label: 'Rod counts: 3x + 8y = 71, 9x + 4y = 73',
    config: {
      layout: 'continuous',
      staging: false,
      strategy: 'rod-count',
      system: {
        equations: [
          { id: 'equation-1', coefficients: { x: 3, y: 8 }, targetArea: 71 },
          { id: 'equation-2', coefficients: { x: 9, y: 4 }, targetArea: 73 },
        ],
      },
      laneColumns: 26,
      regionGapRows: 2,
    },
  },
  /** Exchanges three 4-rods for two 6-rods: (7,1) then (4,3). */
  rodCountSmall: {
    label: 'Rod counts: 4x + 6y = 34, 5x + 2y = 26',
    config: {
      layout: 'continuous',
      staging: false,
      strategy: 'rod-count',
      system: {
        equations: [
          { id: 'equation-1', coefficients: { x: 4, y: 6 }, targetArea: 34 },
          { id: 'equation-2', coefficients: { x: 5, y: 2 }, targetArea: 26 },
        ],
      },
      laneColumns: 11,
      regionGapRows: 2,
    },
  },
} as const satisfies Record<string, { label: string; config: SystemsBoardConfig }>

export type SystemsFixtureId = keyof typeof systemsFixtures
