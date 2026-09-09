import { beforeAll, describe, expect, it } from 'vitest'
import { RodDefinitionSchema, type RodDefinition } from '#server/schemas/rod-definition'
import {
  CuisenaireRodColors,
  CuisenaireRodNumbers,
  CuisenaireRodValues,
  getRodDefinition,
  RodNumberToValue,
  RodValueToColor,
} from "~/components/rod/rod.types.ts";

// Calls the real C# API. No frontend fixture or mock can establish domain agreement.
// PowerShell: $env:ROD_API_URL = 'http://localhost:<api-port>'; pnpm test:rods:contract
describe('frontend rod catalog agrees with the C# domain', () => {
  let catalog: RodDefinition[]

  beforeAll(async () => {
    const apiUrl = process.env.ROD_API_URL ?? process.env.NUXT_API_URL
    if (!apiUrl) throw new Error('Set ROD_API_URL to the running C# API origin, then run pnpm test:rods:contract.')
    const url = new URL('/api/rods', apiUrl)
    let response: Response
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(5_000) })
    } catch (cause) {
      throw new Error(`Cannot reach the C# rod catalog at ${url}. Start the API and check ROD_API_URL.`, { cause })
    }
    if (!response.ok) throw new Error(`C# rod catalog returned HTTP ${response.status} at ${url}.`)
    catalog = RodDefinitionSchema.array().parse(await response.json())
  })

  it('has exactly the same lengths and colors, without missing or duplicate entries', () => {
    expect(catalog.map(rod => rod.length).sort((a, b) => a - b))
      .toEqual(Object.values(CuisenaireRodValues).sort((a, b) => a - b))
    expect(catalog.map(rod => rod.color).sort())
      .toEqual(Object.values(CuisenaireRodColors).sort())
    expect(Object.keys(RodValueToColor).map(Number).sort((a, b) => a - b))
      .toEqual(catalog.map(rod => rod.length).sort((a, b) => a - b))
  })

  it('assigns the same color to each length as C#', () => {
    for (const value of Object.values(CuisenaireRodValues)) {
      const domain = catalog.find(rod => rod.length === value)
      expect(domain, `C# catalog is missing length ${value}`).toBeDefined()
      const frontend = getRodDefinition(value)
      expect(frontend.value).toBe(domain!.length)
      expect(frontend.color, `Color drift for length ${value}`).toBe(domain!.color)
      expect(RodValueToColor[value]).toBe(domain!.color)
      expect(Object.values(CuisenaireRodNumbers)).toContain(frontend.number)
      expect(RodNumberToValue[frontend.number]).toBe(domain!.length)
    }
  })

  it('provides exactly the three supported poses with consistent unit dimensions', () => {
    for (const rod of catalog) {
      expect(rod.poses.map(pose => pose.orientation).sort())
        .toEqual(['horizontal', 'tower', 'vertical'])
      const expected = {
        horizontal: { width: rod.length, depth: 1, height: 1 },
        vertical: { width: 1, depth: rod.length, height: 1 },
        tower: { width: 1, depth: 1, height: rod.length },
      }
      for (const pose of rod.poses) {
        expect(pose.dimensions, `Dimension drift for length ${rod.length}, ${pose.orientation}`)
          .toEqual(expected[pose.orientation])
      }
    }
  })
})
