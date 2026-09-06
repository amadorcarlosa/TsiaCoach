import type { components } from '#server/types/schema'

export type RodDefinitionResponse =
    components['schemas']['RodDefinitionResponse']

export type RodOrientation =
    components['schemas']['RodOrientation']

export type RodColor =
    components['schemas']['RodColor']

export type UnitDimensions = {
    width: number
    depth: number
    height: number
}
