import type { InteractiveTextItem } from '#shared/types/sample-items'

export function mathObjectText(
  item: InteractiveTextItem,
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
