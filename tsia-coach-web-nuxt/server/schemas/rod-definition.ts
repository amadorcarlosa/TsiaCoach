import { z } from 'zod'

const RodColorSchema = z.enum([
  'white',
  'red',
  'lightGreen',
  'purple',
  'yellow',
  'darkGreen',
  'black',
  'brown',
  'blue',
  'orange',
])

const RodOrientationSchema = z.enum(['horizontal', 'vertical', 'tower'])

const PositiveIntegerSchema = z.coerce.number().int().positive()

export const RodDefinitionSchema = z.object({
  length: PositiveIntegerSchema,
  color: RodColorSchema,
  poses: z.array(z.object({
    orientation: RodOrientationSchema,
    dimensions: z.object({
      width: PositiveIntegerSchema,
      depth: PositiveIntegerSchema,
      height: PositiveIntegerSchema,
    }),
  })),
})

export type RodDefinition = z.infer<typeof RodDefinitionSchema>
