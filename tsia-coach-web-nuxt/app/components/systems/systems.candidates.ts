import type { LinearEquation, LinearSystem } from './systems.schema'

/**
 * Pure rod-count arithmetic. No Vue, DOM, grid or animation: counts in, counts
 * and totals out. A count is how many rods; it is never a length, which is why
 * every count here is named xCount / yCount.
 */

export type CandidateCounts = { readonly xCount: number; readonly yCount: number }

/** The smallest equal-area exchange in one equation: removedX x rods become addedY y rods. */
export type ExchangeStep = {
  readonly removedX: number
  readonly addedY: number
  /** a * removedX = b * addedY = lcm(a, b). */
  readonly preservedArea: number
}

export type FirstCandidateResult =
  | { found: true; candidate: CandidateCounts }
  | { found: false; reason: string }

/** Largest safe integer product we accept, so arithmetic stays exact. */
const LIMIT = 1_000_000

function assertCoefficients(a: number, b: number, c: number): void {
  for (const [name, value] of [['a', a], ['b', b]] as const) {
    if (!Number.isSafeInteger(value) || value < 1 || value > LIMIT) {
      throw new RangeError(`Coefficient ${name} must be a positive integer, got ${value}.`)
    }
  }
  if (!Number.isSafeInteger(c) || Math.abs(c) > LIMIT) throw new RangeError(`Target must be an integer, got ${c}.`)
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) [x, y] = [y, x % y]
  return x
}

export const lcm = (a: number, b: number) => (a / gcd(a, b)) * b

export function exchangeStep(a: number, b: number): ExchangeStep {
  assertCoefficients(a, b, 0)
  const g = gcd(a, b)
  return { removedX: b / g, addedY: a / g, preservedArea: lcm(a, b) }
}

/**
 * The positive candidate with the greatest x for a*x + b*y = c: start at
 * floor((c - b) / a), so at least one y fits, and search downward.
 */
export function firstCandidate(equation: Pick<LinearEquation, 'coefficients' | 'targetArea'>): FirstCandidateResult {
  const { x: a, y: b } = equation.coefficients
  const c = equation.targetArea
  assertCoefficients(a, b, c)
  for (let xCount = Math.floor((c - b) / a); xCount >= 1; xCount--) {
    const rest = c - a * xCount
    if (rest > 0 && rest % b === 0) return { found: true, candidate: { xCount, yCount: rest / b } }
  }
  return { found: false, reason: `${a}x + ${b}y = ${c} has no solution in positive whole-number rod counts.` }
}

/** The next candidate after one exchange, or null when x would fall below one. */
export function nextCandidate(candidate: CandidateCounts, step: ExchangeStep): CandidateCounts | null {
  const xCount = candidate.xCount - step.removedX
  return xCount >= 1 ? { xCount, yCount: candidate.yCount + step.addedY } : null
}

/**
 * The single deterministic candidate sequence for one equation, greatest x
 * first. Validation, generation and learner progression all read this.
 */
export function* candidateIterator(equation: Pick<LinearEquation, 'coefficients' | 'targetArea'>): Generator<CandidateCounts> {
  const first = firstCandidate(equation)
  if (!first.found) return
  const step = exchangeStep(equation.coefficients.x, equation.coefficients.y)
  let current: CandidateCounts | null = first.candidate
  while (current) {
    yield current
    current = nextCandidate(current, step)
  }
}

export const candidateSequence = (equation: Pick<LinearEquation, 'coefficients' | 'targetArea'>) =>
  [...candidateIterator(equation)]

export type EquationCheck = {
  readonly xAddend: number
  readonly yAddend: number
  readonly total: number
  readonly target: number
  /** total - target: positive is excess, negative is missing. */
  readonly difference: number
  readonly satisfied: boolean
}

export function checkEquation(equation: Pick<LinearEquation, 'coefficients' | 'targetArea'>, counts: CandidateCounts): EquationCheck {
  const xAddend = equation.coefficients.x * counts.xCount
  const yAddend = equation.coefficients.y * counts.yCount
  const total = xAddend + yAddend
  return { xAddend, yAddend, total, target: equation.targetArea, difference: total - equation.targetArea, satisfied: total === equation.targetArea }
}

export type CandidateEvaluation = {
  readonly counts: CandidateCounts
  readonly equations: readonly [EquationCheck, EquationCheck]
  readonly solved: boolean
}

export function evaluateCandidate(system: LinearSystem, counts: CandidateCounts): CandidateEvaluation {
  const equations = [checkEquation(system.equations[0], counts), checkEquation(system.equations[1], counts)] as const
  return { counts, equations, solved: equations[0].satisfied && equations[1].satisfied }
}

export const determinant = (system: LinearSystem) => {
  const [first, second] = system.equations
  return first.coefficients.x * second.coefficients.y - first.coefficients.y * second.coefficients.x
}

export type SystemAnalysis =
  | { status: 'singular'; reason: string }
  | { status: 'no-positive-candidate'; reason: string }
  | { status: 'no-common-solution'; reason: string; sequence: readonly CandidateCounts[]; step: ExchangeStep }
  | {
      status: 'solvable'
      sequence: readonly CandidateCounts[]
      step: ExchangeStep
      /** Index of the common solution in the first equation's sequence: the exchanges needed. */
      solutionIndex: number
      solution: CandidateCounts
    }

/** Whether a rod-count activity can run on this system, and how it unfolds. */
export function analyzeSystem(system: LinearSystem): SystemAnalysis {
  if (determinant(system) === 0) {
    return { status: 'singular', reason: 'The equations are proportional or contradictory, so there is no single common solution.' }
  }
  const [first, second] = system.equations
  const sequence = candidateSequence(first)
  if (!sequence.length) {
    const result = firstCandidate(first)
    return { status: 'no-positive-candidate', reason: result.found ? '' : result.reason }
  }
  const step = exchangeStep(first.coefficients.x, first.coefficients.y)
  const solutionIndex = sequence.findIndex(candidate => checkEquation(second, candidate).satisfied)
  if (solutionIndex < 0) {
    return {
      status: 'no-common-solution',
      reason: 'No positive whole-number rod counts satisfy both equations.',
      sequence,
      step,
    }
  }
  return { status: 'solvable', sequence, step, solutionIndex, solution: sequence[solutionIndex]! }
}

/** Where a pair sits in the first equation's sequence, or -1 if it is not a candidate. */
export function candidateIndex(sequence: readonly CandidateCounts[], counts: CandidateCounts): number {
  return sequence.findIndex(item => item.xCount === counts.xCount && item.yCount === counts.yCount)
}

/**
 * Columns the rod-count board needs: every reachable candidate side by side
 * (x rods then y rods), plus the widest exploration of the first equation with
 * x rods alone. Area does not decide width; counts do.
 */
export function countColumnsNeeded(system: LinearSystem, reachable: readonly CandidateCounts[]): number {
  const first = system.equations[0]
  const widest = Math.max(0, ...reachable.map(candidate => candidate.xCount + candidate.yCount))
  const exploration = Math.floor(first.targetArea / first.coefficients.x) + 1
  return Math.max(widest, exploration) + 2
}
