import { z } from 'zod'

const nonnegativeInteger = z.number().int().min(0)
const positiveInteger = z.number().int().min(1)
const id = z.string().trim().min(1)
export const goalConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('fraction-exact'), pairId: id, numerator: nonnegativeInteger, denominator: positiveInteger }).strict(),
  z.object({ type: z.literal('empty-pair'), pairId: id }).strict(),
  z.object({ type: z.literal('empty-region'), regionId: id }).strict(),
  z.object({ type: z.literal('region-total'), regionId: id, value: nonnegativeInteger }).strict(),
  z.object({ type: z.literal('occupied-area'), regionId: id, cells: nonnegativeInteger }).strict(),
  z.object({ type: z.literal('filled-rectangle'), regionId: id, x: nonnegativeInteger, y: nonnegativeInteger, columns: positiveInteger, rows: positiveInteger }).strict(),
])
export const authoringGoalSchema = z.object({
  type: z.literal('all'), conditions: z.array(goalConditionSchema).min(1),
}).strict()
export type GoalCondition = z.infer<typeof goalConditionSchema>
/** Conditions combine with AND. null means no goal authored, never success.
 * Fractions compare raw totals (2/3 rejects 4/6); no equivalence goal exists.
 * Empty pairs require BOTH tracks empty. Region totals sum rod values.
 * Occupied area counts distinct ground cells: a tower occupies one cell.
 * Rectangles require exactly their cells, without holes or extra cells.
 * Rectangle coordinates are region-relative; unconstrained regions are ignored.
 */
export type AuthoringGoal = z.infer<typeof authoringGoalSchema>
