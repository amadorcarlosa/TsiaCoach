import { computed, readonly, ref } from 'vue'
import { baseTenCatalog, baseTenDimensions, defaultBaseTenPose, supportedBaseTenPoses, type BaseTenPose, playableDenominations, type BaseTenBlock, type PlayableDenomination } from '~/components/basetenblocks/base10.types'
import type { Point } from '~/components/grid/gridPointer'
import { offsetsByDistance, onBoardRange } from '~/components/grid/nearest-offsets'
import { createTurnMemory, edgeShift, settleTurn, shifted, type TurnedPiece } from '~/components/grid/rotation-fit'

export type BaseTenAction =
  | { type: 'create'; denomination: PlayableDenomination }
  | { type: 'move'; delta: Point }
  | { type: 'set-pose'; pose: BaseTenPose }
  | { type: 'clone' | 'delete' | 'rotate' | 'exchange-up' | 'exchange-down' }
export type BaseTenResult = { allowed: true } | { allowed: false; reason: string }
type Turn = { id: string; inverse: string; shift: Point }
type Candidate = { allowed: true; blocks: BaseTenBlock[]; turns?: Turn[] } | { allowed: false; reason: string }
const blockState = (block: BaseTenBlock) => JSON.stringify([block.anchor, block.rotated, block.pose])

export function useBaseTenScene(options: { editable: () => boolean; columns?: number; rows?: number }) {
  const columns = options.columns ?? 120
  const rows = options.rows ?? 120
  const blocks = ref<BaseTenBlock[]>([])
  const selection = ref<Set<string>>(new Set())
  const message = ref('')
  const turnMemory = createTurnMemory()
  let nextId = 1
  const total = computed(() => blocks.value.reduce((sum, block) => sum + baseTenCatalog[block.denomination].value, 0))
  const reject = (reason: string): Candidate => ({ allowed: false, reason })
  function fits(block: BaseTenBlock, others: readonly BaseTenBlock[]): boolean {
    if (!supportedBaseTenPoses(block.denomination).includes(block.pose)) return false
    const { width, depth } = baseTenDimensions(block)
    const { x, y } = block.anchor
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + width > columns || y + depth > rows) return false
    return !others.some(other => {
      const size = baseTenDimensions(other)
      return x < other.anchor.x + size.width && x + width > other.anchor.x && y < other.anchor.y + size.depth && y + depth > other.anchor.y
    })
  }
  function validate(candidate: BaseTenBlock[]): Candidate {
    return candidate.every((block, index) => fits(block, candidate.slice(0, index)))
      ? { allowed: true, blocks: candidate }
      : reject('Keep blocks inside the board without overlapping.')
  }
  function place(block: BaseTenBlock, others: BaseTenBlock[], preferred?: Point): boolean {
    if (preferred) {
      block.anchor = { ...preferred }
      if (fits(block, others)) { others.push(block); return true }
    }
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      block.anchor = { x, y }
      if (fits(block, others)) { others.push(block); return true }
    }
    return false
  }
  /**
   * Turns blocks about their anchors, sliding each back onto the board when
   * it would hang off an edge. `change` reshapes one block and returns the
   * request that would undo it.
   */
  function turn(current: BaseTenBlock[], turning: BaseTenBlock[], request: string, change: (block: BaseTenBlock) => string): Candidate {
    const bounds = { x: 0, y: 0, width: columns, depth: rows }
    const turned: (TurnedPiece & { inverse: string })[] = []
    for (const block of turning) {
      const back = turnMemory.returnShift(block.id, blockState(block), request)
      const inverse = change(block)
      const edge = edgeShift({ ...block.anchor, ...baseTenDimensions(block) }, bounds)
      if (!edge) return reject('This block is too large to turn on this board.')
      turned.push({ id: block.id, edge, back, inverse })
    }
    const { result, shifts } = settleTurn(turned, shifts => validate(current.map(block =>
      shifts.has(block.id) ? { ...block, anchor: shifted(block.anchor, shifts.get(block.id)) } : block)))
    return result.allowed
      ? { ...result, turns: turned.map(item => ({ id: item.id, inverse: item.inverse, shift: shifts.get(item.id)! })) }
      : reject('Not enough room to turn here. Move the block or clear the space first.')
  }
  function build(ids: readonly string[], action: BaseTenAction): Candidate {
    if (!options.editable()) return reject('Editing is unavailable.')
    const current = blocks.value.map(block => ({ ...block, anchor: { ...block.anchor } }))
    if (action.type === 'create') {
      if (!playableDenominations.includes(action.denomination)) return reject('Choose a supported denomination.')
      return place({ id: '', denomination: action.denomination, pose: defaultBaseTenPose(action.denomination), rotated: false, anchor: { x: 0, y: 0 } }, current)
        ? { allowed: true, blocks: current } : reject('No room for this block.')
    }
    const selectedIds = new Set(ids)
    const selected = current.filter(block => selectedIds.has(block.id))
    if (!selected.length || selected.length !== selectedIds.size) return reject('Select existing blocks first.')
    const remaining = current.filter(block => !selectedIds.has(block.id))
    if (action.type === 'delete') return { allowed: true, blocks: remaining }
    if (action.type === 'move') {
      selected.forEach(block => { block.anchor.x += action.delta.x; block.anchor.y += action.delta.y })
      return validate(current)
    }
    if (action.type === 'set-pose') {
      if (selected.some(block => block.denomination !== 'hundreds' || !supportedBaseTenPoses(block.denomination).includes(action.pose))) return reject('Only hundreds can switch between flat and upright.')
      if (selected.every(block => block.pose === action.pose)) return reject('The selection already has this pose.')
      return turn(current, selected, action.pose, block => { const before = block.pose; block.pose = action.pose; return before })
    }
    if (action.type === 'rotate') {
      // Square blocks look the same turned, so their flag stays put.
      const oblong = selected.filter(block => { const size = baseTenDimensions(block); return size.width !== size.depth })
      if (!oblong.length) return reject('These blocks have square footprints.')
      return turn(current, oblong, 'rotate', block => { block.rotated = !block.rotated; return 'rotate' })
    }
    if (action.type === 'clone') {
      // Nearest on-board offsets first, generated lazily.
      const offsets = offsetsByDistance(onBoardRange(selected.map(block => ({ ...block.anchor, ...baseTenDimensions(block) })), columns, rows))
      for (const offset of offsets) {
        const copies = selected.map(block => ({ ...block, id: '', anchor: { x: block.anchor.x + offset.x, y: block.anchor.y + offset.y } }))
        if (copies.every(block => fits(block, current))) return { allowed: true, blocks: [...current, ...copies] }
      }
      return reject('No room to clone the selection.')
    }
    const denomination = selected[0]!.denomination
    const index = playableDenominations.indexOf(denomination)
    if (action.type === 'exchange-up' && (selected.length !== 10 || selected.some(block => block.denomination !== denomination))) return reject('Select exactly ten blocks of one denomination.')
    if (action.type === 'exchange-down' && selected.length !== 1) return reject('Select one block to exchange down.')
    const target = playableDenominations[index + (action.type === 'exchange-up' ? 1 : -1)]
    if (!target) return reject(action.type === 'exchange-up' ? 'Hundred-thousands is the largest supported block.' : 'Ones cannot be exchanged down.')
    const preferred = { x: Math.min(...selected.map(block => block.anchor.x)), y: Math.min(...selected.map(block => block.anchor.y)) }
    for (let i = 0; i < (action.type === 'exchange-up' ? 1 : 10); i++) {
      if (!place({ id: '', denomination: target, pose: defaultBaseTenPose(target), rotated: false, anchor: preferred }, remaining, preferred)) return reject('No room for all exchanged blocks. The board is unchanged.')
    }
    return { allowed: true, blocks: remaining }
  }
  function check(ids: readonly string[], action: BaseTenAction): BaseTenResult {
    const result = build(ids, action)
    return result.allowed ? { allowed: true } : result
  }
  function apply(ids: readonly string[], action: BaseTenAction): BaseTenResult {
    const result = build(ids, action)
    if (!result.allowed) { message.value = result.reason; return result }
    const created: string[] = []
    result.blocks.forEach(block => { if (!block.id) { block.id = `base-ten-${nextId++}`; created.push(block.id) } })
    blocks.value = result.blocks
    turnMemory.keep(result.blocks.map(block => block.id))
    for (const item of result.turns ?? []) {
      const block = result.blocks.find(candidate => candidate.id === item.id)
      if (block) turnMemory.remember(item.id, { ...item, state: blockState(block) })
    }
    selection.value = new Set(created.length ? created : [...selection.value].filter(id => result.blocks.some(block => block.id === id)))
    message.value = ''
    return { allowed: true }
  }
  function select(ids: readonly string[]) { selection.value = new Set(ids.filter(id => blocks.value.some(block => block.id === id))) }
  function constrainMove(ids: readonly string[], delta: Point): Point {
    const selected = blocks.value.filter(block => ids.includes(block.id))
    if (!selected.length) return { x: 0, y: 0 }
    return {
      x: Math.max(-Math.min(...selected.map(block => block.anchor.x)), Math.min(columns - Math.max(...selected.map(block => block.anchor.x + baseTenDimensions(block).width)), Math.round(delta.x))),
      y: Math.max(-Math.min(...selected.map(block => block.anchor.y)), Math.min(rows - Math.max(...selected.map(block => block.anchor.y + baseTenDimensions(block).depth)), Math.round(delta.y))),
    }
  }
  return { blocks: readonly(blocks), selection: readonly(selection), message: readonly(message), total, check, apply, select, constrainMove }
}
