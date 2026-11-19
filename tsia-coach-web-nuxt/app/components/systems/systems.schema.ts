import { Schema } from 'effect'
import { integer, schema, trimmedId, type Infer } from '#shared/effect/schema'

/** Coefficients count lanes; unknowns are row lengths (or rod counts in that strategy). */
export const variableIds = ['x', 'y'] as const
export type VariableId = typeof variableIds[number]
export const systemsLimits = { maxCoefficient: 20, maxTargetArea: 10_000, maxLaneColumns: 100, maxRegionGapRows: 4 } as const
const bounded = (min: number, max: number) => integer.check(Schema.isGreaterThanOrEqualTo(min), Schema.isLessThanOrEqualTo(max))

export const linearEquationSchema = schema(Schema.Struct({
  id: trimmedId,
  coefficients: Schema.Struct({ x: bounded(1, systemsLimits.maxCoefficient), y: bounded(1, systemsLimits.maxCoefficient) }),
  targetArea: bounded(0, systemsLimits.maxTargetArea),
}), { strict: true })
const system = Schema.Struct({ equations: Schema.Tuple([linearEquationSchema.schema, linearEquationSchema.schema]) })
export const linearSystemSchema = schema(system.check(Schema.makeFilter<typeof system.Type>(
  value => value.equations[0].id !== value.equations[1].id || 'Equation IDs must differ.',
)), { strict: true })

export const systemsStrategies = ['row-length', 'rod-count'] as const
export type SystemsStrategy = typeof systemsStrategies[number]
export const difficultyProfiles = ['introductory', 'standard', 'advanced'] as const
export type DifficultyProfile = typeof difficultyProfiles[number]
export const rodCountLimits = { maxCoefficient: 9 } as const
export const generationSchema = schema(Schema.Struct({ seed: bounded(0, 0xffffffff), profile: Schema.Literals(difficultyProfiles) }), { strict: true })
const board = Schema.Struct({
  system: linearSystemSchema.schema,
  strategy: Schema.optional(Schema.Literals(systemsStrategies)),
  generation: Schema.optional(generationSchema.schema),
  layout: Schema.optional(Schema.Literal('continuous')),
  staging: Schema.optional(Schema.Boolean),
  laneColumns: bounded(1, systemsLimits.maxLaneColumns),
  regionGapRows: bounded(1, systemsLimits.maxRegionGapRows),
})
export const strategyOf = (config: { readonly strategy?: SystemsStrategy; readonly system: unknown }): SystemsStrategy => config.strategy ?? 'row-length'

export const systemsBoardConfigSchema = schema(board.check(Schema.makeFilter<typeof board.Type>(config => {
  if (strategyOf(config) !== 'rod-count') {
    return config.generation ? { path: ['generation'], issue: 'Only rod-count boards are generated.' } : undefined
  }
  const issues: Schema.FilterIssue[] = []
  config.system.equations.forEach((equation, index) => {
    const { x, y } = equation.coefficients
    if (x > rodCountLimits.maxCoefficient || y > rodCountLimits.maxCoefficient) issues.push({ path: ['system', 'equations', index, 'coefficients'], issue: `Rod-count coefficients are rod values from 1 to ${rodCountLimits.maxCoefficient}.` })
    if (x === y) issues.push({ path: ['system', 'equations', index, 'coefficients'], issue: 'Rod-count equations need different x and y rod values.' })
    if (equation.targetArea < 1) issues.push({ path: ['system', 'equations', index, 'targetArea'], issue: 'Rod-count totals must be positive.' })
  })
  return issues.length ? issues : undefined
})), { strict: true })

export type LinearEquation = Infer<typeof linearEquationSchema>
export type LinearSystem = Infer<typeof linearSystemSchema>
export type SystemsBoardConfig = Infer<typeof systemsBoardConfigSchema>
