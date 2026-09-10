import type { SceneAction } from './rod.scene.types'

export type SceneMenuAction = Extract<
    SceneAction,
    { type:
            'clone' |
            'delete' |
            'set-orientation'|
            'make-train' |
            'ungroup' |
            'regroup-ones' |
            'regroup-addends' |
            'regroup-factors'
    }
>

export type SceneMenuChoice =
  | {
      kind: 'action'
      label: string
      action: SceneMenuAction
      checked?: boolean
    }
  | {
      kind: 'submenu'
      label: string
      children: readonly SceneMenuChoice[]
      disabledReason?: string
    }

export type SceneMenuRequest = {
  trainId: string
  anchor: {
    x: number
    y: number
    width: number
    height: number
  }
}
