import type { components } from '#server/types/schema'

export type Scaffold = components['schemas']['ScaffoldResponse']
export type ScaffoldStep = components['schemas']['ScaffoldStepResponse']
export type ScaffoldResource = components['schemas']['ScaffoldResourceResponse']
export type RodResource = components['schemas']['ScaffoldResourceResponseRodResourceResponse']
export type RodSeriesResource = components['schemas']['ScaffoldResourceResponseRodSeriesResourceResponse']
export type ScaffoldScene = components['schemas']['ScaffoldSceneResponse']
export type QuantityJoinScene = components['schemas']['ScaffoldSceneResponseQuantityJoinSceneResponse']
export type LearnerAction = components['schemas']['LearnerActionResponse']
export type SuccessCheck = components['schemas']['SuccessCheckResponse']

export type ScaffoldSession = components['schemas']['ScaffoldSessionResponse']
export type ScaffoldSessionState = components['schemas']['ScaffoldSessionStateResponse']
export type ActiveScaffoldSessionState =
  components['schemas']['ScaffoldSessionStateResponseActiveScaffoldSessionResponse']
export type CompletedScaffoldSessionState =
  components['schemas']['ScaffoldSessionStateResponseCompletedScaffoldSessionResponse']
export type ScaffoldLearnerStep = components['schemas']['ScaffoldLearnerStepResponse']
export type ScaffoldLearnerResource = components['schemas']['ScaffoldLearnerResourceResponse']
export type ScaffoldLearnerRodResource =
  components['schemas']['ScaffoldLearnerResourceResponseScaffoldLearnerRodResourceResponse']
export type ScaffoldLearnerRodSeriesResource =
  components['schemas']['ScaffoldLearnerResourceResponseScaffoldLearnerRodSeriesResourceResponse']
export type ScaffoldLastCheck = components['schemas']['ScaffoldLastCheckResponse']

export type ScaffoldStepSubmission =
  | { type: 'matchEquivalentLength', unitRodCount: number }
  | {
      type: 'classifyByFit'
      classifications: Array<{
        length: number
        classification: 'flush' | 'oneUnitLeftover'
      }>
    }
  | { type: 'nameFitClassification', domain: 'integers' | 'oddIntegers' | 'evenIntegers' }
  | {
      type: 'traverseAllGaps'
      traversals: Array<{ from: number, to: number, resourceId: string }>
    }
  | {
      type: 'joinQuantities'
      parts: Array<
        | { type: 'semanticQuantity', semanticEntityId: string }
        | { type: 'latentExpression', latentMathId: string }
      >
    }
  | { type: 'enterScalar', value: number }
  | { type: 'buildExpression', mathObjectId: string }
  | { type: 'selectAnswerChoice', answerChoiceId: string }

export function isQuantityJoinScene(scene: ScaffoldScene): scene is QuantityJoinScene {
  return scene.type === 'quantityJoinScene'
}

export function isActiveScaffoldSession(
  session: ScaffoldSession | null,
): session is ScaffoldSession & { state: ActiveScaffoldSessionState } {
  return session?.state.type === 'active'
}

export function isCompletedScaffoldSession(
  session: ScaffoldSession | null,
): session is ScaffoldSession & { state: CompletedScaffoldSessionState } {
  return session?.state.type === 'completed'
}
