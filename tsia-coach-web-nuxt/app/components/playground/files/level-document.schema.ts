import { Schema } from 'effect'
import { integer, positiveInteger, schema, type Infer } from '#shared/effect/schema'
import { authoringGoalSchema } from '../goals/goal.schema'
import { systemsBoardConfigSchema } from '~/components/systems/systems.schema'

const id = Schema.String.check(Schema.isMinLength(1), Schema.makeFilter<string>(value => value.trim().length > 0 || 'IDs must contain a non-whitespace character.'))
export const pointSchema = schema(Schema.Struct({ x: integer, y: integer }), { strict: true })
export const partSchema = schema(Schema.Struct({
  value: Schema.Literals([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  addendGroup: Schema.optional(Schema.Literals([0, 1])),
  sign: Schema.optional(Schema.Literals([1, -1])),
  offset: pointSchema.schema,
  orientation: Schema.Literals(['horizontal', 'vertical', 'tower']),
}), { strict: true })

// Optional fields preserve old files. Strict schemas reject future fields rather
// than dropping signs, roles, strategies, or activity semantics.
export const materialRoleSchema = schema(Schema.Literals(['denominator', 'numerator']))
export const trainSchema = schema(Schema.Struct({
  id, anchor: pointSchema.schema,
  parts: Schema.Array(partSchema.schema).check(Schema.isMinLength(1)),
  materialRole: Schema.optional(materialRoleSchema.schema),
}), { strict: true })
export const stepSchema = schema(Schema.Struct({
  id, title: Schema.String, prompt: Schema.String, trains: Schema.Array(trainSchema.schema),
  goal: Schema.NullOr(authoringGoalSchema.schema),
}), { strict: true })
export const boardDescriptorSchema = schema(Schema.Union([
  Schema.Struct({ kind: Schema.Literal('bar'), config: Schema.Struct({ columns: positiveInteger, targetCount: positiveInteger }) }),
  Schema.Struct({ kind: Schema.Literal('array'), config: Schema.Struct({ columns: positiveInteger, rows: positiveInteger }) }),
  Schema.Struct({ kind: Schema.Literal('fraction'), config: Schema.Struct({ columns: positiveInteger, pairCount: positiveInteger }) }),
  Schema.Struct({ kind: Schema.Literal('mathtabla'), config: Schema.Struct({
    centralColumns: positiveInteger, centralRows: positiveInteger,
    activity: Schema.optional(Schema.Literal('fraction-multiplication')),
  }) }),
  Schema.Struct({ kind: Schema.Literal('systems'), config: systemsBoardConfigSchema.schema }),
]), { strict: true })
export const levelDocumentSchema = schema(Schema.Struct({
  version: Schema.Literal(1), board: boardDescriptorSchema.schema,
  steps: Schema.Array(stepSchema.schema),
}), { strict: true })
export type BoardDescriptor = Infer<typeof boardDescriptorSchema>
export type LevelDocumentV1 = Infer<typeof levelDocumentSchema>
