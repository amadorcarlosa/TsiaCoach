import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import type { Draggable } from 'gsap/Draggable'
import { closestZone, hitZone, snapPointForZone, type Rect, type ZoneRect } from '~/utils/drag-geometry'
import { KeyboardDragStateMachine, type KeyboardDragEvent } from './keyboard-drag-state'
import type { useDropZones } from './useDropZones'

type DropZones = ReturnType<typeof useDropZones>

export interface DraggablePieceOptions {
  pieceId: string
  el: Ref<HTMLElement | null>
  boardEl: Ref<HTMLElement | null>
  zones: DropZones
  onDropped: (zoneId: string) => void
  onRejected?: () => void
  onPickedUp?: () => void
  onCancelled?: () => void
  announce?: (message: string) => void
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function useDraggablePiece(options: DraggablePieceOptions) {
  const activeZoneId = ref<string | null>(null)
  const isKeyboardLifted = ref(false)
  const keyboard = new KeyboardDragStateMachine()

  let draggable: Draggable | null = null
  let context: gsap.Context | null = null
  let matchMedia: gsap.MatchMedia | null = null
  let reducedMotion = false
  let origin = { x: 0, y: 0 }
  let originBoardPosition = { x: 0, y: 0 }
  let pendingReleaseRect: Rect | null = null
  let dropResolved = false
  let pointerPickedUp = false
  let originalTouchAction = ''
  let originalTabIndex: number | null = null
  let originalRole: string | null = null

  function numeric(value: string | number): number {
    return typeof value === 'number' ? value : Number.parseFloat(value) || 0
  }

  function readPieceRect(): Rect | null {
    const piece = options.el.value
    const board = options.boardEl.value

    if (!piece || !board) {
      return null
    }

    const pieceRect = piece.getBoundingClientRect()
    const boardRect = board.getBoundingClientRect()
    return {
      x: pieceRect.left - boardRect.left,
      y: pieceRect.top - boardRect.top,
      width: pieceRect.width,
      height: pieceRect.height
    }
  }

  function acceptingZones(): ZoneRect[] {
    return options.zones.getAcceptingZones(options.pieceId)
  }

  function snapTarget() {
    const pieceRect = readPieceRect()
    const accepting = acceptingZones()

    if (!pieceRect || accepting.length === 0) {
      return null
    }

    const pieceCenter = {
      x: pieceRect.x + pieceRect.width / 2,
      y: pieceRect.y + pieceRect.height / 2
    }
    const nearest = closestZone(pieceCenter, accepting)
    const zone = nearest ? accepting.find(candidate => candidate.id === nearest.id) : undefined

    if (!zone || !nearest) {
      return null
    }

    // A throw only snaps while it is close enough to plausibly target this zone.
    const snapRadius = Math.hypot(
      (zone.width + pieceRect.width) / 2,
      (zone.height + pieceRect.height) / 2
    )

    if (nearest.distance > snapRadius) {
      return null
    }

    const point = snapPointForZone(zone, pieceRect)
    return {
      x: point.x - originBoardPosition.x,
      y: point.y - originBoardPosition.y
    }
  }

  function snapCoordinate(axis: 'x' | 'y', value: number): number {
    return snapTarget()?.[axis] ?? origin[axis]
  }

  function animateToOrigin(onComplete?: () => void) {
    const piece = options.el.value
    const gsap = useNuxtApp().$gsap

    if (!piece) {
      onComplete?.()
      return
    }

    gsap.to(piece, {
      x: origin.x,
      y: origin.y,
      scale: 1,
      boxShadow: '0 8px 22px rgba(15, 23, 42, 0.14)',
      duration: reducedMotion ? 0 : 0.3,
      ease: 'power2.out',
      onComplete
    })
  }

  function animateLifted(lifted: boolean, onComplete?: () => void) {
    const piece = options.el.value
    const gsap = useNuxtApp().$gsap

    if (!piece) {
      onComplete?.()
      return
    }

    gsap.to(piece, {
      scale: lifted ? 1.06 : 1,
      boxShadow: lifted
        ? '0 18px 32px rgba(15, 23, 42, 0.22)'
        : '0 8px 22px rgba(15, 23, 42, 0.14)',
      duration: reducedMotion ? 0 : 0.15,
      ease: 'power2.out',
      onComplete
    })
  }

  function animateToZone(zoneId: string, onComplete?: () => void) {
    const piece = options.el.value
    const zone = options.zones.getZone(zoneId)
    const pieceRect = readPieceRect()
    const gsap = useNuxtApp().$gsap

    if (!piece || !zone || !pieceRect) {
      onComplete?.()
      return
    }

    const point = snapPointForZone(zone, pieceRect)
    gsap.to(piece, {
      x: point.x - originBoardPosition.x,
      y: point.y - originBoardPosition.y,
      scale: 1,
      boxShadow: '0 8px 22px rgba(15, 23, 42, 0.14)',
      duration: reducedMotion ? 0 : 0.2,
      ease: 'power2.out',
      onComplete
    })
  }

  function resolvePointerDrop(pieceRect: Rect | null) {
    if (dropResolved) {
      return
    }
    dropResolved = true
    activeZoneId.value = null

    const zoneId = pieceRect ? hitZone(pieceRect, acceptingZones(), 0.5) : null

    if (zoneId) {
      options.onDropped(zoneId)
      options.announce?.(`dropped in ${zoneId}`)
      return
    }

    animateToOrigin(() => {
      options.onRejected?.()
      options.announce?.('rejected')
    })
  }

  function announcePointerPickup() {
    if (pointerPickedUp) {
      return
    }

    pointerPickedUp = true
    dropResolved = false
    pendingReleaseRect = null
    activeZoneId.value = null
    options.onPickedUp?.()
    options.announce?.(`picked up ${options.pieceId}`)
  }

  function handleKeyboardEvent(event: KeyboardDragEvent) {
    if (event.type === 'picked-up') {
      isKeyboardLifted.value = true
      activeZoneId.value = null
      animateLifted(true)
      options.onPickedUp?.()
      options.announce?.(`picked up ${options.pieceId}`)
    } else if (event.type === 'over-zone') {
      activeZoneId.value = event.zoneId
      animateToZone(event.zoneId)
      options.announce?.(`over zone ${event.zoneId}`)
    } else if (event.type === 'dropped') {
      isKeyboardLifted.value = false
      activeZoneId.value = null
      animateToZone(event.zoneId, () => {
        options.onDropped(event.zoneId)
        options.announce?.(`dropped in ${event.zoneId}`)
      })
    }
  }

  function handleKeyboard(event: KeyboardEvent) {
    const key = event.key
    const isActivation = key === 'Enter' || key === ' ' || key === 'Spacebar'

    if (isActivation) {
      event.preventDefault()
      keyboard.setZones(acceptingZones().map(zone => zone.id))

      if (!keyboard.isLifted) {
        handleKeyboardEvent(keyboard.handle('pickup')!)
      } else {
        const dropEvent = keyboard.handle('drop')

        if (dropEvent) {
          handleKeyboardEvent(dropEvent)
        } else {
          isKeyboardLifted.value = false
          activeZoneId.value = null
          animateToOrigin(() => {
            options.onRejected?.()
            options.announce?.('rejected')
          })
        }
      }
      return
    }

    if (key === 'Escape' && keyboard.isLifted) {
      event.preventDefault()
      keyboard.handle('cancel')
      isKeyboardLifted.value = false
      activeZoneId.value = null
      animateToOrigin()
      options.onCancelled?.()
      options.announce?.('cancelled')
      return
    }

    if (keyboard.isLifted && (key === 'ArrowRight' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowUp')) {
      event.preventDefault()
      keyboard.setZones(acceptingZones().map(zone => zone.id))
      const action = key === 'ArrowRight' || key === 'ArrowDown' ? 'next' : 'previous'
      const cycleEvent = keyboard.handle(action)

      if (cycleEvent) {
        handleKeyboardEvent(cycleEvent)
      }
    }
  }

  onMounted(() => {
    const piece = options.el.value
    const board = options.boardEl.value
    const nuxtApp = useNuxtApp()

    if (!piece || !board) {
      return
    }

    originalTouchAction = piece.style.touchAction
    originalTabIndex = piece.getAttribute('tabindex') === null ? null : piece.tabIndex
    originalRole = piece.getAttribute('role')
    piece.style.touchAction = 'none'
    if (originalTabIndex === null) {
      piece.tabIndex = 0
    }
    if (originalRole === null) {
      piece.setAttribute('role', 'button')
    }
    piece.addEventListener('keydown', handleKeyboard)

    origin = {
      x: numeric(nuxtApp.$gsap.getProperty(piece, 'x')),
      y: numeric(nuxtApp.$gsap.getProperty(piece, 'y'))
    }
    const initialRect = readPieceRect()
    if (initialRect) {
      originBoardPosition = {
        x: initialRect.x - origin.x,
        y: initialRect.y - origin.y
      }
    }

    context = nuxtApp.$gsap.context(() => {
      matchMedia = nuxtApp.$gsap.matchMedia()
      matchMedia.add({ reduceMotion: REDUCED_MOTION_QUERY }, (mediaContext) => {
        reducedMotion = Boolean(mediaContext.conditions?.reduceMotion)
      })

      draggable = nuxtApp.$Draggable.create(piece, {
        type: 'x,y',
        bounds: board,
        inertia: !reducedMotion,
        edgeResistance: 0.85,
        snap: {
          x: value => snapCoordinate('x', value),
          y: value => snapCoordinate('y', value)
        },
        onPress: () => {
          announcePointerPickup()
        },
        onDragStart: () => {
          announcePointerPickup()
        },
        onDragEnd: function (this: Draggable) {
          pendingReleaseRect = readPieceRect()

          if (!this.isThrowing) {
            resolvePointerDrop(pendingReleaseRect)
            pendingReleaseRect = null
            pointerPickedUp = false
          }
        },
        onThrowComplete: () => {
          resolvePointerDrop(pendingReleaseRect ?? readPieceRect())
          pendingReleaseRect = null
          pointerPickedUp = false
        }
      })[0] ?? null
    }, piece)
  })

  onBeforeUnmount(() => {
    options.el.value?.removeEventListener('keydown', handleKeyboard)
    matchMedia?.revert()
    context?.revert()
    draggable?.kill()
    draggable = null

    const piece = options.el.value
    if (piece) {
      piece.style.touchAction = originalTouchAction
      if (originalTabIndex === null) {
        piece.removeAttribute('tabindex')
      } else {
        piece.tabIndex = originalTabIndex
      }
      if (originalRole === null) {
        piece.removeAttribute('role')
      } else {
        piece.setAttribute('role', originalRole)
      }
    }
  })

  return {
    activeZoneId,
    isKeyboardLifted
  }
}
