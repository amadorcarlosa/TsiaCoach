import { computed, readonly, ref } from 'vue'
import { algebraTileDefinition, algebraTileDimensions, algebraTileTerms, algebraTileLabels, type AlgebraTile, type AlgebraTileTerm, type AlgebraTileSign } from '~/components/algebratiles/algebra-tile.types'
import type { Point } from '~/components/grid/gridPointer'

export type AlgebraTileAction =
  | { type: 'create'; term: AlgebraTileTerm; sign: AlgebraTileSign }
  | { type: 'move'; delta: Point }
  | { type: 'clone' | 'delete' | 'rotate' | 'flip-sign' | 'remove-zero-pairs' }
export type AlgebraTileResult = { allowed: true } | { allowed: false; reason: string }
type Candidate = { allowed: true; tiles: AlgebraTile[] } | { allowed: false; reason: string }

export function useAlgebraTileScene(options: { editable: () => boolean; columns?: number; rows?: number }) {
  const columns = options.columns ?? 120
  const rows = options.rows ?? 120
  const tiles = ref<AlgebraTile[]>([])
  const selection = ref<Set<string>>(new Set())
  const message = ref('')
  let nextId = 1
  const coefficients = computed(() => Object.fromEntries(algebraTileTerms.map(term => [term, tiles.value.filter(tile => tile.term === term).reduce((sum, tile) => sum + algebraTileDefinition(tile.term, tile.sign).coefficient, 0)])) as Record<AlgebraTileTerm, number>)
  const expression = computed(() => {
    const terms: string[] = []
    for (const term of ['xSquared', 'xy', 'ySquared', 'x', 'y', 'one'] as const) {
      const value = coefficients.value[term]
      if (!value) continue
      const magnitude = Math.abs(value)
      const label = term === 'one' ? String(magnitude) : (magnitude === 1 ? '' : String(magnitude)) + algebraTileLabels[term]
      terms.push((terms.length ? (value < 0 ? ' − ' : ' + ') : value < 0 ? '−' : '') + label)
    }
    return terms.join('') || '0'
  })
  const reject = (reason: string): Candidate => ({ allowed: false, reason })
  function fits(tile: AlgebraTile, others: readonly AlgebraTile[]): boolean {
    const { width, depth } = algebraTileDimensions(tile)
    const { x, y } = tile.anchor
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + width > columns || y + depth > rows) return false
    return !others.some(other => {
      const size = algebraTileDimensions(other)
      return x < other.anchor.x + size.width && x + width > other.anchor.x && y < other.anchor.y + size.depth && y + depth > other.anchor.y
    })
  }
  function validate(candidate: AlgebraTile[]): Candidate {
    return candidate.every((tile, index) => fits(tile, candidate.slice(0, index)))
      ? { allowed: true, tiles: candidate }
      : reject('Keep tiles inside the board without overlapping.')
  }
  function place(tile: AlgebraTile, others: AlgebraTile[], preferred?: Point): boolean {
    if (preferred) {
      tile.anchor = { ...preferred }
      if (fits(tile, others)) { others.push(tile); return true }
    }
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      tile.anchor = { x, y }
      if (fits(tile, others)) { others.push(tile); return true }
    }
    return false
  }
  function build(ids: readonly string[], action: AlgebraTileAction): Candidate {
    if (!options.editable()) return reject('Editing is unavailable.')
    const current = tiles.value.map(tile => ({ ...tile, anchor: { ...tile.anchor } }))
    if (action.type === 'create') {
      if (!['positive', 'negative'].includes(action.sign)) return reject('Choose a supported sign.')
      if (!algebraTileTerms.includes(action.term)) return reject('Choose a supported term.')
      return place({ id: '', term: action.term, sign: action.sign, rotated: false, anchor: { x: 0, y: 0 } }, current)
        ? { allowed: true, tiles: current } : reject('No room for this tile.')
    }
    const selectedIds = new Set(ids)
    const selected = current.filter(tile => selectedIds.has(tile.id))
    if (!selected.length || selected.length !== selectedIds.size) return reject('Select existing tiles first.')
    const remaining = current.filter(tile => !selectedIds.has(tile.id))
    if (action.type === 'delete') return { allowed: true, tiles: remaining }
    if (action.type === 'move') {
      selected.forEach(tile => { tile.anchor.x += action.delta.x; tile.anchor.y += action.delta.y })
      return validate(current)
    }
    if (action.type === 'flip-sign') {
      selected.forEach(tile => { tile.sign = tile.sign === 'positive' ? 'negative' : 'positive' })
      return { allowed: true, tiles: current }
    }
    if (action.type === 'remove-zero-pairs') {
      const removed = new Set<string>()
      for (const term of algebraTileTerms) {
        const positive = selected.filter(tile => tile.term === term && tile.sign === 'positive')
        const negative = selected.filter(tile => tile.term === term && tile.sign === 'negative')
        for (let i = 0; i < Math.min(positive.length, negative.length); i++) {
          removed.add(positive[i]!.id); removed.add(negative[i]!.id)
        }
      }
      return removed.size ? { allowed: true, tiles: current.filter(tile => !removed.has(tile.id)) }
        : reject('Select a positive and a negative tile of the same term.')
    }
    if (action.type === 'rotate') {
      if (selected.every(tile => { const size = algebraTileDimensions(tile); return size.width === size.depth })) return reject('These tiles have square footprints.')
      selected.forEach(tile => { tile.rotated = !tile.rotated })
      return validate(current)
    }
    if (action.type === 'clone') {
      const offsets: Point[] = []
      for (let y = -rows; y <= rows; y++) for (let x = -columns; x <= columns; x++) if (x || y) offsets.push({ x, y })
      offsets.sort((a, b) => Math.abs(a.x) + Math.abs(a.y) - Math.abs(b.x) - Math.abs(b.y) || b.x - a.x || b.y - a.y)
      for (const offset of offsets) {
        const copies = selected.map(tile => ({ ...tile, id: '', anchor: { x: tile.anchor.x + offset.x, y: tile.anchor.y + offset.y } }))
        if (copies.every(tile => fits(tile, current))) return { allowed: true, tiles: [...current, ...copies] }
      }
      return reject('No room to clone the selection.')
    }
    return reject('Unsupported action.')
  }

  function check(ids: readonly string[], action: AlgebraTileAction): AlgebraTileResult {
    const result = build(ids, action)
    return result.allowed ? { allowed: true } : result
  }
  function apply(ids: readonly string[], action: AlgebraTileAction): AlgebraTileResult {
    const result = build(ids, action)
    if (!result.allowed) { message.value = result.reason; return result }
    const created: string[] = []
    result.tiles.forEach(tile => { if (!tile.id) { tile.id = `algebra-tile-${nextId++}`; created.push(tile.id) } })
    tiles.value = result.tiles
    selection.value = new Set(created.length ? created : [...selection.value].filter(id => result.tiles.some(tile => tile.id === id)))
    message.value = ''
    return { allowed: true }
  }
  function select(ids: readonly string[]) { selection.value = new Set(ids.filter(id => tiles.value.some(tile => tile.id === id))) }
  function constrainMove(ids: readonly string[], delta: Point): Point {
    const selected = tiles.value.filter(tile => ids.includes(tile.id))
    if (!selected.length) return { x: 0, y: 0 }
    return {
      x: Math.max(-Math.min(...selected.map(tile => tile.anchor.x)), Math.min(columns - Math.max(...selected.map(tile => tile.anchor.x + algebraTileDimensions(tile).width)), Math.round(delta.x))),
      y: Math.max(-Math.min(...selected.map(tile => tile.anchor.y)), Math.min(rows - Math.max(...selected.map(tile => tile.anchor.y + algebraTileDimensions(tile).depth)), Math.round(delta.y))),
    }
  }
  return { columns, rows, tiles: readonly(tiles), selection: readonly(selection), message: readonly(message), coefficients, expression, check, apply, select, constrainMove }
}
