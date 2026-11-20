import type { DeepReadonly } from 'vue'
import type { RodTrain } from '~/components/rod/scene/rod.scene.types'
import { trainFitsRegion } from '~/components/rod/scene/scene-regions'
import {
  analyzeSystem,
  candidateIndex,
  checkEquation,
  type CandidateCounts,
  type EquationCheck,
  type SystemAnalysis,
} from './systems.candidates'
import { classifyCountMaterial, countLayout, hasNegative, isCanonical, type CountMaterial } from './systems.count-layout'
import type { SystemsBoardConfig } from './systems.schema'

/**
 * Pure rod-count evaluation of the learner's scene. Only Equation 1's band is
 * learner material; Equation 2 is checked from the same counts, never read
 * from rods, so derived material can never become a source.
 */

export type UpperCheck = EquationCheck & {
  /** Cells of material that is not a whole x or y rod. */
  unassigned: number
}

export type CountEvaluation =
  | {
      valid: true
      material: CountMaterial
      counts: CandidateCounts
      upper: UpperCheck
      /** Only whole x and y rods (upright or lying), at least one of each. */
      clean: boolean
      /** A clean arrangement that satisfies Equation 1 exactly. */
      candidate: CandidateCounts | null
      /** Equation 2 for the same counts; null until the counts are clean. */
      lower: EquationCheck | null
      analysis: SystemAnalysis
      /** Position in Equation 1's candidate sequence, or -1. */
      candidateIndex: number
      canonical: boolean
      solved: boolean
    }
  | { valid: false; reason: string }

export function evaluateCountSystem(config: SystemsBoardConfig, trains: readonly DeepReadonly<RodTrain>[]): CountEvaluation {
  if (hasNegative(trains)) return { valid: false, reason: 'Negative rods are not used on this board.' }
  const { upper: band } = countLayout(config)
  if (trains.some(train => !trainFitsRegion(train, band))) return { valid: false, reason: 'A train lies outside Equation 1.' }

  const [first, second] = config.system.equations
  const material = classifyCountMaterial(config, trains)
  const counts = { xCount: material.xCount, yCount: material.yCount }
  const check = checkEquation(first, counts)
  const total = check.total + material.unassignedArea
  const upper: UpperCheck = {
    ...check,
    total,
    difference: total - first.targetArea,
    unassigned: material.unassignedArea,
    satisfied: material.unassigned.length === 0 && check.satisfied,
  }
  const clean = material.unassigned.length === 0 && counts.xCount >= 1 && counts.yCount >= 1
  const candidate = clean && upper.satisfied ? counts : null
  const lower = clean ? checkEquation(second, counts) : null
  const analysis = analyzeSystem(config.system)
  const sequence = analysis.status === 'solvable' || analysis.status === 'no-common-solution' ? analysis.sequence : []
  return {
    valid: true,
    material,
    counts,
    upper,
    clean,
    candidate,
    lower,
    analysis,
    candidateIndex: candidate ? candidateIndex(sequence, candidate) : -1,
    canonical: isCanonical(config, material),
    solved: candidate !== null && lower !== null && lower.satisfied,
  }
}
