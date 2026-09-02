// shared/types/coaching.ts
import type { components } from '#server/types/schema'

export type CoachTurnRequest =
    components['schemas']['CoachTurnRequest']

export type CoachTurnResponse =
    components['schemas']['CoachTurnResponse']

export type CoachMoveResponse =
    components['schemas']['CoachMoveResponse']

export type AskProbeResponse =
    components['schemas']['CoachMoveResponseAskProbeResponse']

export type RouteToStepResponse =
    components['schemas']['CoachMoveResponseRouteToStepResponse']

export type DiagnoseDifferenceResponse =
    components['schemas']['CoachMoveResponseDiagnoseDifferenceResponse']

export type SuggestScaffoldResponse =
    components['schemas']['CoachMoveResponseSuggestScaffoldResponse']

export type ExplainWhyResponse =
    components['schemas']['CoachMoveResponseExplainWhyResponse']

export type AnswerQuestionResponse =
    components['schemas']['CoachMoveResponseAnswerQuestionResponse']

export type CoachTurnEvent = CoachTurnRequest['event']

export const CoachTurnEvents = {
    HelpRequested: 'helpRequested',
    ProbeAnswered: 'probeAnswered',
    DiagnosisRequested: 'diagnosisRequested',
    ExplainCorrect: 'explainCorrect',
    StepQuestionAsked: 'stepQuestionAsked'
} as const

/** Upper bound the server enforces on a probe answer; mirrored for the input. */
export const MaxProbeAnswerLength = 500

/** Upper bound the server enforces on a step question; mirrored for the input. */
export const MaxQuestionLength = 500

export const CoachMoveKinds = {
    AskProbe: 'askProbe',
    RouteToStep: 'routeToStep',
    DiagnoseDifference: 'diagnoseDifference',
    SuggestScaffold: 'suggestScaffold',
    ExplainWhy: 'explainWhy',
    AnswerQuestion: 'answerQuestion'
} as const

export type CoachMoveKind =
    typeof CoachMoveKinds[keyof typeof CoachMoveKinds]

export function isAskProbeMove(
    move: CoachMoveResponse,
): move is AskProbeResponse {
    return move.type === CoachMoveKinds.AskProbe
}

export function isRouteToStepMove(
    move: CoachMoveResponse,
): move is RouteToStepResponse {
    return move.type === CoachMoveKinds.RouteToStep
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

export function isAnswerQuestionMove(
    move: CoachMoveResponse,
): move is AnswerQuestionResponse {
    return move.type === CoachMoveKinds.AnswerQuestion
}

export function isExplainWhyMove(
    move: CoachMoveResponse,
): move is ExplainWhyResponse {
    return move.type === CoachMoveKinds.ExplainWhy
}
