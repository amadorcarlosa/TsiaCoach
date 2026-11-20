import { describe, expect, it } from 'vitest'
import { createSessionRateLimiter, playgroundEventPolicy } from './playground-events'

const allowed = { enabled: true, origin: 'http://app', requestOrigin: 'http://app', contentType: 'application/json; charset=utf-8' }

describe('playground event policy', () => {
  it('stays closed unless the action log is enabled', () => {
    expect(playgroundEventPolicy({ ...allowed, enabled: false }).status).toBe(404)
  })

  it('accepts only same-origin JSON', () => {
    expect(playgroundEventPolicy(allowed).status).toBe(200)
    expect(playgroundEventPolicy({ ...allowed, origin: 'http://elsewhere' }).status).toBe(403)
    expect(playgroundEventPolicy({ ...allowed, origin: undefined }).status).toBe(403)
    expect(playgroundEventPolicy({ ...allowed, contentType: 'text/plain' }).status).toBe(415)
  })
})

describe('session rate limiter', () => {
  it('limits events per session per window', () => {
    let time = 0
    const limiter = createSessionRateLimiter({ limit: 5, windowMillis: 1000, maxSessions: 10, now: () => time })

    expect(limiter.take('a', 4)).toBe(true)
    expect(limiter.take('a', 2)).toBe(false)
    expect(limiter.take('b', 5)).toBe(true)
    time = 1000
    expect(limiter.take('a', 5)).toBe(true)
  })

  it('evicts the oldest session instead of growing without bound', () => {
    const limiter = createSessionRateLimiter({ limit: 1, windowMillis: 60_000, maxSessions: 2, now: () => 0 })
    expect(limiter.take('a', 1)).toBe(true)
    expect(limiter.take('b', 1)).toBe(true)
    expect(limiter.take('c', 1)).toBe(true)
    // "a" was evicted, so its budget starts over.
    expect(limiter.take('a', 1)).toBe(true)
    expect(limiter.take('c', 1)).toBe(false)
  })
})
