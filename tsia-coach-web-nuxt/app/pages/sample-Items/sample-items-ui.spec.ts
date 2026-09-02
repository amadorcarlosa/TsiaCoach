import { describe, expect, it } from 'vitest'
import {
  coachingCardView,
  coachingErrorView,
  feedbackFor,
  visibleCoachingButtonLabel
} from './sample-items-ui'
import {
  AttemptPhaseKinds,
  type AttemptProjection,
  type CoachingButton,
} from '#shared/types/sample-items'
import type { CoachMoveResponse } from '#shared/types/coaching'
import { SubmissionStates } from './sample-items-ui'

describe('feedback helper', () => {
  it('incorrectProjection_DrivesWarningWithoutClientAnswerKey', () => {
    const incorrectProjection: AttemptProjection = {
      attemptId: 'attempt-1',
      practiceItemId: 'item-1',
      checkCount: 1,
      coachingButton: {
        type: 'hidden'
      },
      phase: {
        type: AttemptPhaseKinds.AfterIncorrectCheck,
        selectedAnswerId: 'choice-2',
        misconceptionCode: 'm1',
        purpose: 'Understanding',
        route: {
          type: 'noScaffoldAuthored'
        },
        routeStreak: 1,
        hintLevel: 'none'
      }
    }

    const feedback = feedbackFor(incorrectProjection, SubmissionStates.Submitted)

    expect(feedback).toEqual({
      color: 'warning',
      icon: 'i-lucide-lightbulb',
      title: 'Try another expression',
      description: 'Trace the quantities in the question, then choose again.'
    })
  })

  it('correctProjection_DrivesSuccessFeedback', () => {
    const correctProjection: AttemptProjection = {
      attemptId: 'attempt-1',
      practiceItemId: 'item-1',
      checkCount: 1,
      coachingButton: {
        type: 'visible',
        label: 'Continue'
      },
      phase: {
        type: AttemptPhaseKinds.AfterCorrectCheck,
        selectedAnswerId: 'choice-1'
      }
    }

    const feedback = feedbackFor(correctProjection, SubmissionStates.Submitted)

    expect(feedback).toEqual({
      color: 'success',
      icon: 'i-lucide-circle-check',
      title: 'Correct',
      description: 'That expression represents the requested quantity.'
    })
  })
})

describe('coaching view helpers', () => {
  it('visibleCoachingButton_UsesServerLabel', () => {
    expect(visibleCoachingButtonLabel({
      type: 'visible',
      label: 'Why it works'
    } as CoachingButton)).toBe('Why it works')
  })

  it('hiddenCoachingButton_RendersNoControl', () => {
    expect(visibleCoachingButtonLabel({
      type: 'hidden'
    } as CoachingButton)).toBeNull()
    expect(visibleCoachingButtonLabel(null)).toBeNull()
  })

  it('askProbe_RendersQuestionWithAnswerInput', () => {
    const view = coachingCardView({
      type: 'askProbe',
      message: 'What makes a number <b>odd</b>?',
      focusPhraseIds: ['phrase-1']
    } as CoachMoveResponse, 'attempt-1')

    expect(view).toEqual({
      role: 'question',
      message: 'What makes a number <b>odd</b>?',
      ariaLive: 'polite',
      probeInput: true,
      walkthroughHref: null
    })
  })

  it('routeToStep_RendersAuthoredMessageAndWalkthroughWithoutStepId', () => {
    const view = coachingCardView({
      type: 'routeToStep',
      message: 'Right, one left over.',
      focusPhraseIds: [],
      stepId: 'step-hidden-entry'
    } as CoachMoveResponse, 'attempt-1')

    expect(view?.role).toBe('message')
    expect(view?.probeInput).toBe(false)
    expect(view?.walkthroughHref).toBe('/scaffolds/attempt-1')
    expect(JSON.stringify(view)).not.toContain('step-hidden-entry')
  })

  it('diagnoseDifference_RendersPlainText', () => {
    const view = coachingCardView({
      type: 'diagnoseDifference',
      message: 'Your choice stops after the second integer.',
      focusPhraseIds: ['phrase-2']
    } as CoachMoveResponse, 'attempt-1')

    expect(view).toEqual({
      role: 'message',
      message: 'Your choice stops after the second integer.',
      ariaLive: 'polite',
      probeInput: false,
      walkthroughHref: null
    })
    expect(JSON.stringify(view)).not.toContain('misconception')
    expect(JSON.stringify(view)).not.toContain('purpose')
  })

  it('suggestScaffold_RendersAuthorizedWalkthroughAction', () => {
    const view = coachingCardView({
      type: 'suggestScaffold',
      message: 'Try the guided walkthrough.',
      focusPhraseIds: [],
      suggestedStepId: 'step-hidden-entry'
    } as CoachMoveResponse, 'attempt-1')

    expect(view?.walkthroughHref).toBe('/scaffolds/attempt-1')
    expect(JSON.stringify(view)).not.toContain('step-hidden-entry')
  })

  it('explainWhy_DoesNotRenderProvenanceIds', () => {
    const view = coachingCardView({
      type: 'explainWhy',
      message: 'The expression joins both known quantities.',
      focusPhraseIds: ['phrase-1'],
      provenanceFactIds: ['fact-77', 'fact-78']
    } as CoachMoveResponse, 'attempt-1')

    expect(view?.message).toBe('The expression joins both known quantities.')
    expect(JSON.stringify(view)).not.toContain('fact-77')
    expect(JSON.stringify(view)).not.toContain('provenance')
  })

  it('coachingError_RendersSafeRetry', () => {
    const view = coachingErrorView('The coach is busy. Try again in a moment.')

    expect(view).toEqual({
      title: 'Coaching is unavailable',
      description: 'The coach is busy. Try again in a moment.',
      retryLabel: 'Retry',
      ariaLive: 'polite'
    })
    expect(coachingErrorView(null)).toBeNull()
  })

  it('coachingMessage_IsAnnouncedPolitely', () => {
    const view = coachingCardView({
      type: 'askProbe',
      message: 'Read the first sentence again.',
      focusPhraseIds: []
    } as CoachMoveResponse, 'attempt-1')

    expect(view?.ariaLive).toBe('polite')
    expect(coachingErrorView('Could not reach the coach.')?.ariaLive).toBe('polite')
  })
})
