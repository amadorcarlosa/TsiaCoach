import { Cause, Exit } from 'effect'

/** Promise boundaries preserve typed failures instead of exposing FiberFailure wrappers. */
export function unwrapExit<A, E>(exit: Exit.Exit<A, E>): A {
  if (Exit.isSuccess(exit)) return exit.value
  if (Cause.hasInterruptsOnly(exit.cause)) throw new DOMException('The operation was cancelled.', 'AbortError')
  throw Cause.squash(exit.cause)
}
