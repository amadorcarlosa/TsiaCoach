// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { computed, defineComponent, h, nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { useRodScene } from '~/composables/useRodScene'
import type { RodTrain, SceneAction } from '~/components/rod/scene/rod.scene.types'
import SystemsAreaSummaries from './SystemsAreaSummaries.vue'
import { evaluateSystem } from './systems.evaluate'
import { systemsFixtures } from './systems.fixtures'
import { systemsGeometry } from './systems.geometry'

enableAutoUnmount(afterEach)

const config = { ...systemsFixtures.development.config, staging: true }
const geometry = systemsGeometry(config)

function setup() {
  const scene = useRodScene({
    columns: geometry.columns,
    rows: geometry.rows,
    spawnRows: [geometry.staging!.y],
    regions: geometry.regions,
    editable: () => true,
    allowOrientation: true,
    regionBoundEdits: true,
  })
  const evaluation = computed(() => evaluateSystem(config, scene.trains.value))
  const wrapper = mount(defineComponent({
    setup: () => () => h(SystemsAreaSummaries, {
      config, evaluation: evaluation.value, cellSize: 24, paddingY: 16, scrollTop: 0,
    }),
  }))
  const summary = (id = 'equation-1') => wrapper.get(`[data-systems-area-summary="${id}"]`)
  async function apply(ids: readonly string[], action: SceneAction) {
    const result = scene.apply(ids, action)
    if (!result.allowed) throw new Error(result.reason)
    await nextTick()
    return result.createdIds
  }
  return { scene, wrapper, summary, apply }
}

describe('live equation area summaries', () => {
  it('updates independent totals for creation, cloning, movement, regrouping and deletion', async () => {
    const { summary, apply } = setup()
    expect(summary().text()).toContain('Total area: 0')
    const [rod] = await apply([], { type: 'create', value: 3, regionId: 'equation-1:x' })
    expect(summary().text()).toContain('x area: 3')
    expect(summary().text()).toContain('Total area: 3')
    expect(summary('equation-2').text()).toContain('Total area: 0')

    await apply([rod!], { type: 'clone' })
    expect(summary().text()).toContain('Total area: 6')
    const x = geometry.variableRegions[0]!
    const y = geometry.variableRegions[1]!
    await apply([rod!], { type: 'move', delta: { x: 0, y: y.y - x.y } })
    expect(summary().text()).toContain('x area: 3')
    expect(summary().text()).toContain('y area: 3')
    expect(summary().text()).toContain('Total area: 6')

    await apply([rod!], { type: 'regroup-ones' })
    expect(summary().text()).toContain('Total area: 6')
    await apply([rod!], { type: 'move', delta: { x: 0, y: geometry.staging!.y - y.y } })
    expect(summary().text()).toContain('y area: 0')
    expect(summary().text()).toContain('Total area: 3')
    await apply([rod!], { type: 'set-orientation', orientation: 'vertical' })
    expect(summary().text()).toContain('Total area: 3')
    await apply([rod!], { type: 'set-orientation', orientation: 'horizontal' })
    await apply([rod!], { type: 'move', delta: { x: 0, y: x.y - geometry.staging!.y } })
    expect(summary().text()).toContain('Total area: 6')
    await apply([rod!], { type: 'delete' })
    expect(summary().text()).toContain('Total area: 3')
  })

  it('shows 9 + 25 = 34, then 12 + 25 = 37 rather than the target area', async () => {
    const { apply, summary } = setup()
    for (let i = 0; i < 3; i++) await apply([], { type: 'create', value: 3, regionId: 'equation-1:x' })
    for (let i = 0; i < 5; i++) await apply([], { type: 'create', value: 5, regionId: 'equation-1:y' })
    expect(summary().text()).toContain('x area: 9')
    expect(summary().text()).toContain('y area: 25')
    expect(summary().text()).toContain('Total area: 34')

    await apply([], { type: 'create', value: 3, regionId: 'equation-1:x' })
    expect(summary().text()).toContain('x area: 12')
    expect(summary().text()).toContain('y area: 25')
    expect(summary().text()).toContain('Total area: 37')
    expect(summary('equation-2').text()).toContain('Total area: 0')
  })

  it('updates from replaced rod lengths and clears with the scene', async () => {
    const { scene, summary } = setup()
    const target = geometry.variableRegions[0]!
    const rod: RodTrain = {
      id: 'resized', anchor: { x: target.x, y: target.y },
      parts: [{ value: 3, orientation: 'horizontal', offset: { x: 0, y: 0 } }],
    }
    expect(scene.replace([rod]).allowed).toBe(true)
    await nextTick()
    expect(summary().text()).toContain('Total area: 3')
    rod.parts[0]!.value = 7
    expect(scene.replace([rod]).allowed).toBe(true)
    await nextTick()
    expect(summary().text()).toContain('Total area: 7')
    expect(scene.replace([]).allowed).toBe(true)
    await nextTick()
    expect(summary().text()).toContain('Total area: 0')
  })

  it('updates the second equation independently rather than displaying its target', async () => {
    const { apply, summary } = setup()
    await apply([], { type: 'create', value: 4, regionId: 'equation-2:x' })
    await apply([], { type: 'create', value: 7, regionId: 'equation-2:y' })
    expect(summary('equation-2').text()).toContain('x area: 4')
    expect(summary('equation-2').text()).toContain('y area: 7')
    expect(summary('equation-2').text()).toContain('Total area: 11')
    expect(summary().text()).toContain('Total area: 0')
  })

  it('reports boundary-crossing input explicitly instead of showing an expected or partial total', () => {
    const target = geometry.variableRegions[0]!
    const evaluation = evaluateSystem(config, [{
      id: 'partial', anchor: { x: target.x + target.width - 1, y: target.y },
      parts: [{ value: 3, orientation: 'horizontal', offset: { x: 0, y: 0 } }],
    }])
    const wrapper = mount(SystemsAreaSummaries, {
      props: { config, evaluation, cellSize: 24, paddingY: 16, scrollTop: 0 },
    })
    expect(wrapper.text()).toContain('A train lies outside every group.')
    expect(wrapper.text()).not.toContain('Total area:')
  })

  it('announces updates politely and follows band geometry, scroll and zoom', async () => {
    const wrapper = mount(SystemsAreaSummaries, {
      props: { config, evaluation: evaluateSystem(config, []), cellSize: 24, paddingY: 16, scrollTop: 0 },
    })
    expect(wrapper.get('[aria-live="polite"]').attributes('aria-atomic')).toBe('true')
    const second = wrapper.get('[data-systems-area-summary="equation-2"]')
    const start = geometry.variableRegions[2]!.y
    expect(second.attributes('style')).toContain(`top: ${17 + start * 24}px`)
    await wrapper.setProps({ scrollTop: 80, cellSize: 36 })
    expect(second.attributes('style')).toContain(`top: ${17 + start * 36 - 80}px`)
  })
})
