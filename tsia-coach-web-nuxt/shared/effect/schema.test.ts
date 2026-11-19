import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { positiveCoercedInteger, schema, trimmedId } from './schema'
import { systemsBoardConfigSchema } from '~/components/systems/systems.schema'

describe('Effect Schema compatibility boundaries', () => {
  it('rejects nested excess fields while preserving trimmed values and owned output', () => {
    const parser = schema(Schema.Struct({ value: Schema.Struct({ id: trimmedId }) }), { strict: true })
    expect(parser.safeParse({ value: { id: ' ok ', answer: 'hidden' } }).success).toBe(false)
    const input = { value: { id: ' ok ' } }
    const output = parser.parse(input)
    expect(output).toEqual({ value: { id: 'ok' } })
    output.value.id = 'changed'
    expect(input.value.id).toBe(' ok ')
  })

  it('keeps catalog coercion while excluding unsafe/nonfinite/nonpositive integers', () => {
    const parser = schema(positiveCoercedInteger)
    expect(parser.parse('42')).toBe(42)
    for (const input of [undefined, '', 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(parser.safeParse(input).success).toBe(false)
    }
  })

  it('keeps strategy refinement errors attached to the invalid equation', () => {
    const parsed = systemsBoardConfigSchema.safeParse({
      strategy: 'rod-count', laneColumns: 20, regionGapRows: 1,
      system: { equations: [
        { id: 'one', coefficients: { x: 3, y: 3 }, targetArea: 10 },
        { id: 'two', coefficients: { x: 2, y: 4 }, targetArea: 12 },
      ] },
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(parsed.error.issues).toContainEqual({
      path: ['system', 'equations', 0, 'coefficients'],
      message: 'Rod-count equations need different x and y rod values.',
    })
  })
})
