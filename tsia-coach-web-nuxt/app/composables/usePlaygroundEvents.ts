import { hasInjectionContext, inject, provide, ref, type InjectionKey, type Ref } from 'vue'
import type { StartPlaygroundSession } from '#shared/effect/playground-events'
import { playgroundEventLogFor, type PlaygroundRecorder } from '~/effect/playground-events'
import { readStoredText, writeStoredText } from '~/effect/browser-io'
import { workflowContextKey, workflowFeature, type WorkflowContext } from '~/effect/registry'
import { recordPlaygroundScene, type AlgebraTileSceneLike, type BaseTenSceneLike, type RodPlaygroundName, type RodSceneLike, type SceneEvents } from '~/components/playground/events/scene-events'

type Links = Omit<StartPlaygroundSession, 'playground' | 'consent'>

const linksKey: InjectionKey<Links> = Symbol('playground-event-links')
const CONSENT_KEY = 'tsia:playground-events-consent'
const linkPattern = /^[A-Za-z0-9_.:-]{1,128}$/

/**
 * Ties every playground recorder below this component to learner state, such
 * as the attempt a student is working on. The coach reads that attempt's
 * activity on the server. Malformed links are dropped, never sent.
 */
export function providePlaygroundLinks(links: Partial<Record<keyof Links, string | null | undefined>>): void {
  const clean: { -readonly [K in keyof Links]: Links[K] } = {}
  for (const [key, value] of Object.entries(links) as [keyof Links, string | null | undefined][]) {
    if (value && linkPattern.test(value)) clean[key] = value
  }
  provide(linksKey, clean)
}

export type PlaygroundConsentChoice = 'granted' | 'declined'

/** One per Nuxt app; the choice is kept in this browser. */
export type PlaygroundConsent = {
  /** Whether this deployment asks before recording. */
  readonly required: boolean
  readonly choice: Readonly<Ref<PlaygroundConsentChoice | null>>
  allowed(): boolean
  choose(choice: PlaygroundConsentChoice): void
}

function createConsent(required: boolean): PlaygroundConsent {
  const stored = import.meta.client ? readStoredText(CONSENT_KEY) : null
  const choice = ref<PlaygroundConsentChoice | null>(stored === 'granted' || stored === 'declined' ? stored : null)
  return {
    required,
    choice,
    allowed: () => !required || choice.value === 'granted',
    choose(next) {
      choice.value = next
      writeStoredText(CONSENT_KEY, next)
    },
  }
}

function settings() {
  const config = useRuntimeConfig().public
  return {
    enabled: config.playgroundEventsEnabled === true,
    consentRequired: config.playgroundEventsConsent !== 'not-required',
  }
}

function workflowContext(): WorkflowContext | null {
  return hasInjectionContext() ? inject(workflowContextKey, null) : null
}

/** The consent state, or null when the action log is off. */
export function usePlaygroundConsent(): PlaygroundConsent | null {
  const context = workflowContext()
  if (!context) return null
  const { enabled, consentRequired } = settings()
  if (!enabled) return null
  return workflowFeature(context, 'playground-events-consent', () => createConsent(consentRequired))
}

/** What playground workflows need from the log: consent-aware recorders and an early send. */
export type PlaygroundEventSink = {
  recorder(input: StartPlaygroundSession): PlaygroundRecorder
  flush(timeoutMillis?: number): Promise<void>
}

/**
 * The app's action log behind the consent gate, or null when the log is off,
 * during SSR, or outside a Nuxt app. A recorder opens its server session on
 * its first event after consent, so nothing leaves the browser before then,
 * and it stops recording if consent is withdrawn.
 */
export function usePlaygroundEventLog(): PlaygroundEventSink | null {
  const context = workflowContext()
  const consent = usePlaygroundConsent()
  const log = context && consent ? playgroundEventLogFor(context, true) : null
  if (!log || !consent) return null
  return gateRecorders(log, consent)
}

/** Exported for tests: wraps a log so recorders honour consent and open sessions lazily. */
export function gateRecorders(
  log: { recorder(input: StartPlaygroundSession): PlaygroundRecorder; flush(timeoutMillis?: number): Promise<void> },
  consent: Pick<PlaygroundConsent, 'required' | 'allowed'>,
): PlaygroundEventSink {
  return {
    recorder(input) {
      let session: PlaygroundRecorder | undefined
      return {
        playground: input.playground,
        record(draft) {
          if (!consent.allowed()) return
          session ??= log.recorder({ ...input, ...(consent.required ? { consent: 'granted' as const } : {}) })
          session.record(draft)
        },
      }
    },
    flush: timeoutMillis => log.flush(timeoutMillis),
  }
}

/**
 * A recorder for one playground instance, linked to whatever the page
 * provided (see `providePlaygroundLinks`), or null when the log is off.
 */
export function usePlaygroundRecorder(playground: StartPlaygroundSession['playground'], links: Links = {}): PlaygroundRecorder | null {
  const provided = hasInjectionContext() ? inject(linksKey, {}) : {}
  return usePlaygroundEventLog()?.recorder({ playground, ...provided, ...links }) ?? null
}

/**
 * One line per playground: `const scene = instrumentScene(useXScene(...), 'x')`.
 * The returned scene records every committed or refused `apply`, including
 * drags, which settle through `apply`. Its `events` handle records anything
 * else and keeps the recent actions for board captures, even when the log is off.
 */
export function instrumentScene<S extends AlgebraTileSceneLike>(scene: S, playground: 'algebra-tiles', links?: Links): S & { events: SceneEvents }
export function instrumentScene<S extends BaseTenSceneLike>(scene: S, playground: 'base-ten', links?: Links): S & { events: SceneEvents }
export function instrumentScene<S extends RodSceneLike>(scene: S, playground: RodPlaygroundName, links?: Links): S & { events: SceneEvents }
export function instrumentScene(scene: unknown, playground: StartPlaygroundSession['playground'], links: Links = {}): unknown {
  return recordPlaygroundScene(scene as never, playground as never, usePlaygroundRecorder(playground, links))
}
