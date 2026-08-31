import type { components } from '#server/types/schema'

export type Scaffold = components['schemas']['ScaffoldResponse']
export type ScaffoldPhase = components['schemas']['ScaffoldPhaseResponse']
export type ScaffoldStep = components['schemas']['ScaffoldStepResponse']
export type ScaffoldResource = components['schemas']['ScaffoldResourceResponse']
export type RodResource = components['schemas']['ScaffoldResourceResponseRodResourceResponse']
export type RodSeriesResource = components['schemas']['ScaffoldResourceResponseRodSeriesResourceResponse']
export type StepScene = components['schemas']['StepSceneResponse']
export type FreshScene = components['schemas']['StepSceneResponseFreshSceneResponse']
export type ContinuedScene = components['schemas']['StepSceneResponseContinuedSceneResponse']
export type ScaffoldScene = components['schemas']['ScaffoldSceneResponse']
export type QuantityJoinScene = components['schemas']['ScaffoldSceneResponseQuantityJoinSceneResponse']
export type LearnerAction = components['schemas']['LearnerActionResponse']
export type SuccessCheck = components['schemas']['SuccessCheckResponse']

export function isFreshScene(scene: StepScene): scene is FreshScene {
  return scene.type === 'freshScene'
}

export function isQuantityJoinScene(scene: ScaffoldScene): scene is QuantityJoinScene {
  return scene.type === 'quantityJoinScene'
}
