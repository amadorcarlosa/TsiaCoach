import { Result, Schema, SchemaIssue, SchemaTransformation } from 'effect'

/** Decoders return owned mutable DTOs; schemas themselves remain immutable. */
export type MutableDto<T> = T extends object ? { -readonly [K in keyof T]: MutableDto<T[K]> } : T
export type Infer<S extends { readonly schema: Schema.Constraint }> = MutableDto<S['schema']['Type']>
export type ValidationIssue = { path: (string | number)[]; message: string }

export class SchemaValidationError extends Error {
  readonly issues: ValidationIssue[]

  constructor(error: Schema.SchemaError) {
    const issues = SchemaIssue.makeFormatterStandardSchemaV1()(error.issue).issues.map(issue => ({
      path: (issue.path ?? []).map(key => {
        const value = typeof key === 'object' ? key.key : key
        return typeof value === 'number' ? value : String(value)
      }),
      message: issue.message,
    }))
    super(issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '))
    this.name = 'SchemaValidationError'
    this.issues = issues
  }
}

/** Compatibility at existing synchronous UI boundaries, backed entirely by Effect Schema. */
export function schema<S extends Schema.Top & Schema.ConstraintDecoder<unknown>>(
  codec: S,
  options: { strict?: boolean } = {},
) {
  const decode = Schema.decodeUnknownResult(codec, {
    errors: 'all',
    onExcessProperty: options.strict ? 'error' : 'ignore',
  })
  const safeParse = (input: unknown) => {
    const result = decode(input)
    return Result.isSuccess(result)
      ? { success: true as const, data: structuredClone(result.success) as MutableDto<S['Type']> }
      : { success: false as const, error: new SchemaValidationError(result.failure) }
  }
  return {
    schema: codec,
    safeParse,
    parse(input: unknown): MutableDto<S['Type']> {
      const result = safeParse(input)
      if (!result.success) throw result.error
      return result.data
    },
    array() {
      return schema(Schema.Array(codec), options)
    },
  }
}

export const integer = Schema.Number.check(Schema.isInt())
export const nonnegativeInteger = integer.check(Schema.isGreaterThanOrEqualTo(0))
export const positiveInteger = integer.check(Schema.isGreaterThanOrEqualTo(1))
export const nonemptyString = Schema.String.check(Schema.isMinLength(1))
export const trimmedId = Schema.Trim.check(Schema.isMinLength(1))

/** Matches the previous catalog Number coercion before integer/positive validation. */
export const positiveCoercedInteger = Schema.Unknown.pipe(
  Schema.decodeTo(positiveInteger, SchemaTransformation.transform({
    decode: (input: unknown) => Number(input),
    encode: (value: number): unknown => value,
  })),
)
