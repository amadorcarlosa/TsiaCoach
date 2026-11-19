import { Schema } from 'effect'
import { positiveCoercedInteger, schema, type Infer } from '#shared/effect/schema'

export const RodDefinitionSchema = schema(Schema.Struct({
  length: positiveCoercedInteger,
  color: Schema.Literals(['white', 'red', 'lightGreen', 'purple', 'yellow', 'darkGreen', 'black', 'brown', 'blue', 'orange']),
  poses: Schema.Array(Schema.Struct({
    orientation: Schema.Literals(['horizontal', 'vertical', 'tower']),
    dimensions: Schema.Struct({ width: positiveCoercedInteger, depth: positiveCoercedInteger, height: positiveCoercedInteger }),
  })),
}))
export type RodDefinition = Infer<typeof RodDefinitionSchema>
