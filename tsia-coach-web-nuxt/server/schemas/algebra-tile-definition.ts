import { z } from 'zod'

export const AlgebraTileDefinitionSchema = z.object({
  term: z.enum(['one', 'x', 'y', 'xSquared', 'ySquared', 'xy']),
  sign: z.enum(['positive', 'negative']),
  coefficient: z.union([z.literal(1), z.literal(-1)]),
  shape: z.enum(['square', 'rectangle']),
  dimensions: z.object({
    width: z.enum(['one', 'x', 'y']),
    height: z.enum(['one', 'x', 'y']),
  }),
}).refine(tile => tile.coefficient === (tile.sign === 'positive' ? 1 : -1), {
  message: 'Tile sign and coefficient must agree.',
})

export type AlgebraTileDefinition = z.infer<typeof AlgebraTileDefinitionSchema>
