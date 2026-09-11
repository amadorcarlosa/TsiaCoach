import type { SceneSnapshot } from '~/components/rod/scene/scene-snapshot'
import type { AuthoringGoal, GoalCondition } from './goal.schema'
export type { AuthoringGoal, GoalCondition } from './goal.schema'
export type Validation<T> = { allowed: true; value: T } | { allowed: false; reason: string }
export type GoalEvaluation = {
  satisfied: boolean
  conditions: { index: number; satisfied: boolean; reason?: string }[]
}
export type GoalAdapter = {
  supportedTypes: readonly GoalCondition['type'][]
  parse: (input: unknown) => Validation<AuthoringGoal>
  evaluate: (goal: AuthoringGoal, scene: SceneSnapshot) => GoalEvaluation
}
export type GoalTarget = { id: string; label: string }
export type BoardGoalAdapter = GoalAdapter & {
  pairs: readonly GoalTarget[]
  regions: readonly GoalTarget[]
}
