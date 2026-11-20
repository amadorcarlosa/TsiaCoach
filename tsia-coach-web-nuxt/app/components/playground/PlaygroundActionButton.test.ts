// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PlaygroundActionButton from './PlaygroundActionButton.vue'

describe('playground action button', () => {
  it('looks unavailable when refused but still clicks, so the board can explain why', async () => {
    const wrapper = mount(PlaygroundActionButton, { props: { refused: true }, slots: { default: 'horizontal' } })
    const button = wrapper.get('button')

    expect(button.attributes('aria-disabled')).toBe('true')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('stays truly disabled when the board is not editable', () => {
    const wrapper = mount(PlaygroundActionButton, { props: { disabled: true } })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button').attributes('aria-disabled')).toBeUndefined()
  })
})
