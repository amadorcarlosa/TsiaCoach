import { describe, expect, it, vi } from 'vitest'
import { createResourceScope } from './scoped-resource'

describe('component Effect resource scopes', () => {
  it('releases listeners once and releases acquired resources in reverse order', () => {
    const scope = createResourceScope()
    const target = new EventTarget()
    const listener = vi.fn()
    const released: string[] = []
    scope.listen(target, 'change', listener)
    scope.acquire(() => 'first', value => released.push(value))
    scope.acquire(() => 'second', value => released.push(value))
    target.dispatchEvent(new Event('change'))
    scope.close()
    scope.close()
    target.dispatchEvent(new Event('change'))
    expect(listener).toHaveBeenCalledOnce()
    expect(released).toEqual(['second', 'first'])
  })

  it('cancels superseded timers and pending work on unmount', () => {
    vi.useFakeTimers()
    try {
      const scope = createResourceScope()
      const timer = scope.timer()
      const callback = vi.fn()
      timer.schedule(callback, 550)
      timer.schedule(callback, 550)
      vi.advanceTimersByTime(550)
      expect(callback).toHaveBeenCalledOnce()
      timer.schedule(callback, 550)
      scope.close()
      vi.runAllTimers()
      expect(callback).toHaveBeenCalledOnce()
    } finally { vi.useRealTimers() }
  })
})
