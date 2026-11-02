import type { SceneAction, SceneResult } from './rod.scene.types'

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
            'regroup-factors' |
            'regroup-area' |
            'set-material-role'
    }
>

/**
 * Requests a board opens instead of committing. Choosing one never mutates the
 * scene: the board starts a flow (such as a preview) that commits separately.
 */
export type SceneMenuCommand =
  | 'preview-zero-pair'
  | 'systems-repeat-row'
  | 'systems-arrange-rows'
  | 'systems-redistribute'
  | 'systems-test-candidate'
  | 'region-add-here'
  | 'region-select-group'

export type SceneMenuChoice =
  | {
      kind: 'action'
      label: string
      action: SceneMenuAction
      checked?: boolean
    }
  | {
      kind: 'command'
      label: string
      command: SceneMenuCommand
      /** Command arguments, such as a chosen x and y. Never scene data. */
      params?: Readonly<Record<string, number>>
      /** Availability, computed by the board from the current selection. */
      result: SceneResult
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
