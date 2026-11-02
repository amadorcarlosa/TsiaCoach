import type { EquationEvaluation, GroupEvaluation, SystemEvaluation } from './systems.evaluate'
import type { VariableId } from './systems.schema'

/**
 * Words for an evaluation. Every sentence describes what the rods show; none
 * names a missing value or the solution.
 */

export function groupFeedback(group: GroupEvaluation): string {
  const v = group.variable
  switch (group.status) {
    case 'empty': return `No ${v} rows yet.`
    case 'incomplete': return `Some ${v} rows are still empty (${group.rowWidths.join(', ')} cells).`
    case 'gaps': return `An ${v} row has a gap in it.`
    case 'unequal-widths': return `The ${v} rows have different lengths (${group.rowWidths.join(', ')}).`
    case 'misaligned': return `These ${v} rows have equal length but start at different columns.`
    case 'rectangle': return `The ${v} rows form a rectangle: ${group.coefficient} ${group.coefficient === 1 ? 'row' : 'rows'} of ${group.length}.`
  }
}

export function areaFeedback(equation: EquationEvaluation): string {
  const counted = `${equation.occupiedArea} of ${equation.targetArea} cells`
  if (equation.difference > 0) return `${counted}; ${equation.difference} excess.`
  if (equation.difference < 0) return `${counted}; ${-equation.difference} missing.`
  return `${counted}.`
}

export function equationFeedback(equation: EquationEvaluation): string {
  const head = `Equation ${equation.index + 1}: ${areaFeedback(equation)}`
  const rectangles = equation.groups.x.status === 'rectangle' && equation.groups.y.status === 'rectangle'
  if (rectangles) return `${head} Both groups form rectangles.`
  return head
}

export function agreementFeedback(evaluation: Extract<SystemEvaluation, { valid: true }>, variable: VariableId): string {
  const [first, second] = evaluation.equations.map(equation => equation.groups[variable].length)
  switch (evaluation.agreement[variable]) {
    case 'unknown': return `Build both ${variable} groups as rectangles to compare them.`
    case 'agrees': return `Both ${variable} groups have the same length.`
    case 'disagrees': return `Both ${variable} groups are rectangles, but their lengths disagree (${first} and ${second}).`
  }
}

export function systemFeedback(evaluation: SystemEvaluation): string {
  if (!evaluation.valid) return evaluation.reason
  if (evaluation.satisfied) return 'Both equations hold with the same x and the same y.'
  const solved = evaluation.equations.filter(equation => equation.satisfied).length
  if (solved === 2) return 'Each equation holds on its own, but they use different values.'
  return `${solved} of 2 equations hold.`
}
