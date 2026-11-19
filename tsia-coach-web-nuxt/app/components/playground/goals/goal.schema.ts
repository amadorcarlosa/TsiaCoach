import { Schema } from 'effect'
import { integer, nonnegativeInteger, positiveInteger, schema, trimmedId, type Infer } from '#shared/effect/schema'

export const goalConditionSchema = schema(Schema.Union([
  Schema.Struct({ type: Schema.Literal('fraction-exact'), pairId: trimmedId, numerator: nonnegativeInteger, denominator: positiveInteger }),
  Schema.Struct({ type: Schema.Literal('empty-pair'), pairId: trimmedId }),
  Schema.Struct({ type: Schema.Literal('empty-region'), regionId: trimmedId }),
  Schema.Struct({ type: Schema.Literal('region-total'), regionId: trimmedId, value: integer }),
  Schema.Struct({ type: Schema.Literal('occupied-area'), regionId: trimmedId, cells: nonnegativeInteger }),
  Schema.Struct({ type: Schema.Literal('filled-rectangle'), regionId: trimmedId, x: nonnegativeInteger, y: nonnegativeInteger, columns: positiveInteger, rows: positiveInteger }),
]), { strict: true })

export const authoringGoalSchema = schema(Schema.Struct({
  type: Schema.Literal('all'),
  conditions: Schema.Array(goalConditionSchema.schema).check(Schema.isMinLength(1)),
}), { strict: true })

export type GoalCondition = Infer<typeof goalConditionSchema>
/** Conditions combine with AND. Null means no authored goal, never success.
 * Fractions compare raw totals; occupied area counts distinct ground cells.
 * Signed-region and rectangle constraints are enforced by the board adapter.
 */
export type AuthoringGoal = Infer<typeof authoringGoalSchema>
