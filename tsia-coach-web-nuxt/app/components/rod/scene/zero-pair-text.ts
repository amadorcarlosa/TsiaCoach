import type { RodSign } from './rod.scene.types'
import { formatAddend, formatSigned } from './rod-arithmetic'
import type { ZeroPairPlan } from './zero-pair-cancellation'

/**
 * Words and equations for a zero-pair plan. Presentation only: every number
 * comes from the plan, so the text cannot disagree with what is committed.
 */

const word = (sign: RodSign, capital = false) =>
  sign === -1 ? (capital ? 'Negative' : 'negative') : (capital ? 'Positive' : 'positive')

const named = (sign: RodSign, magnitude: number, capital = false) =>
  `${word(sign, capital)} ${magnitude}`

export function zeroPairTitle(plan: ZeroPairPlan): string {
  return plan.decomposition ? 'Find a zero pair' : 'Cancel zero pair'
}

/** Each line is one equation, as text, read in order. */
export function zeroPairEquations(plan: ZeroPairPlan): string[] {
  const pair = `${plan.cancelledMagnitude} + ${formatAddend(-plan.cancelledMagnitude)}`
  if (plan.signedRemainder === 0) return [`${pair} = 0`]

  const sign: RodSign = plan.signedRemainder > 0 ? 1 : -1
  const larger = sign === 1 ? plan.positive.magnitude : -plan.negative.magnitude
  const remainder = plan.signedRemainder
  const cancelling = sign * plan.cancelledMagnitude
  return [
    `${formatSigned(larger)} = ${formatAddend(remainder)} + ${formatAddend(cancelling)}`,
    `${formatAddend(remainder)} + [${pair}] = ${formatSigned(remainder)}`,
  ]
}

/** The spoken explanation, announced before anything is cancelled. */
export function zeroPairExplanation(plan: ZeroPairPlan): string {
  const pair = `${named(1, plan.cancelledMagnitude, true)} and ${named(-1, plan.cancelledMagnitude)} make zero.`
  if (plan.signedRemainder === 0) return `${pair} No rods remain.`

  const sign: RodSign = plan.signedRemainder > 0 ? 1 : -1
  const larger = sign === 1 ? plan.positive.magnitude : plan.negative.magnitude
  const remainder = Math.abs(plan.signedRemainder)
  return `Split ${named(sign, larger)} into ${named(sign, remainder)} and ${named(sign, plan.cancelledMagnitude)}. ` +
    `${pair} ${named(sign, remainder, true)} will remain.`
}

export function zeroPairOutcome(plan: ZeroPairPlan): string {
  if (plan.signedRemainder === 0) return 'Zero pair cancelled. No rods remain.'
  const sign: RodSign = plan.signedRemainder > 0 ? 1 : -1
  return `Zero pair cancelled. ${named(sign, Math.abs(plan.signedRemainder), true)} remains.`
}
