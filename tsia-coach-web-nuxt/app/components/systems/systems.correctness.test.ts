// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import type { RodTrain, TrainPart } from '~/components/rod/scene/rod.scene.types'
import { equationCorrectness } from './systems.feedback'
import { systemsFixtures } from './systems.fixtures'
import { systemsGeometry } from './systems.geometry'
import { evaluateSystem } from './systems.evaluate'
import { substituteSystem } from './systems.substitution'
import SystemsAreaSummaries from './SystemsAreaSummaries.vue'

enableAutoUnmount(afterEach)
const config = systemsFixtures.development.config
const regions = systemsGeometry(config).variableRegions
function rows(index: number, value: TrainPart['value']): RodTrain[] {
  const region = regions[index]!
  return Array.from({ length: region.depth }, (_, row) => ({
    id: `${index}-${row}`, anchor: { x: region.x, y: region.y + row },
    parts: [{ value, orientation: 'horizontal', offset: { x: 0, y: 0 } }],
  }))
}

describe('independent equation correctness', () => {
  it('marks x=8,y=2 green for equation 1 and red for equation 2 including propagated rows', async () => {
    const sources = [...rows(0, 8), ...rows(1, 2)]
    const evaluation = substituteSystem(config, sources).evaluation
    expect(evaluation.valid && evaluation.equations.map(equationCorrectness)).toEqual(['correct', 'incorrect'])
    const wrapper = mount(SystemsAreaSummaries, {
      props: { config, evaluation, cellSize: 24, paddingY: 16, scrollTop: 0 },
    })
    const first = wrapper.get('[data-systems-area-summary="equation-1"]')
    const second = wrapper.get('[data-systems-area-summary="equation-2"]')
    expect(first.attributes('data-correctness')).toBe('correct')
    expect(first.text()).toContain('Total area: 34')
    expect(first.text()).toContain('Correct')
    expect(second.attributes('data-correctness')).toBe('incorrect')
    expect(second.text()).toContain('Total area: 36')
    expect(second.text()).toContain('Expected area: 22')

    await wrapper.setProps({ evaluation: substituteSystem(config, [...rows(0, 3), ...rows(1, 5)]).evaluation })
    expect(second.attributes('data-correctness')).toBe('correct')
    expect(second.text()).toContain('Total area: 22')
    await wrapper.setProps({ evaluation: substituteSystem(config, rows(0, 3)).evaluation })
    expect(first.attributes('data-correctness')).toBe('neutral')
    expect(second.attributes('data-correctness')).toBe('neutral')
    expect(second.text()).toContain('Incomplete')
  })

  it('keeps incomplete shapes neutral even when their occupied area matches the target', () => {
    const snapshot = [...rows(0, 8), ...rows(1, 2)]
    snapshot[0]!.anchor.x++
    const evaluation = evaluateSystem(config, snapshot)
    if (!evaluation.valid) throw new Error(evaluation.reason)
    expect(evaluation.equations[0].areaMatches).toBe(true)
    expect(equationCorrectness(evaluation.equations[0])).toBe('neutral')
    expect(equationCorrectness(undefined)).toBe('neutral')
  })
})
