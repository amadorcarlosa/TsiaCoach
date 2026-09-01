import type { InteractiveTextSegment } from '~/utils/interactive-text'
import type { AttemptProjection, CoachingButton } from '#shared/types/sample-items'
import { AttemptPhaseKinds, isVisibleCoachingButton } from '#shared/types/sample-items'
import type { CoachMoveResponse } from '#shared/types/coaching'
import {
  isAskReadingQuestionMove,
  isSuggestScaffoldMove
} from '#shared/types/coaching'

export const FocusTargetKinds = {
  Token: 'token',
  Phrase: 'phrase',
  Answer: 'answer',
  MathObject: 'mathObject',
  MathNode: 'mathNode'
} as const

export type FocusTargetKind =
  typeof FocusTargetKinds[keyof typeof FocusTargetKinds]

export interface FocusTarget {
  kind: FocusTargetKind
  id: string
}

export interface FocusTargetCommand {
  itemId: string
  target: FocusTarget
}

export const LoadStates = {
  Idle: 'idle',
  Loading: 'loading',
  Loaded: 'loaded',
  Error: 'error'
} as const

export const SubmissionStates = {
  Idle: 'idle',
  Submitting: 'submitting',
  Submitted: 'submitted',
  Error: 'error'
} as const

export type LoadState = typeof LoadStates[keyof typeof LoadStates]
export type SubmissionState = typeof SubmissionStates[keyof typeof SubmissionStates]

export interface SampleItemAnswerView {
  id: string
  label: string
  segments: InteractiveTextSegment[]
  mathObjectId: string | null
}

export interface SampleItemFeedback {
  color: 'success' | 'warning' | 'error'
  icon: string
  title: string
  description: string
}

export function visibleCoachingButtonLabel(
  button: CoachingButton | null | undefined
): string | null {
  return button && isVisibleCoachingButton(button) ? button.label : null
}

export interface CoachingCardView {
  role: 'question' | 'message'
  message: string
  ariaLive: 'polite'
  walkthroughHref: string | null
}

export function coachingCardView(
  move: CoachMoveResponse | null,
  attemptId: string | null
): CoachingCardView | null {
  if (!move) {
    return null
  }

  return {
    role: isAskReadingQuestionMove(move) ? 'question' : 'message',
    message: move.message,
    ariaLive: 'polite',
    walkthroughHref: isSuggestScaffoldMove(move) && attemptId
      ? `/scaffolds/${encodeURIComponent(attemptId)}`
      : null
  }
}

export interface CoachingErrorView {
  title: string
  description: string
  retryLabel: string
  ariaLive: 'polite'
}

export function coachingErrorView(error: string | null): CoachingErrorView | null {
  if (!error) {
    return null
  }

  return {
    title: 'Coaching is unavailable',
    description: error,
    retryLabel: 'Retry',
    ariaLive: 'polite'
  }
}

export function feedbackFor(
  projection: AttemptProjection | null,
  submissionState: SubmissionState
): SampleItemFeedback | null {
  if (submissionState !== SubmissionStates.Submitted) {
    return null
  }

  if (projection?.phase?.type === AttemptPhaseKinds.AfterCorrectCheck) {
    return {
      color: 'success',
      icon: 'i-lucide-circle-check',
      title: 'Correct',
      description: 'That expression represents the requested quantity.'
    }
  }

  if (projection?.phase?.type === AttemptPhaseKinds.AfterIncorrectCheck) {
    return {
      color: 'warning',
      icon: 'i-lucide-lightbulb',
      title: 'Try another expression',
      description: 'Trace the quantities in the question, then choose again.'
    }
  }

  return null
}
