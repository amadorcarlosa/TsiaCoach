import { describe, expect, it } from 'vitest'
import { feedbackFor } from './sample-items-ui'
import {
  AttemptPhaseKinds,
  type AttemptProjection,
} from '#shared/types/sample-items'
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
