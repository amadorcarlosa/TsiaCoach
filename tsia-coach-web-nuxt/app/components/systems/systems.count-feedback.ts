import { exchangeStep, type EquationCheck } from './systems.candidates'
import type { CountEvaluation } from './systems.count-evaluate'
import type { SystemsBoardConfig } from './systems.schema'

/**
 * Words for the rod-count activity. Feedback describes the rods on the board;
 * hints point toward the greatest feasible x without listing candidates or
 * naming the solution.
 */

export type CountPhase = 'building' | 'reviewing' | 'selecting' | 'previewing' | 'solved' | 'unavailable'

const rods = (count: number, value: number) => `${count} ${value}-rod${count === 1 ? '' : 's'}`

export const areaOutcome = (check: Pick<EquationCheck, 'difference'>) =>
  check.difference > 0 ? `${check.difference} cells excess`
    : check.difference < 0 ? `${-check.difference} cells missing`
      : 'exact'

/** "3(21) + 8(1) = 71" and "63 + 8 = 71" for one equation and the current counts. */
export function substitutionLines(
  coefficients: { x: number; y: number },
  counts: { xCount: number; yCount: number },
  check: Pick<EquationCheck, 'xAddend' | 'yAddend' | 'total'>,
  unassigned = 0,
): [string, string] {
  const extra = unassigned ? ` + ${unassigned}` : ''
  return [
    `${coefficients.x}(${counts.xCount}) + ${coefficients.y}(${counts.yCount})${extra} = ${check.total}`,
    `${check.xAddend} + ${check.yAddend}${extra} = ${check.total}`,
  ]
}

export function countPhase(evaluation: CountEvaluation, options: { previewing: boolean; selectedUnits: number }): CountPhase {
  if (!evaluation.valid || evaluation.analysis.status !== 'solvable') return 'unavailable'
  if (evaluation.solved) return 'solved'
  if (options.previewing) return 'previewing'
  if (!evaluation.candidate) return 'building'
  return options.selectedUnits > 0 ? 'selecting' : 'reviewing'
}

/** The single status line for the current state. */
export function countStatus(config: SystemsBoardConfig, evaluation: CountEvaluation, phase: CountPhase, selectedUnits = 0): string {
  if (!evaluation.valid) return evaluation.reason
  const [first, second] = config.system.equations
  const { x: a, y: b } = first.coefficients
  if (evaluation.analysis.status !== 'solvable') return evaluation.analysis.reason

  switch (phase) {
    case 'solved':
      return `Both equations hold with x = ${evaluation.counts.xCount} and y = ${evaluation.counts.yCount}: a common solution.`
    case 'previewing':
      return 'Review the exchange, then confirm or keep the rods.'
    case 'building': {
      const { upper, material } = evaluation
      const parts: string[] = []
      if (material.unassigned.length) {
        parts.push(`${upper.unassigned} ${upper.unassigned === 1 ? 'cell is' : 'cells are'} unassigned material: not a whole upright x rod (${a}) or y rod (${b}), so ${upper.unassigned === 1 ? 'it counts' : 'they count'} toward no variable.`)
      }
      if (upper.satisfied && (evaluation.counts.xCount < 1 || evaluation.counts.yCount < 1)) {
        parts.push('Equation 1 needs at least one x rod and one y rod.')
      } else {
        parts.push(`Equation 1 has ${upper.total} of ${first.targetArea} cells (${areaOutcome(upper)}).`)
      }
      return parts.join(' ')
    }
    case 'reviewing':
    case 'selecting': {
      const lower = evaluation.lower!
      const step = exchangeStep(a, b)
      const head = `Equation 1 holds with x = ${evaluation.counts.xCount}, y = ${evaluation.counts.yCount}, but the Equation 2 check fails: ` +
        `${lower.total} of ${second.targetArea} cells (${areaOutcome(lower)}). This is not a common solution.`
      if (phase === 'selecting') {
        return `${head} Selected ${selectedUnits} of ${step.removedX} x rods to exchange.`
      }
      return `${head} Exchange ${rods(step.removedX, a)} for ${rods(step.addedY, b)} (${step.preservedArea} cells each way) to reach the next candidate.`
    }
    case 'unavailable':
      return ''
  }
}

/**
 * Progressive hints for building the first candidate. Level 1 is strategy,
 * level 2 is direction, level 3 explains the remainder rule. None names the
 * answer or the candidate list.
 */
export function countHint(config: SystemsBoardConfig, evaluation: CountEvaluation, level: number): string {
  if (!evaluation.valid || evaluation.analysis.status !== 'solvable') return ''
  const first = config.system.equations[0]
  const { x: a, y: b } = first.coefficients
  const c = first.targetArea
  const start = evaluation.analysis.sequence[0]!
  const { xCount } = evaluation.counts

  if (evaluation.candidate) {
    if (evaluation.candidateIndex > 0) {
      return `This is a candidate for Equation 1, but not the first one: the guided path starts from the greatest number of x rods that still leaves room for whole y rods. You can continue from here.`
    }
    return 'Equation 1 holds. Read the Equation 2 check below the board.'
  }
  if (level <= 1) {
    return `Use as many x rods (${a}-rods) as you can while leaving room for at least one y rod (${b}-rod), then fill the rest of the ${c} cells with y rods.`
  }
  if (level === 2) {
    if (xCount < start.xCount) return 'More x rods fit before the y rods take over.'
    if (xCount > start.xCount) return `With this many x rods, the cells left over cannot be filled with whole ${b}-rods. Try one fewer x rod at a time.`
    return `Now fill the rest of Equation 1 with ${b}-rods.`
  }
  const rest = c - a * xCount
  if (rest <= 0) return `${xCount} x rods already cover ${a * xCount} cells, leaving no room for a y rod. Remove some x rods.`
  return `${xCount} x rods cover ${a * xCount} cells, leaving ${rest}. Whole y rods need the leftover to be a multiple of ${b}` +
    (rest % b === 0 ? `, and ${rest} is: use ${rest / b} y rods.` : `, and ${rest} is not. Remove one x rod and check again.`)
}
