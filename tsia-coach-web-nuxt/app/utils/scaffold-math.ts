import type { SampleItem } from '#shared/types/sample-items'

export function latentScalarValue(
  item: SampleItem,
  latentMathId: string,
): number | null {
  const fact = item.semantics.latentFacts.find(candidate =>
    candidate.type === 'derivedScalar' && candidate.id === latentMathId
  )

  if (!fact || fact.type !== 'derivedScalar') {
    return null
  }

  return Number(fact.value)
}

export function latentExpressionText(
  item: SampleItem,
  latentMathId: string,
): string | null {
  const fact = item.semantics.latentFacts.find(candidate =>
    candidate.type === 'derivedExpression' && candidate.id === latentMathId
  )

  if (!fact || fact.type !== 'derivedExpression') {
    return null
  }

  return mathObjectText(item, fact.mathObjectId)
}

export function mathObjectText(
  item: SampleItem,
  mathObjectId: string,
): string | null {
  const object = item.mathematics.objects.find(candidate =>
    candidate.id === mathObjectId
  )

  if (!object) {
    return null
  }

  const nodes = new Map(object.nodes.map(node => [node.id, node]))

  function render(nodeId: string, nested = false): string {
    const node = nodes.get(nodeId)

    if (!node) {
      return ''
    }

    if (node.kind === 'integerLiteral') {
      return node.value ?? ''
    }

    if (node.kind === 'symbolReference') {
      return (node.value ?? '').replace(/^symbol-/, '')
    }

    if (node.kind === 'multiplication') {
      return node.childNodeIds.map(id => render(id, true)).join('')
    }

    if (node.kind === 'addition') {
      const expression = node.childNodeIds
        .map(id => render(id, true))
        .join(' + ')

      return nested ? `(${expression})` : expression
    }

    return ''
  }

  return render(object.rootNodeId) || null
}
