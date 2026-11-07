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

/**
 * How the board reads its material. 'row-length' (the default, and every file
 * saved before strategies existed): coefficients are lane counts and unknowns
 * are row lengths. 'rod-count': unknowns count rods and each coefficient is the
 * value of every rod standing for that variable in that equation.
 */
export const systemsStrategies = ['row-length', 'rod-count'] as const
export type SystemsStrategy = typeof systemsStrategies[number]

export const difficultyProfiles = ['introductory', 'standard', 'advanced'] as const
export type DifficultyProfile = typeof difficultyProfiles[number]

/** Rod-count rods are real Cuisenaire rods, so coefficients name one rod value. */
export const rodCountLimits = { maxCoefficient: 9 } as const

/** Provenance of a generated problem: the same settings regenerate it. */
export const generationSchema = z.object({
  seed: z.number().int().min(0).max(0xffffffff),
  profile: z.enum(difficultyProfiles),
}).strict()

const boardConfigObject = z.object({
  system: linearSystemSchema,
  /** Omitted means 'row-length', so older files keep their meaning. */
  strategy: z.enum(systemsStrategies).optional(),
  generation: generationSchema.optional(),
  /** Omitted in older saved levels, whose original spaced coordinates remain valid. */
  layout: z.literal('continuous').optional(),
  /** Omitted in saved boards that include the legacy staging region. */
  staging: z.boolean().optional(),
  /** Cells per lane: the longest variable length the board can show. */
  laneColumns: z.number().int().min(1).max(systemsLimits.maxLaneColumns),
  /** Rows between the equation bands; each band's heading uses the first. */
  regionGapRows: z.number().int().min(1).max(systemsLimits.maxRegionGapRows),
}).strict()

export const strategyOf = (config: { readonly strategy?: SystemsStrategy; readonly system: unknown }): SystemsStrategy =>
  config.strategy ?? 'row-length'

/**
 * Rod-count boards tell x from y by rod value (and colour), so the two
 * coefficients of an equation must differ, and each must be a rod value 1-9.
 */
export const systemsBoardConfigSchema = boardConfigObject.superRefine((config, context) => {
  if (strategyOf(config) !== 'rod-count') {
    if (config.generation) context.addIssue({ code: 'custom', path: ['generation'], message: 'Only rod-count boards are generated.' })
    return
  }
  config.system.equations.forEach((equation, index) => {
    const { x, y } = equation.coefficients
    if (x > rodCountLimits.maxCoefficient || y > rodCountLimits.maxCoefficient) {
      context.addIssue({ code: 'custom', path: ['system', 'equations', index, 'coefficients'], message: `Rod-count coefficients are rod values from 1 to ${rodCountLimits.maxCoefficient}.` })
    }
    if (x === y) {
      context.addIssue({ code: 'custom', path: ['system', 'equations', index, 'coefficients'], message: 'Rod-count equations need different x and y rod values.' })
    }
    if (equation.targetArea < 1) {
      context.addIssue({ code: 'custom', path: ['system', 'equations', index, 'targetArea'], message: 'Rod-count totals must be positive.' })
    }
  })
})

export type LinearEquation = z.infer<typeof linearEquationSchema>
export type LinearSystem = z.infer<typeof linearSystemSchema>
export type SystemsBoardConfig = z.infer<typeof systemsBoardConfigSchema>
