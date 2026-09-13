import { z } from 'zod'

export const Base10Denominations = {
  Ones: 'ones',
  Tens: 'tens',
  Hundreds: 'hundreds',
  Thousands: 'thousands',
  TenThousands: 'tenThousands',
  HundredThousands: 'hundredThousands',
  Millions: 'millions',
} as const

export const BaseTenShapes = {
  Cube: 'cube',
  Long: 'long',
  Flat: 'flat',
} as const

const Base10DenominationSchema = z.enum([
  Base10Denominations.Ones,
  Base10Denominations.Tens,
  Base10Denominations.Hundreds,
  Base10Denominations.Thousands,
  Base10Denominations.TenThousands,
  Base10Denominations.HundredThousands,
  Base10Denominations.Millions,
])

const BaseTenShapeSchema = z.enum([
  BaseTenShapes.Cube,
  BaseTenShapes.Long,
  BaseTenShapes.Flat,
])

const PositiveIntegerSchema = z.coerce.number().int().positive()

export const BaseTenBlockDefinitionSchema = z.object({
  denomination: Base10DenominationSchema,
  value: PositiveIntegerSchema,
  shape: BaseTenShapeSchema,
  dimensions: z.object({
    width: PositiveIntegerSchema,
    depth: PositiveIntegerSchema,
    height: PositiveIntegerSchema,
  }),
})

export type BaseTenBlockDefinition = z.infer<typeof BaseTenBlockDefinitionSchema>
