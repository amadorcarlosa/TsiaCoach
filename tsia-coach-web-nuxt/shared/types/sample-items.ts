// shared/types/sample-item.ts
import type { components } from '#server/types/schema'

export type SampleItem =
    components['schemas']['PracticeItemResponse']

export type PracticeItemPrompt =
    components['schemas']['PracticeItemPromptResponse']

export type InteractiveTextItem =
    SampleItem | PracticeItemPrompt

export type QuestionInteraction =
    components['schemas']['QuestionInteractionResponse']

export type MultipleChoiceInteraction =
    components['schemas']['QuestionInteractionResponseMultipleChoiceInteractionResponse']

export type PromptMultipleChoiceInteraction =
    components['schemas']['PromptMultipleChoiceInteractionResponse']

export type AttemptProjection =
    components['schemas']['AttemptProjectionResponse']

export type AttemptPhase =
    components['schemas']['AttemptPhaseResponse']

export type CoachingButton =
    components['schemas']['CoachingButtonResponse']

export type CoachingRoute =
    components['schemas']['CoachingRouteResponse']

export const AttemptPhaseKinds = {
    BeforeCheck: 'beforeCheck',
    AfterIncorrectCheck: 'afterIncorrectCheck',
    AfterCorrectCheck: 'afterCorrectCheck'
} as const

export const CoachingButtonKinds = {
    Visible: 'visible',
    Hidden: 'hidden'
} as const

export const CoachingRouteKinds = {
    ScaffoldEntry: 'scaffoldEntry',
    NoScaffoldAuthored: 'noScaffoldAuthored'
} as const

export function isBeforeCheckPhase(
    projection: AttemptProjection | null,
): projection is AttemptProjection & {
    phase: { type: typeof AttemptPhaseKinds.BeforeCheck }
} {
    return projection?.phase.type === AttemptPhaseKinds.BeforeCheck
}

export function isAfterIncorrectCheckPhase(
    projection: AttemptProjection | null,
): projection is AttemptProjection & {
    phase: { type: typeof AttemptPhaseKinds.AfterIncorrectCheck }
} {
    return projection?.phase.type === AttemptPhaseKinds.AfterIncorrectCheck
}

export function isAfterCorrectCheckPhase(
    projection: AttemptProjection | null,
): projection is AttemptProjection & {
    phase: { type: typeof AttemptPhaseKinds.AfterCorrectCheck }
} {
    return projection?.phase.type === AttemptPhaseKinds.AfterCorrectCheck
}

export function isVisibleCoachingButton(
    button: CoachingButton,
): button is CoachingButton & { type: typeof CoachingButtonKinds.Visible } {
    return button.type === CoachingButtonKinds.Visible
}

export function isHiddenCoachingButton(
    button: CoachingButton,
): button is CoachingButton & { type: typeof CoachingButtonKinds.Hidden } {
    return button.type === CoachingButtonKinds.Hidden
}

export function isScaffoldEntryRoute(
    route: CoachingRoute,
): route is CoachingRoute & { type: typeof CoachingRouteKinds.ScaffoldEntry } {
    return route.type === CoachingRouteKinds.ScaffoldEntry
}

export function isNoScaffoldAuthoredRoute(
    route: CoachingRoute,
): route is CoachingRoute & { type: typeof CoachingRouteKinds.NoScaffoldAuthored } {
    return route.type === CoachingRouteKinds.NoScaffoldAuthored
}

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
