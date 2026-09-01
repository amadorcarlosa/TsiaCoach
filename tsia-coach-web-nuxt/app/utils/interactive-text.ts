import type {
  AnswerChoice,
  CharacterSpan,
  InteractiveTextItem
} from '#shared/types/sample-items'
import type { FocusTarget } from '~/pages/sample-Items/sample-items-ui'

export interface InteractiveTextSegment {
  text: string
  characterStart: number
  characterLength: number
  tokenIds: string[]
  phraseIds: string[]
  mathObjectIds: string[]
  mathNodeIds: string[]
}

interface NormalizedSpan {
  start: number
  end: number
}

interface SegmentBinding extends NormalizedSpan {
  tokenId?: string
  phraseId?: string
  mathObjectId?: string
  mathNodeId?: string
}

function numeric(value: number | string): number {
  return typeof value === 'number' ? value : Number(value)
}

export function normalizeCharacterSpan(span: CharacterSpan): NormalizedSpan {
  const start = numeric(span.start)
  return {
    start,
    end: start + numeric(span.length)
  }
}

function overlaps(
  left: NormalizedSpan,
  right: NormalizedSpan
): boolean {
  return left.start < right.end && right.start < left.end
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index])
}

function canMerge(
  left: InteractiveTextSegment,
  right: InteractiveTextSegment
): boolean {
  return left.characterStart + left.characterLength === right.characterStart
    && sameIds(left.tokenIds, right.tokenIds)
    && sameIds(left.phraseIds, right.phraseIds)
    && sameIds(left.mathObjectIds, right.mathObjectIds)
    && sameIds(left.mathNodeIds, right.mathNodeIds)
}

export function createInteractiveTextSegments(
  item: InteractiveTextItem,
  characterSpan: CharacterSpan
): InteractiveTextSegment[] {
  const requestedRange = normalizeCharacterSpan(characterSpan)
  const sourceRange = {
    start: Math.max(0, requestedRange.start),
    end: Math.min(item.text.sourceText.length, requestedRange.end)
  }

  if (sourceRange.end <= sourceRange.start) {
    return []
  }

  const bindings: SegmentBinding[] = [
    ...item.text.tokens.map(token => ({
      ...normalizeCharacterSpan(token.characterSpan),
      tokenId: token.id
    })),
    ...item.text.phrases.map(phrase => ({
      ...normalizeCharacterSpan(phrase.characterSpan),
      phraseId: phrase.id
    })),
    ...item.mathematics.textBindings.map(binding => ({
      ...normalizeCharacterSpan(binding.characterSpan),
      mathObjectId: binding.mathObjectId,
      mathNodeId: binding.mathNodeId ?? undefined
    }))
  ].filter(binding => overlaps(binding, sourceRange))

  const boundaries = new Set<number>([sourceRange.start, sourceRange.end])

  for (const binding of bindings) {
    boundaries.add(Math.max(sourceRange.start, binding.start))
    boundaries.add(Math.min(sourceRange.end, binding.end))
  }

  const orderedBoundaries = [...boundaries].sort((left, right) => left - right)
  const segments: InteractiveTextSegment[] = []

  for (let index = 0; index < orderedBoundaries.length - 1; index++) {
    const start = orderedBoundaries[index]!
    const end = orderedBoundaries[index + 1]!

    if (end <= start) {
      continue
    }

    const segmentRange = { start, end }
    const matching = bindings.filter(binding => overlaps(binding, segmentRange))
    const segment: InteractiveTextSegment = {
      text: item.text.sourceText.slice(start, end),
      characterStart: start,
      characterLength: end - start,
      tokenIds: unique(matching.map(binding => binding.tokenId)),
      phraseIds: unique(matching.map(binding => binding.phraseId)),
      mathObjectIds: unique(matching.map(binding => binding.mathObjectId)),
      mathNodeIds: unique(matching.map(binding => binding.mathNodeId))
    }

    const previous = segments.at(-1)

    if (previous && canMerge(previous, segment)) {
      previous.text += segment.text
      previous.characterLength += segment.characterLength
    } else {
      segments.push(segment)
    }
  }

  return segments
}

export function createAnswerSegments(
  item: InteractiveTextItem,
  answer: AnswerChoice
): InteractiveTextSegment[] {
  return createInteractiveTextSegments(item, answer.contentCharacterSpan)
}

export function sliceSourceText(
  item: InteractiveTextItem,
  span: CharacterSpan
): string {
  const normalized = normalizeCharacterSpan(span)
  return item.text.sourceText.slice(normalized.start, normalized.end)
}

export function focusTargetForSegment(
  segment: InteractiveTextSegment
): FocusTarget | null {
  const mathNodeId = segment.mathNodeIds[0]
  if (mathNodeId) {
    return { kind: 'mathNode', id: mathNodeId }
  }

  const mathObjectId = segment.mathObjectIds[0]
  if (mathObjectId) {
    return { kind: 'mathObject', id: mathObjectId }
  }

  const phraseId = segment.phraseIds[0]
  if (phraseId) {
    return { kind: 'phrase', id: phraseId }
  }

  const tokenId = segment.tokenIds[0]
  return tokenId ? { kind: 'token', id: tokenId } : null
}

export function segmentMatchesFocus(
  segment: InteractiveTextSegment,
  target: FocusTarget | null
): boolean {
  if (!target) {
    return false
  }

  if (target.kind === 'token') {
    return segment.tokenIds.includes(target.id)
  }

  if (target.kind === 'phrase') {
    return segment.phraseIds.includes(target.id)
  }

  if (target.kind === 'mathObject') {
    return segment.mathObjectIds.includes(target.id)
  }

  if (target.kind === 'mathNode') {
    return segment.mathNodeIds.includes(target.id)
  }

  return false
}
