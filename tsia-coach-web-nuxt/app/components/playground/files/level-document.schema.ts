import { z } from 'zod'
import { authoringGoalSchema } from '../goals/goal.schema'
const positiveInteger = z.number().int().min(1)
const id = z.string().min(1).refine(value => value.trim().length > 0)
export const pointSchema = z.object({ x: z.number().int(), y: z.number().int() }).strict()
// Literal union retains the validated CuisenaireRodValue type, without a cast.
export const partSchema = z.object({
  value: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7), z.literal(8), z.literal(9), z.literal(10)]),
  offset: pointSchema,
  orientation: z.enum(['horizontal', 'vertical', 'tower']),
}).strict()
export const trainSchema = z.object({ id, anchor: pointSchema, parts: z.array(partSchema).min(1) }).strict()
export const stepSchema = z.object({ id, title: z.string(), prompt: z.string(), trains: z.array(trainSchema), goal: authoringGoalSchema.nullable() }).strict()
export const boardDescriptorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('bar'), config: z.object({ columns: positiveInteger, targetCount: positiveInteger }).strict() }).strict(),
  z.object({ kind: z.literal('array'), config: z.object({ columns: positiveInteger, rows: positiveInteger }).strict() }).strict(),
  z.object({ kind: z.literal('fraction'), config: z.object({ columns: positiveInteger, pairCount: positiveInteger }).strict() }).strict(),
  z.object({ kind: z.literal('mathtabla'), config: z.object({ centralColumns: positiveInteger, centralRows: positiveInteger }).strict() }).strict(),
])
export const levelDocumentSchema = z.object({ version: z.literal(1), board: boardDescriptorSchema, steps: z.array(stepSchema) }).strict()
export type BoardDescriptor = z.infer<typeof boardDescriptorSchema>
export type LevelDocumentV1 = z.infer<typeof levelDocumentSchema>
