import { z } from 'zod'

/**
 * A two-equation system shown as area models. Coefficients are row (lane)
 * counts and unknowns are lengths along those lanes, so a coefficient of 14
 * means fourteen lanes and a length of 14 is a row of several rods. Neither is
 * ever a rod value.
 */

export const variableIds = ['x', 'y'] as const
export type VariableId = typeof variableIds[number]

export const systemsLimits = {
  maxCoefficient: 20,
  maxTargetArea: 10_000,
  maxLaneColumns: 100,
  maxRegionGapRows: 4,
} as const

const id = z.string().trim().min(1)

export const linearEquationSchema = z.object({
  id,
  coefficients: z.object({
    x: z.number().int().min(1).max(systemsLimits.maxCoefficient),
    y: z.number().int().min(1).max(systemsLimits.maxCoefficient),
  }).strict(),
  targetArea: z.number().int().min(0).max(systemsLimits.maxTargetArea),
}).strict()

export const linearSystemSchema = z.object({
  equations: z.tuple([linearEquationSchema, linearEquationSchema]),
}).strict().refine(
  system => system.equations[0].id !== system.equations[1].id,
  { message: 'Equation IDs must differ.' },
)

export const systemsBoardConfigSchema = z.object({
  system: linearSystemSchema,
  /** Cells per lane: the longest variable length the board can show. */
  laneColumns: z.number().int().min(1).max(systemsLimits.maxLaneColumns),
  /** Rows between the equation bands; each band's heading uses the first. */
  regionGapRows: z.number().int().min(1).max(systemsLimits.maxRegionGapRows),
}).strict()

export type LinearEquation = z.infer<typeof linearEquationSchema>
export type LinearSystem = z.infer<typeof linearSystemSchema>
export type SystemsBoardConfig = z.infer<typeof systemsBoardConfigSchema>
