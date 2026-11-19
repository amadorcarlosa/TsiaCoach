import { Effect, Exit, Scope } from 'effect'

/** A synchronous Effect scope for resources whose release must precede DOM removal. */
export function createResourceScope() {
  const scope = Scope.makeUnsafe()
  let closed = false

  function defer(release: () => void): void {
    if (closed) {
      release()
      return
    }
    Effect.runSync(Scope.addFinalizer(scope, Effect.sync(release)))
  }

  function acquire<A>(create: () => A, release: (resource: A) => void): A {
    if (closed) throw new Error('Cannot acquire a resource after its scope is closed.')
    return Effect.runSync(Effect.acquireRelease(
      Effect.sync(create),
      value => Effect.sync(() => release(value)),
    ).pipe(Scope.provide(scope)))
  }

  function listen<E extends Event>(
    target: EventTarget,
    type: string,
    listener: (event: E) => void,
    options?: AddEventListenerOptions | boolean,
  ): void {
    const handler = listener as EventListener
    acquire(
      () => { target.addEventListener(type, handler, options); return handler },
      handler => target.removeEventListener(type, handler, options),
    )
  }

  /** One timer slot per resource: repeated scheduling never accumulates finalizers. */
  function timer() {
    let handle: ReturnType<typeof setTimeout> | undefined
    const clear = () => { clearTimeout(handle); handle = undefined }
    defer(clear)
    return {
      clear,
      schedule(callback: () => void, milliseconds: number) {
        clear()
        if (closed) return
        handle = setTimeout(() => { handle = undefined; if (!closed) callback() }, milliseconds)
      },
    }
  }

  function close(): void {
    if (closed) return
    closed = true
    Effect.runSync(Scope.close(scope, Exit.succeed(undefined)))
  }

  return { acquire, defer, listen, timer, close, get closed() { return closed } }
}

export type ResourceScope = ReturnType<typeof createResourceScope>
