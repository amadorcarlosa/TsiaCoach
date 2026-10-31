import { screenDeltaToGrid, type Point } from './gridPointer'

/** Measure the actual projected cell axes, including zoom and ancestor scrolling. */
export function measureGridFrame(world: Element) {
  const read = (name: string) => world.querySelector(`[data-grid-axis="${name}"]`)?.getBoundingClientRect()
  const origin = read('origin')
  const x = read('x')
  const y = read('y')
  if (!origin || !x || !y) return null
  return {
    origin: { x: origin.left, y: origin.top },
    axisX: { x: x.left - origin.left, y: x.top - origin.top },
    axisY: { x: y.left - origin.left, y: y.top - origin.top },
  }
}
type GridFrame = NonNullable<ReturnType<typeof measureGridFrame>>
export function clientPointToGrid(point: Point, frame: GridFrame): Point | null {
  return screenDeltaToGrid({ x: point.x - frame.origin.x, y: point.y - frame.origin.y }, frame.axisX, frame.axisY)
}
export function gridPointToClient(point: Point, frame: GridFrame): Point {
  return {
    x: frame.origin.x + point.x * frame.axisX.x + point.y * frame.axisY.x,
    y: frame.origin.y + point.x * frame.axisX.y + point.y * frame.axisY.y,
  }
}
