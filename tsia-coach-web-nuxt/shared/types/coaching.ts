// shared/types/coaching.ts
import type { components } from '#server/types/schema'

export type CoachTurnRequest =
    components['schemas']['CoachTurnRequest']

export type CoachTurnResponse =
    components['schemas']['CoachTurnResponse']

export type CoachMoveResponse =
    components['schemas']['CoachMoveResponse']

export type AskReadingQuestionResponse =
    components['schemas']['CoachMoveResponseAskReadingQuestionResponse']

export type DiagnoseDifferenceResponse =
    components['schemas']['CoachMoveResponseDiagnoseDifferenceResponse']

export type SuggestScaffoldResponse =
    components['schemas']['CoachMoveResponseSuggestScaffoldResponse']

export type ExplainWhyResponse =
    components['schemas']['CoachMoveResponseExplainWhyResponse']

export type CoachTurnEvent = CoachTurnRequest['event']

export const CoachTurnEvents = {
    HelpRequested: 'helpRequested',
    DiagnosisRequested: 'diagnosisRequested',
    ExplainCorrect: 'explainCorrect'
} as const

export const CoachMoveKinds = {
    AskReadingQuestion: 'askReadingQuestion',
    DiagnoseDifference: 'diagnoseDifference',
    SuggestScaffold: 'suggestScaffold',
    ExplainWhy: 'explainWhy'
} as const

export type CoachMoveKind =
    typeof CoachMoveKinds[keyof typeof CoachMoveKinds]

export function isAskReadingQuestionMove(
    move: CoachMoveResponse,
): move is AskReadingQuestionResponse {
    return move.type === CoachMoveKinds.AskReadingQuestion
}

export function isDiagnoseDifferenceMove(
    move: CoachMoveResponse,
): move is DiagnoseDifferenceResponse {
    return move.type === CoachMoveKinds.DiagnoseDifference
}

export function isSuggestScaffoldMove(
    move: CoachMoveResponse,
): move is SuggestScaffoldResponse {
    return move.type === CoachMoveKinds.SuggestScaffold
}

export function isExplainWhyMove(
    move: CoachMoveResponse,
): move is ExplainWhyResponse {
    return move.type === CoachMoveKinds.ExplainWhy
}
