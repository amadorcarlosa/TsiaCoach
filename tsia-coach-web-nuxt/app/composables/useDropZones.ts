import { computed, getCurrentScope, onBeforeUnmount, onMounted, onScopeDispose, ref, type Ref } from 'vue'
import type { ZoneRect } from '~/utils/drag-geometry'

export interface DropZoneOptions {
  accepts?: (pieceId: string) => boolean
}

interface ZoneRegistration {
  id: string
  el: Ref<HTMLElement | null>
  accepts: (pieceId: string) => boolean
}

export function useDropZones(boardEl: Ref<HTMLElement | null>) {
  const registrations = new Map<string, ZoneRegistration>()
  const zoneRects = ref<ZoneRect[]>([])
  let resizeObserver: ResizeObserver | null = null

  function measure() {
    const board = boardEl.value

    if (!board) {
      zoneRects.value = []
      return
    }

    const boardRect = board.getBoundingClientRect()
    zoneRects.value = Array.from(registrations.values()).flatMap((registration) => {
      const element = registration.el.value

      if (!element) {
        return []
      }

      const rect = element.getBoundingClientRect()
      return [{
        id: registration.id,
        x: rect.left - boardRect.left,
        y: rect.top - boardRect.top,
        width: rect.width,
        height: rect.height
      }]
    })
  }

  function observeRegisteredElements() {
    if (!resizeObserver) {
      return
    }

    if (boardEl.value) {
      resizeObserver.observe(boardEl.value)
    }

    for (const registration of registrations.values()) {
      if (registration.el.value) {
        resizeObserver.observe(registration.el.value)
      }
    }
  }

  function registerZone(id: string, el: Ref<HTMLElement | null>, opts: DropZoneOptions = {}) {
    unregisterZone(id)

    const registration: ZoneRegistration = {
      id,
      el,
      accepts: opts.accepts ?? (() => true)
    }
    registrations.set(id, registration)

    if (getCurrentScope()) {
      onScopeDispose(() => {
        if (registrations.get(id) === registration) {
          unregisterZone(id)
        }
      })
    }

    if (resizeObserver && el.value) {
      resizeObserver.observe(el.value)
      measure()
    }
  }

  function unregisterZone(id: string) {
    const registration = registrations.get(id)

    if (!registration) {
      return
    }

    if (resizeObserver && registration.el.value) {
      resizeObserver.unobserve(registration.el.value)
    }
    registrations.delete(id)
    zoneRects.value = zoneRects.value.filter(zone => zone.id !== id)
  }

  function getAcceptingZones(pieceId: string): ZoneRect[] {
    return zoneRects.value.filter((zone) => registrations.get(zone.id)?.accepts(pieceId) ?? false)
  }

  function accepts(zoneId: string, pieceId: string): boolean {
    return registrations.get(zoneId)?.accepts(pieceId) ?? false
  }

  function getZone(zoneId: string): ZoneRect | undefined {
    return zoneRects.value.find(zone => zone.id === zoneId)
  }

  onMounted(() => {
    measure()

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => measure())
      observeRegisteredElements()
    }
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
    registrations.clear()
    zoneRects.value = []
  })

  return {
    registerZone,
    unregisterZone,
    measure,
    zoneRects: computed(() => zoneRects.value),
    zones: computed(() => zoneRects.value),
    getAcceptingZones,
    accepts,
    getZone
  }
}
