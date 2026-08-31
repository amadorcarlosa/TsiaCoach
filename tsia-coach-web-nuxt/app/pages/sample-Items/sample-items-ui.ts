import type { InteractiveTextSegment } from '~/utils/interactive-text'

export const FocusTargetKinds = {
  Token: 'token',
  Phrase: 'phrase',
  Answer: 'answer',
  MathObject: 'mathObject',
  MathNode: 'mathNode',
  SemanticFact: 'semanticFact'
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
  color: 'success' | 'warning'
  icon: string
  title: string
  description: string
}
