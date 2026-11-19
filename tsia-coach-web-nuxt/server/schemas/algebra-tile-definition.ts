import { Schema } from 'effect'
import { schema, type Infer } from '#shared/effect/schema'

const tile = Schema.Struct({
  term: Schema.Literals(['one', 'x', 'y', 'xSquared', 'ySquared', 'xy']),
  sign: Schema.Literals(['positive', 'negative']),
  coefficient: Schema.Literals([1, -1]),
  shape: Schema.Literals(['square', 'rectangle']),
  dimensions: Schema.Struct({
    width: Schema.Literals(['one', 'x', 'y']),
    height: Schema.Literals(['one', 'x', 'y']),
  }),
})
export const AlgebraTileDefinitionSchema = schema(tile.check(Schema.makeFilter<typeof tile.Type>(
  value => value.coefficient === (value.sign === 'positive' ? 1 : -1) || 'Tile sign and coefficient must agree.',
)))
export type AlgebraTileDefinition = Infer<typeof AlgebraTileDefinitionSchema>
