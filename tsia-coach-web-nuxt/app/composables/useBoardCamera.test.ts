// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { describe, it, expect, vi } from 'vitest'
import { useBoardCamera } from './useBoardCamera'

describe('board camera lifecycle', () => {
  it('clamps zoom, keeps board coordinates centered and cancels gestures before view changes', async () => {
    const viewport = document.createElement('div')
    const world = document.createElement('div')
    world.setAttribute('data-grid-world', '')
    viewport.append(world)
    Object.defineProperties(viewport, { clientWidth: { value: 400 }, clientHeight: { value: 300 } })
    viewport.scrollLeft = 200
    viewport.scrollTop = 100
    let camera!: ReturnType<typeof useBoardCamera>
    for (const name of ['origin', 'x', 'y']) {
      const marker = document.createElement('i')
      marker.dataset.gridAxis = name
      marker.getBoundingClientRect = () => ({ left: (name === 'x' ? camera.cellSize.value : 0) - viewport.scrollLeft, top: (name === 'y' ? camera.cellSize.value : 0) - viewport.scrollTop }) as DOMRect
      world.append(marker)
    }
    const beforeChange = vi.fn()
    const disabled = ref(false)
    const wrapper = mount(defineComponent({ setup() {
      camera = useBoardCamera({ viewport: ref(viewport), baseCellSize: () => 20, disabled: () => disabled.value, beforeChange })
      return () => null
    } }))
    await camera.setZoom(2)
    expect(camera.cellSize.value).toBe(40)
    expect([viewport.scrollLeft, viewport.scrollTop]).toEqual([600, 350])
    expect(beforeChange).toHaveBeenCalledOnce()
    await camera.setZoom(99)
    expect(camera.zoom.value).toBe(2)
    await camera.setZoom(-5)
    expect(camera.zoom.value).toBe(0.25)
    disabled.value = true
    await camera.setZoom(1)
    camera.togglePan()
    expect(camera.zoom.value).toBe(0.25)
    expect(camera.panMode.value).toBe(false)
    wrapper.unmount()
  })
})
