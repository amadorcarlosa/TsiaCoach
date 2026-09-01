export type KeyboardDragAction = 'pickup' | 'next' | 'previous' | 'drop' | 'cancel'

export type KeyboardDragEvent =
  | { type: 'picked-up' }
  | { type: 'over-zone', zoneId: string }
  | { type: 'dropped', zoneId: string }

/** Pure keyboard drag state; visual effects and callbacks belong to the Vue composable. */
export class KeyboardDragStateMachine {
  private zoneIds: string[] = []
  private lifted = false
  private activeIndex = -1

  get isLifted() {
    return this.lifted
  }

  get activeZoneId(): string | null {
    return this.activeIndex >= 0 ? this.zoneIds[this.activeIndex] ?? null : null
  }

  setZones(zoneIds: string[]) {
    const previousZoneId = this.activeZoneId
    this.zoneIds = [...zoneIds]
    this.activeIndex = previousZoneId ? this.zoneIds.indexOf(previousZoneId) : -1
  }

  handle(action: KeyboardDragAction): KeyboardDragEvent | null {
    if (action === 'pickup') {
      if (this.lifted) {
        return null
      }
      this.lifted = true
      this.activeIndex = -1
      return { type: 'picked-up' }
    }

    if (action === 'cancel') {
      this.reset()
      return null
    }

    if (!this.lifted) {
      return null
    }

    if (action === 'next' || action === 'previous') {
      if (this.zoneIds.length === 0) {
        return null
      }

      const direction = action === 'next' ? 1 : -1
      this.activeIndex = (this.activeIndex + direction + this.zoneIds.length) % this.zoneIds.length
      return { type: 'over-zone', zoneId: this.zoneIds[this.activeIndex]! }
    }

    if (action === 'drop' && this.activeZoneId) {
      const zoneId = this.activeZoneId
      this.reset()
      return { type: 'dropped', zoneId }
    }

    if (action === 'drop') {
      this.reset()
      return null
    }

    return null
  }

  reset() {
    this.lifted = false
    this.activeIndex = -1
  }
}
