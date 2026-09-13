import { describe, it, expect } from 'vitest'
import {
  Base10Denominations,
  BaseTenBlockDefinitionSchema,
  BaseTenShapes,
} from '#server/schemas/base10-definition'

describe('BaseTenBlockDefinitionSchema', () => {
  const validBaseTenBlock = {
    denomination: 'ones' as const,
    value: 1,
    shape: 'cube' as const,
    dimensions: { width: 1, depth: 1, height: 1 },
  }

  it('should validate a complete valid base ten block', () => {
    const result = BaseTenBlockDefinitionSchema.safeParse(validBaseTenBlock)
    expect(result.success).toBe(true)
  })

  describe('denomination field', () => {
    it('should reject unknown denomination', () => {
      const result = BaseTenBlockDefinitionSchema.safeParse({
        ...validBaseTenBlock,
        denomination: 'billions',
      })
      expect(result.success).toBe(false)
    })

    it('should accept all valid denominations', () => {
      Object.values(Base10Denominations).forEach((denomination) => {
        const result = BaseTenBlockDefinitionSchema.safeParse({
          ...validBaseTenBlock,
          denomination,
        })
        expect(result.success).toBe(true)
      })
    })

    it('should reject missing denomination', () => {
      const { denomination, ...rest } = validBaseTenBlock
      const result = BaseTenBlockDefinitionSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })
  })

  describe('value field', () => {
    it('should accept number value', () => {
      const result = BaseTenBlockDefinitionSchema.safeParse({
        ...validBaseTenBlock,
        value: 100,
      })
      expect(result.success).toBe(true)
    })

    it('should accept string value', () => {
      const result = BaseTenBlockDefinitionSchema.safeParse({
        ...validBaseTenBlock,
        value: '100',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing value', () => {
      const { value, ...rest } = validBaseTenBlock
      const result = BaseTenBlockDefinitionSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })
  })

  describe('shape field', () => {
    it('should reject unknown shape', () => {
      const result = BaseTenBlockDefinitionSchema.safeParse({
        ...validBaseTenBlock,
        shape: 'sphere',
      })
      expect(result.success).toBe(false)
    })

    it('should accept all valid shapes', () => {
      Object.values(BaseTenShapes).forEach((shape) => {
        const result = BaseTenBlockDefinitionSchema.safeParse({
          ...validBaseTenBlock,
          shape,
        })
        expect(result.success).toBe(true)
      })
    })

    it('should reject missing shape', () => {
      const { shape, ...rest } = validBaseTenBlock
      const result = BaseTenBlockDefinitionSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })
  })

  describe('dimensions object', () => {
    it('should accept number dimensions', () => {
      const result = BaseTenBlockDefinitionSchema.safeParse({
        ...validBaseTenBlock,
        dimensions: { width: 10, depth: 1, height: 1 },
      })
      expect(result.success).toBe(true)
    })

    it('should accept string dimensions', () => {
      const result = BaseTenBlockDefinitionSchema.safeParse({
        ...validBaseTenBlock,
        dimensions: { width: '10', depth: '1', height: '1' },
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing width', () => {
      const result = BaseTenBlockDefinitionSchema.safeParse({
        ...validBaseTenBlock,
        dimensions: { depth: 1, height: 1 },
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing depth', () => {
      const result = BaseTenBlockDefinitionSchema.safeParse({
        ...validBaseTenBlock,
        dimensions: { width: 1, height: 1 },
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing height', () => {
      const result = BaseTenBlockDefinitionSchema.safeParse({
        ...validBaseTenBlock,
        dimensions: { width: 1, depth: 1 },
      })
      expect(result.success).toBe(false)
    })
  })
})
