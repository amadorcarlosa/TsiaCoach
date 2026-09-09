import { describe, expect, it } from 'vitest'
import type { RodDefinitionResponse } from '#shared/types/rods'
import { canPlaceRod } from '~/components/grid/rodGeometry'
import {placeDomainRod, readRodDefinition} from "~/components/rod/rod.scene.ts";


const response: RodDefinitionResponse = {
  length: '2',
  color: 'red',
  poses: [
    { orientation: 'horizontal', dimensions: { width: '2', depth: '1', height: '1' } },
    { orientation: 'vertical', dimensions: { width: '1', depth: '2', height: '1' } },
    { orientation: 'tower', dimensions: { width: '1', depth: '1', height: '2' } },
  ],
}

describe('domain rod scene adapter', () => {
  it('converts API string units before grid arithmetic', () => {
    const definition = readRodDefinition(response)
    const rod = placeDomainRod(definition, 10, 0)
    expect(rod.length).toBe(2)
    expect(rod.dimensions).toEqual({ width: 2, depth: 1, height: 1 })
    expect(canPlaceRod(rod, [], 12, 12)).toBe(true)
    expect(canPlaceRod({ ...rod, x: 11 }, [], 12, 12)).toBe(false)
  })

  it('uses each domain pose for orientation, rotation, and collision bounds', () => {
    const definition = readRodDefinition(response)
    const vertical = placeDomainRod(definition, 11, 11, 'vertical')
    expect(vertical).toMatchObject({ vertical: true, tower: false, rotation: 90 })
    expect(canPlaceRod(vertical, [], 12, 12)).toBe(false)
    const tower = placeDomainRod(definition, 11, 11, 'tower')
    expect(tower).toMatchObject({ vertical: false, tower: true, rotation: 0, dimensions: { width: 1, depth: 1, height: 2 } })
    expect(canPlaceRod(tower, [], 12, 12)).toBe(true)
    expect(placeDomainRod(definition, 0, 0, 'vertical', 270).rotation).toBe(270)
  })

  it('rejects unsupported lengths and invalid units', () => {
    expect(() => readRodDefinition({ ...response, length: 11 })).toThrow('Unsupported')
    expect(() => readRodDefinition({ ...response, length: 'invalid' })).toThrow('Invalid rod unit')
    expect(() => readRodDefinition({ ...response, poses: [
      { orientation: 'horizontal', dimensions: { width: 2, depth: 0, height: 1 } },
    ] })).toThrow('Invalid rod unit')
  })

  it('rejects a missing pose instead of inventing domain dimensions', () => {
    const definition = readRodDefinition({ ...response, poses: [] })
    expect(() => placeDomainRod(definition, 0, 0)).toThrow('no horizontal pose')
  })
})
