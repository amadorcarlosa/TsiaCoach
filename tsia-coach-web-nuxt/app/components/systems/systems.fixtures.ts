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
} as const satisfies Record<string, { label: string; config: SystemsBoardConfig }>

export type SystemsFixtureId = keyof typeof systemsFixtures
