import { analyzeSystem, countColumnsNeeded, determinant, type CandidateCounts } from './systems.candidates'
import {
  rodCountLimits,
  systemsBoardConfigSchema,
  systemsLimits,
  type DifficultyProfile,
  type SystemsBoardConfig,
} from './systems.schema'

/**
 * Bounded, seeded generation of rod-count systems. The intended solution is
 * chosen first; coefficients follow; every candidate the learner can reach is
 * checked against the board's capacity before a problem is offered.
 */

export type Range = readonly [min: number, max: number]

export type GenerationSettings = {
  /** Bounds the intended solution's counts, not every intermediate candidate. */
  solutionValues: Range
  /** How many positive candidates the first equation has in total. */
  candidates: Range
  /** Exchanges from the first candidate to the solution. */
  conversions: Range
  maxColumns: number
  maxAttempts: number
}

export const difficultySettings: Record<DifficultyProfile, GenerationSettings> = {
  introductory: { solutionValues: [1, 8], candidates: [2, 3], conversions: [1, 1], maxColumns: 40, maxAttempts: 500 },
  standard: { solutionValues: [1, 12], candidates: [2, 5], conversions: [1, 3], maxColumns: 48, maxAttempts: 500 },
  advanced: { solutionValues: [1, 20], candidates: [3, 7], conversions: [2, 5], maxColumns: 64, maxAttempts: 500 },
}

export const difficultyLabels: Record<DifficultyProfile, string> = {
  introductory: 'Introductory',
  standard: 'Standard',
  advanced: 'Advanced',
}

/** Mulberry32: tiny, fast and reproducible across browsers. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const randomSeed = () => Math.floor(Math.random() * 0xffffffff) >>> 0

const between = (random: () => number, [min, max]: Range) => min + Math.floor(random() * (max - min + 1))

function distinctPair(random: () => number): [number, number] {
  const a = between(random, [1, rodCountLimits.maxCoefficient])
  let b = between(random, [1, rodCountLimits.maxCoefficient - 1])
  if (b >= a) b += 1
  return [a, b]
}

export type GenerationResult =
  | { ok: true; config: SystemsBoardConfig; solution: CandidateCounts; conversions: number; attempts: number }
  | { ok: false; reason: string }

function settingsProblem(settings: GenerationSettings): string | null {
  const ranges: [string, Range][] = [
    ['solution values', settings.solutionValues],
    ['candidate counts', settings.candidates],
    ['conversions', settings.conversions],
  ]
  for (const [name, [min, max]] of ranges) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) return `The ${name} range ${min}-${max} is empty.`
  }
  if (settings.solutionValues[0] < 1) return 'Solution values must be positive.'
  if (settings.candidates[0] < 1) return 'At least one candidate is required.'
  if (settings.conversions[0] < 0) return 'Conversions cannot be negative.'
  if (settings.conversions[0] > settings.candidates[1] - 1) {
    return `${settings.conversions[0]} conversions need at least ${settings.conversions[0] + 1} candidates, but at most ${settings.candidates[1]} are allowed.`
  }
  if (!Number.isInteger(settings.maxAttempts) || settings.maxAttempts < 1) return 'Allow at least one generation attempt.'
  if (settings.maxColumns < 3 || settings.maxColumns > systemsLimits.maxLaneColumns) {
    return `The board width must be between 3 and ${systemsLimits.maxLaneColumns} columns.`
  }
  return null
}

export function generateSystem(seed: number, profile: DifficultyProfile, overrides: Partial<GenerationSettings> = {}): GenerationResult {
  const settings = { ...difficultySettings[profile], ...overrides }
  const problem = settingsProblem(settings)
  if (problem) return { ok: false, reason: problem }

  const random = seededRandom(seed)
  for (let attempt = 1; attempt <= settings.maxAttempts; attempt++) {
    const solution = { xCount: between(random, settings.solutionValues), yCount: between(random, settings.solutionValues) }
    const [a, b] = distinctPair(random)
    const [d, e] = distinctPair(random)
    const system = {
      equations: [
        { id: 'equation-1', coefficients: { x: a, y: b }, targetArea: a * solution.xCount + b * solution.yCount },
        { id: 'equation-2', coefficients: { x: d, y: e }, targetArea: d * solution.xCount + e * solution.yCount },
      ] as [SystemsBoardConfig['system']['equations'][0], SystemsBoardConfig['system']['equations'][1]],
    }
    if (determinant(system) === 0) continue
    if (system.equations.some(equation => equation.targetArea > systemsLimits.maxTargetArea)) continue

    const analysis = analyzeSystem(system)
    if (analysis.status !== 'solvable') continue
    const { sequence, solutionIndex } = analysis
    if (sequence.length < settings.candidates[0] || sequence.length > settings.candidates[1]) continue
    if (solutionIndex < settings.conversions[0] || solutionIndex > settings.conversions[1]) continue

    const laneColumns = countColumnsNeeded(system, sequence.slice(0, solutionIndex + 1))
    if (laneColumns > settings.maxColumns) continue

    const parsed = systemsBoardConfigSchema.safeParse({
      layout: 'continuous',
      staging: false,
      strategy: 'rod-count',
      generation: { seed: seed >>> 0, profile },
      system,
      laneColumns,
      regionGapRows: 2,
    })
    if (!parsed.success) continue
    return { ok: true, config: parsed.data, solution: analysis.solution, conversions: solutionIndex, attempts: attempt }
  }
  return {
    ok: false,
    reason: `No ${profile} problem fit these settings after ${settings.maxAttempts} attempts. ` +
      'Widen the candidate or conversion ranges, or allow a wider board.',
  }
}
