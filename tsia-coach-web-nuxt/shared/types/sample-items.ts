// shared/types/sample-item.ts
import type { components } from '#server/types/schema'

export type SampleItem =
    components['schemas']['PracticeItemResponse']

export type QuestionInteraction =
    components['schemas']['QuestionInteractionResponse']

export type MultipleChoiceInteraction =
    components['schemas']['QuestionInteractionResponseMultipleChoiceInteractionResponse']

export const QuestionInteractionTypes = {
    MultipleChoice: 'multipleChoice'
} as const

export type QuestionInteractionType =
    typeof QuestionInteractionTypes[keyof typeof QuestionInteractionTypes]

export function isMultipleChoiceInteraction(
    interaction: QuestionInteraction
): interaction is MultipleChoiceInteraction {
    return interaction.type === QuestionInteractionTypes.MultipleChoice
}

export function getMultipleChoiceInteraction(
    item: SampleItem
): MultipleChoiceInteraction | null {
    return isMultipleChoiceInteraction(item.interaction)
        ? item.interaction
        : null
}

export type CharacterSpan =
    components['schemas']['CharacterSpanResponse']

export type AnswerChoice =
    components['schemas']['AnswerChoiceResponse']

export type MathObject =
    components['schemas']['MathObjectResponse']

export type MathNode =
    components['schemas']['MathNodeResponse']
