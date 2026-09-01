import { describe, expect, it } from 'vitest'
import { KeyboardDragStateMachine } from './keyboard-drag-state'

describe('KeyboardDragStateMachine', () => {
  it('picks up, cycles with wrapping, and drops the active zone', () => {
    const machine = new KeyboardDragStateMachine()
    machine.setZones(['zone-a', 'zone-b'])

    expect(machine.handle('pickup')).toEqual({ type: 'picked-up' })
    expect(machine.handle('next')).toEqual({ type: 'over-zone', zoneId: 'zone-a' })
    expect(machine.handle('next')).toEqual({ type: 'over-zone', zoneId: 'zone-b' })
    expect(machine.handle('next')).toEqual({ type: 'over-zone', zoneId: 'zone-a' })
    expect(machine.handle('previous')).toEqual({ type: 'over-zone', zoneId: 'zone-b' })
    expect(machine.handle('drop')).toEqual({ type: 'dropped', zoneId: 'zone-b' })
    expect(machine.isLifted).toBe(false)
  })

  it('cancels a lifted drag without emitting a drop event', () => {
    const machine = new KeyboardDragStateMachine()
    machine.setZones(['zone-a'])

    machine.handle('pickup')
    machine.handle('next')
    expect(machine.handle('cancel')).toBeNull()
    expect(machine.isLifted).toBe(false)
    expect(machine.handle('drop')).toBeNull()
  })

  it('resets state on drop when no accepting zone is active', () => {
    const machine = new KeyboardDragStateMachine()
    machine.setZones(['zone-a'])

    expect(machine.handle('pickup')).toEqual({ type: 'picked-up' })
    expect(machine.handle('drop')).toBeNull()
    expect(machine.isLifted).toBe(false)
    expect(machine.handle('next')).toBeNull()
    expect(machine.handle('pickup')).toEqual({ type: 'picked-up' })
  })
})
