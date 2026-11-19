import { Effect, Random } from 'effect'
import { describe, expect, it } from 'vitest'
import { generateSystem, randomSeedEffect } from './systems.generator'

describe('system generation workflow randomness', () => {
  it('can inject the same source seed to reproduce the generated activity', () => {
    const chooseSeed = () => Effect.runSync(randomSeedEffect.pipe(Random.withSeed('classroom-example')))
    const first = chooseSeed(), second = chooseSeed()
    expect(Number.isSafeInteger(first)).toBe(true)
    expect(first).toBeGreaterThanOrEqual(0)
    expect(first).toBeLessThan(0xffffffff)
    expect(first).toBe(second)
    expect(generateSystem(first, 'standard')).toEqual(generateSystem(second, 'standard'))
  })
})
