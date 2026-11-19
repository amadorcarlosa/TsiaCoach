import { Schema } from 'effect'
import { positiveCoercedInteger, schema, type Infer } from '#shared/effect/schema'

export const Base10Denominations = {
  Ones: 'ones', Tens: 'tens', Hundreds: 'hundreds', Thousands: 'thousands',
  TenThousands: 'tenThousands', HundredThousands: 'hundredThousands', Millions: 'millions',
} as const
export const BaseTenShapes = { Cube: 'cube', Long: 'long', Flat: 'flat' } as const

export const BaseTenBlockDefinitionSchema = schema(Schema.Struct({
  denomination: Schema.Literals(['ones', 'tens', 'hundreds', 'thousands', 'tenThousands', 'hundredThousands', 'millions']),
  value: positiveCoercedInteger,
  shape: Schema.Literals(['cube', 'long', 'flat']),
  dimensions: Schema.Struct({ width: positiveCoercedInteger, depth: positiveCoercedInteger, height: positiveCoercedInteger }),
}))
export type BaseTenBlockDefinition = Infer<typeof BaseTenBlockDefinitionSchema>
