import { describe, expect, it } from 'vitest'
import type { SampleItem } from '#shared/types/sample-items'
import {
  createAnswerSegments,
  createInteractiveTextSegments
} from './interactive-text'

const item = {
  id: 'practice-item-test',
  text: {
    sourceText: 'D. 2n + 2',
    tokens: [
      { id: 't39', index: 39, surface: 'D', kind: 'symbol', characterSpan: { start: 0, length: 1 } },
      { id: 't40', index: 40, surface: '.', kind: 'punctuation', characterSpan: { start: 1, length: 1 } },
      { id: 't41', index: 41, surface: '2', kind: 'number', characterSpan: { start: 3, length: 1 } },
      { id: 't42', index: 42, surface: 'n', kind: 'symbol', characterSpan: { start: 4, length: 1 } },
      { id: 't43', index: 43, surface: '+', kind: 'symbol', characterSpan: { start: 6, length: 1 } },
      { id: 't44', index: 44, surface: '2', kind: 'number', characterSpan: { start: 8, length: 1 } }
    ],
    sentences: [],
    phrases: []
  },
  semantics: {
    entities: [],
    edges: [],
    latentFacts: []
  },
  mathematics: {
    objects: [{
      id: 'math-answer-d',
      rootNodeId: 'math-answer-d-addition',
      nodes: []
    }],
    textBindings: [
      { mathObjectId: 'math-answer-d', mathNodeId: null, characterSpan: { start: 3, length: 6 } },
      { mathObjectId: 'math-answer-d', mathNodeId: 'math-answer-d-coefficient', characterSpan: { start: 3, length: 1 } },
      { mathObjectId: 'math-answer-d', mathNodeId: 'math-answer-d-variable', characterSpan: { start: 4, length: 1 } },
      { mathObjectId: 'math-answer-d', mathNodeId: 'math-answer-d-product', characterSpan: { start: 3, length: 2 } },
      { mathObjectId: 'math-answer-d', mathNodeId: 'math-answer-d-addition', characterSpan: { start: 5, length: 3 } },
      { mathObjectId: 'math-answer-d', mathNodeId: 'math-answer-d-constant', characterSpan: { start: 8, length: 1 } }
    ]
  },
  interaction: {
    type: 'multipleChoice',
    answers: [{
      id: 'answer-d',
      labelSpan: { start: 39, length: 2 },
      labelCharacterSpan: { start: 0, length: 2 },
      contentSpan: { start: 41, length: 4 },
      contentCharacterSpan: { start: 3, length: 6 }
    }],
    answerMathBindings: [{
      answerChoiceId: 'answer-d',
      mathObjectId: 'math-answer-d'
    }],
    correctAnswerId: 'answer-d'
  }
} as SampleItem

describe('createInteractiveTextSegments', () => {
  it('preserves the exact authored source slice including spaces', () => {
    const segments = createAnswerSegments(item, item.interaction.answers[0]!)

    expect(segments.map(segment => segment.text).join('')).toBe('2n + 2')
    expect(segments.some(segment => segment.text === ' ')).toBe(true)
  })

  it('keeps overlapping token, math-object, and math-node identities', () => {
    const segments = createInteractiveTextSegments(item, { start: 3, length: 6 })
    const coefficient = segments.find(segment => segment.text === '2')!
    const addition = segments.find(segment => segment.text === '+')!

    expect(coefficient.tokenIds).toContain('t41')
    expect(coefficient.mathObjectIds).toContain('math-answer-d')
    expect(coefficient.mathNodeIds).toEqual([
      'math-answer-d-coefficient',
      'math-answer-d-product'
    ])
    expect(addition.tokenIds).toEqual(['t43'])
    expect(addition.mathNodeIds).toContain('math-answer-d-addition')
  })
})
