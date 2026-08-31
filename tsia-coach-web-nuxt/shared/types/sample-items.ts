// shared/types/sample-item.ts
import type { components } from '#server/types/schema'

export type SampleItem =
    components['schemas']['PracticeItemResponse']

export type CharacterSpan =
    components['schemas']['CharacterSpanResponse']

export type AnswerChoice =
    components['schemas']['AnswerChoiceResponse']

export type MathObject =
    components['schemas']['MathObjectResponse']

export type MathNode =
    components['schemas']['MathNodeResponse']
