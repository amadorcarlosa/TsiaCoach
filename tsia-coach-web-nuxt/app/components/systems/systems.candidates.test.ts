import { describe, expect, it } from 'vitest'
import {
  analyzeSystem,
  candidateSequence,
  countColumnsNeeded,
  evaluateCandidate,
  exchangeStep,
  firstCandidate,
  nextCandidate,
} from './systems.candidates'
import { difficultySettings, generateSystem, seededRandom } from './systems.generator'
import { systemsFixtures } from './systems.fixtures'
import type { LinearSystem } from './systems.schema'

const eq = (x: number, y: number, targetArea: number, id = 'equation-1') => ({ id, coefficients: { x, y }, targetArea })
const system = (first: ReturnType<typeof eq>, second: ReturnType<typeof eq>): LinearSystem => ({
  equations: [first, { ...second, id: 'equation-2' }],
})
const pairs = (equation: ReturnType<typeof eq>) => candidateSequence(equation).map(item => [item.xCount, item.yCount])

describe('rod-count candidate engine', () => {
  const reference = system(eq(3, 8, 71), eq(9, 4, 73))

  it('reproduces the reference sequence (21,1), (13,4), (5,7)', () => {
    expect(pairs(eq(3, 8, 71))).toEqual([[21, 1], [13, 4], [5, 7]])
  })

  it('keeps Equation 1 at 71 and checks Equation 2 at 193, 133, 73', () => {
    const results = candidateSequence(reference.equations[0]).map(counts => evaluateCandidate(reference, counts))
    expect(results.map(result => result.equations[0].total)).toEqual([71, 71, 71])
    expect(results.map(result => result.equations[1].total)).toEqual([193, 133, 73])
    expect(results.map(result => result.equations[1].difference)).toEqual([120, 60, 0])
    expect(results.map(result => result.solved)).toEqual([false, false, true])
    expect(results[0]!.equations[0]).toMatchObject({ xAddend: 63, yAddend: 8 })
    expect(results[2]!.equations[1]).toMatchObject({ xAddend: 45, yAddend: 28 })
  })

  it('exchanges eight 3-rods for three 8-rods, preserving 24 cells', () => {
    expect(exchangeStep(3, 8)).toEqual({ removedX: 8, addedY: 3, preservedArea: 24 })
  })

  it('stops at the common solution (5,7)', () => {
    const analysis = analyzeSystem(reference)
    expect(analysis).toMatchObject({ status: 'solvable', solutionIndex: 2, solution: { xCount: 5, yCount: 7 } })
    expect(nextCandidate({ xCount: 5, yCount: 7 }, exchangeStep(3, 8))).toBeNull()
  })

  it('starts 3x + 8y = 70 at (18,2)', () => {
    expect(firstCandidate(eq(3, 8, 70))).toEqual({ found: true, candidate: { xCount: 18, yCount: 2 } })
  })

  it('produces (5,7), (1,16) for 9x + 4y = 73', () => {
    expect(pairs(eq(9, 4, 73))).toEqual([[5, 7], [1, 16]])
  })

  it('produces (7,1), (4,3), (1,5) for 4x + 6y = 34, exchanging three 4-rods for two 6-rods', () => {
    expect(pairs(eq(4, 6, 34))).toEqual([[7, 1], [4, 3], [1, 5]])
    expect(exchangeStep(4, 6)).toEqual({ removedX: 3, addedY: 2, preservedArea: 12 })
  })

  it('reports no positive candidate for 4x + 6y = 5', () => {
    expect(firstCandidate(eq(4, 6, 5)).found).toBe(false)
    expect(pairs(eq(4, 6, 5))).toEqual([])
    expect(analyzeSystem(system(eq(4, 6, 5), eq(1, 2, 3))).status).toBe('no-positive-candidate')
  })

  it('rejects a zero determinant', () => {
    expect(analyzeSystem(system(eq(2, 4, 20), eq(1, 2, 10))).status).toBe('singular')
  })

  it('reports a system with no common positive solution', () => {
    // 3x + 8y = 71 candidates never satisfy x + y = 100.
    expect(analyzeSystem(system(eq(3, 8, 71), eq(1, 2, 100))).status).toBe('no-common-solution')
  })

  it('recognises first-candidate success', () => {
    expect(analyzeSystem(system(eq(3, 8, 71), eq(1, 1, 22)))).toMatchObject({ status: 'solvable', solutionIndex: 0 })
  })

  it('ends an exhausted sequence when x would drop below one', () => {
    expect(nextCandidate({ xCount: 1, yCount: 5 }, exchangeStep(4, 6))).toBeNull()
  })

  it('sizes the board by counts, not area', () => {
    const sequence = candidateSequence(reference.equations[0])
    expect(countColumnsNeeded(reference, sequence)).toBe(26)
    expect(systemsFixtures.rodCountReference.config.laneColumns).toBe(26)
  })

  it('rejects invalid coefficients at the boundary', () => {
    expect(() => firstCandidate(eq(0, 3, 9))).toThrow(RangeError)
    expect(() => exchangeStep(1.5, 2)).toThrow(RangeError)
  })
})

describe('rod-count generation', () => {
  it('is reproducible from a seed', () => {
    expect(seededRandom(7)()).toBe(seededRandom(7)())
    expect(generateSystem(1234, 'standard')).toEqual(generateSystem(1234, 'standard'))
  })

  for (const profile of ['introductory', 'standard', 'advanced'] as const) {
    it(`generates valid ${profile} problems within every bound`, () => {
      const settings = difficultySettings[profile]
      for (let seed = 1; seed <= 40; seed++) {
        const result = generateSystem(seed, profile)
        expect(result.ok, `seed ${seed}`).toBe(true)
        if (!result.ok) continue
        const { system } = result.config
        const analysis = analyzeSystem(system)
        expect(analysis.status).toBe('solvable')
        if (analysis.status !== 'solvable') continue
        expect(result.config.strategy).toBe('rod-count')
        expect(result.config.generation).toEqual({ seed, profile })
        for (const equation of system.equations) {
          expect(equation.coefficients.x).not.toBe(equation.coefficients.y)
          expect(Math.max(equation.coefficients.x, equation.coefficients.y)).toBeLessThanOrEqual(9)
          expect(equation.targetArea).toBeGreaterThan(0)
        }
        expect(analysis.solution).toEqual(result.solution)
        expect(result.solution.xCount).toBeGreaterThanOrEqual(settings.solutionValues[0])
        expect(result.solution.xCount).toBeLessThanOrEqual(settings.solutionValues[1])
        expect(result.solution.yCount).toBeLessThanOrEqual(settings.solutionValues[1])
        expect(analysis.sequence.length).toBeGreaterThanOrEqual(settings.candidates[0])
        expect(analysis.sequence.length).toBeLessThanOrEqual(settings.candidates[1])
        expect(analysis.solutionIndex).toBeGreaterThanOrEqual(settings.conversions[0])
        expect(analysis.solutionIndex).toBeLessThanOrEqual(settings.conversions[1])
        const [first] = system.equations
        for (const candidate of analysis.sequence) {
          expect(Number.isInteger(candidate.xCount) && candidate.xCount >= 1).toBe(true)
          expect(Number.isInteger(candidate.yCount) && candidate.yCount >= 1).toBe(true)
          expect(first.coefficients.x * candidate.xCount + first.coefficients.y * candidate.yCount).toBe(first.targetArea)
        }
        const reachable = analysis.sequence.slice(0, analysis.solutionIndex + 1)
        expect(Math.max(...reachable.map(item => item.xCount + item.yCount))).toBeLessThanOrEqual(result.config.laneColumns)
        expect(result.config.laneColumns).toBeLessThanOrEqual(settings.maxColumns)
      }
    })
  }

  it('fails with a reason for impossible settings', () => {
    const result = generateSystem(1, 'standard', { candidates: [1, 2], conversions: [3, 4] })
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.reason).toMatch(/conversions need at least/)
  })

  it('stops after the attempt bound', () => {
    const result = generateSystem(1, 'advanced', { maxColumns: 3, maxAttempts: 25 })
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.reason).toMatch(/after 25 attempts/)
  })
})
