// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, Teleport } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import SceneMenu from './SceneMenu.vue'

enableAutoUnmount(afterEach)

const dropdownStub = defineComponent({
  inheritAttrs: false,
  setup: () => () => h(Teleport, { to: 'body' }, [
    h('div', { role: 'menu', 'data-testid': 'menu' }, [
      h('div', { 'data-testid': 'menu-scroll' }),
    ]),
    h('div', { role: 'menu', 'data-testid': 'submenu' }, [
      h('div', { 'data-testid': 'submenu-scroll' }),
    ]),
  ]),
})

function setup() {
  return mount(SceneMenu, {
    props: {
      request: {
        trainId: 'train-1',
        anchor: { x: 100, y: 100, width: 40, height: 20 },
      },
      selection: ['train-1'],
      choices: [],
      check: () => ({ allowed: true }),
    },
    global: { stubs: { UDropdownMenu: dropdownStub } },
  })
}

describe('scene menu viewport changes', () => {
  it.each(['menu', 'menu-scroll', 'submenu', 'submenu-scroll'])(
    'keeps the menu open when %s scrolls',
    testId => {
      const wrapper = setup()
      const target = document.querySelector(`[data-testid="${testId}"]`)!

      target.dispatchEvent(new Event('scroll', { bubbles: false }))

      expect(wrapper.emitted('close')).toBeUndefined()
    },
  )

  it('closes when an external nested container scrolls', () => {
    const wrapper = setup()
    const container = document.createElement('div')
    document.body.append(container)

    try {
      container.dispatchEvent(new Event('scroll', { bubbles: false }))
      expect(wrapper.emitted('close')).toHaveLength(1)
    } finally {
      container.remove()
    }
  })

  it.each(['scroll', 'resize'])('closes on window %s', eventType => {
    const wrapper = setup()

    window.dispatchEvent(new Event(eventType))

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('does not emit close when no menu is open', async () => {
    const wrapper = setup()
    await wrapper.setProps({ request: null })

    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))

    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('removes viewport listeners when unmounted', () => {
    const wrapper = setup()
    wrapper.unmount()

    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))

    expect(wrapper.emitted('close')).toBeUndefined()
  })
})
