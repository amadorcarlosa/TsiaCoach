import type { SceneAction } from './rod.scene.types'

export type SceneMenuAction = Extract<
    SceneAction,
    { type: 'clone' | 'delete' | 'set-orientation' }
>

export type SceneMenuChoice = {
    label: string
    action: SceneMenuAction
    checked?: boolean
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