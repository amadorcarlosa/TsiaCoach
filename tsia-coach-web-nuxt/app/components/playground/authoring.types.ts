import type {
  RodTrain,
  SceneResult,
} from '~/components/rod/scene/rod.scene.types'
import type { SceneSnapshot } from '~/components/rod/scene/scene-snapshot'

export type AuthoringStep = {
  id: string
  title: string
  prompt: string
  trains: RodTrain[]
}

export type StepMetadataPatch =
  Partial<Pick<AuthoringStep, 'title' | 'prompt'>>

export type StepDirection = 'earlier' | 'later'

export type DeleteStepOptions = {
  confirmed: boolean
  discardChanges?: boolean
}

export type SwitchDecision = 'save' | 'discard' | 'cancel'

export type AuthoringResult =
  | { allowed: true }
  | {
      allowed: false
      reason: string
      needsDecision?: boolean
    }

export type AuthoringSceneAdapter = {
  read: () => SceneSnapshot
  capture: () => RodTrain[]
  checkReplacement: (snapshot: SceneSnapshot) => SceneResult
  replace: (snapshot: SceneSnapshot) => SceneResult
}

export type LevelAuthoringOptions = {
  scene: AuthoringSceneAdapter
  editable: () => boolean
}
