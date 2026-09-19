import { beforeAll, describe, expect, it } from 'vitest'
import {
  Base10Denominations,
  BaseTenBlockDefinitionSchema,
  type BaseTenBlockDefinition,
} from '#server/schemas/base10-definition'
import { BaseTenValues, baseTenCatalog } from '~/components/basetenblocks/base10.types'

// Calls the real C# API. No frontend fixture or mock can establish domain agreement.
// PowerShell: $env:BASE10_API_URL = 'http://localhost:<api-port>'; pnpm test:base10:contract
describe('frontend base-ten catalog agrees with the C# domain', () => {
  let catalog: BaseTenBlockDefinition[]

  const expected = {
    ones: { value: BaseTenValues.One, shape: 'cube', dimensions: { width: 1, depth: 1, height: 1 } },
    tens: { value: BaseTenValues.Ten, shape: 'long', dimensions: { width: 10, depth: 1, height: 1 } },
    hundreds: { value: BaseTenValues.hundred, shape: 'flat', dimensions: { width: 10, depth: 10, height: 1 } },
    thousands: { value: BaseTenValues.thousand, shape: 'cube', dimensions: { width: 10, depth: 10, height: 10 } },
    tenThousands: { value: BaseTenValues.tenThousand, shape: 'long', dimensions: { width: 100, depth: 10, height: 10 } },
    hundredThousands: { value: BaseTenValues.hundredThousand, shape: 'flat', dimensions: { width: 100, depth: 100, height: 10 } },
    millions: { value: BaseTenValues.million, shape: 'cube', dimensions: { width: 100, depth: 100, height: 100 } },
  } satisfies Record<BaseTenBlockDefinition['denomination'], Omit<BaseTenBlockDefinition, 'denomination'>>

  beforeAll(async () => {
    const apiUrl = process.env.BASE10_API_URL ?? process.env.NUXT_API_URL
    if (!apiUrl) throw new Error('Set BASE10_API_URL to the running C# API origin, then run pnpm test:base10:contract.')
    const url = new URL('/api/base-ten-blocks', apiUrl)
    let response: Response
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(5_000) })
    } catch (cause) {
      throw new Error(`Cannot reach the C# base-ten catalog at ${url}. Start the API and check BASE10_API_URL.`, { cause })
    }
    if (!response.ok) throw new Error(`C# base-ten catalog returned HTTP ${response.status} at ${url}.`)
    catalog = BaseTenBlockDefinitionSchema.array().parse(await response.json())
  })

  it('has exactly the same denominations and values, without missing or duplicate entries', () => {
    expect(catalog.map(block => block.denomination).sort())
      .toEqual(Object.values(Base10Denominations).sort())
    expect(catalog.map(block => block.value).sort((a, b) => a - b))
      .toEqual(Object.values(BaseTenValues).sort((a, b) => a - b))
  })

  it('assigns the same value and shape to each denomination as C#', () => {
    for (const denomination of Object.values(Base10Denominations)) {
      const domain = catalog.find(block => block.denomination === denomination)
      expect(domain, `C# catalog is missing denomination ${denomination}`).toBeDefined()
      expect(domain!.value, `Value drift for ${denomination}`).toBe(expected[denomination].value)
      expect(domain!.shape, `Shape drift for ${denomination}`).toBe(expected[denomination].shape)
    }
  })

  it('provides consistent unit dimensions whose volume equals the block value', () => {
    for (const block of catalog) {
      const frontend = baseTenCatalog[block.denomination]
      expect({ value: frontend.value, shape: frontend.shape, dimensions: frontend.dimensions }).toEqual(expected[block.denomination])
      expect(block.dimensions, `Dimension drift for ${block.denomination}`)
        .toEqual(expected[block.denomination].dimensions)
      const { width, depth, height } = block.dimensions
      expect(width * depth * height, `Volume drift for ${block.denomination}`).toBe(block.value)
    }
  })
})
