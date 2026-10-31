// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { useAlgebraTileScene, type AlgebraTileAction } from './useAlgebraTileScene'
import { useManipulativeInteraction } from './useManipulativeInteraction'
import { algebraTileDimensions, type AlgebraTile } from '~/components/algebratiles/algebra-tile.types'

enableAutoUnmount(afterEach)

/** The interaction needs a component instance (provide/onBeforeUnmount). */
function setup() {
  const disabled = ref(false)
  const version = ref(0)
  const scene = useAlgebraTileScene({ editable: () => true, columns: 24, rows: 12 })
  let interaction!: ReturnType<typeof useManipulativeInteraction<AlgebraTile, AlgebraTileAction>>

  mount(defineComponent({
    setup() {
      interaction = useManipulativeInteraction<AlgebraTile, AlgebraTileAction>({
        scene: { ...scene, pieces: () => scene.tiles.value },
        footprint: algebraTileDimensions,
        bounds: () => ({ columns: 24, rows: 12 }),
        idAttribute: 'data-algebra-tile-id',
        viewport: ref(null),
        disabled: () => disabled.value,
        cancelVersion: () => version.value,
      })
      return () => h('div')
    },
  }))

  const create = () => {
    expect(scene.apply([], { type: 'create', term: 'one', sign: 'positive' }).allowed).toBe(true)
    return scene.tiles.value.at(-1)!.id
  }
  const anchor = (id: string) => scene.tiles.value.find(tile => tile.id === id)!.anchor

  return { scene, interaction, disabled, version, create, anchor }
}

describe('manipulative interaction', () => {
  it('replaces, toggles and preserves a selection', () => {
    const { scene, interaction, create } = setup()
    const a = create(), b = create()

    interaction.select(a, 'replace')
    expect([...scene.selection.value]).toEqual([a])
    interaction.select(b, 'toggle')
    expect([...scene.selection.value]).toEqual([a, b])
    // Preserve keeps a multi-selection when the piece is already in it.
    interaction.select(a, 'preserve')
    expect([...scene.selection.value]).toEqual([a, b])
    interaction.select(a, 'toggle')
    expect([...scene.selection.value]).toEqual([b])
  })

  it('drags the whole selection together and previews the followers', () => {
    const { scene, interaction, create, anchor } = setup()
    const a = create(), b = create()
    const startA = { ...anchor(a) }, startB = { ...anchor(b) }
    scene.select([a, b])

    expect(interaction.beginMove(a)).toBe(true)
    interaction.preview(a, { x: startA.x, y: startA.y + 2 })
    expect(interaction.previewFor(b)).toEqual({ x: 0, y: 2 })
    // The dragged piece draws its own position; only followers get the offset.
    expect(interaction.previewFor(a)).toBeUndefined()

    interaction.settle(a, { x: startA.x, y: startA.y + 2 })
    interaction.end(a)

    expect(anchor(a)).toEqual({ x: startA.x, y: startA.y + 2 })
    expect(anchor(b)).toEqual({ x: startB.x, y: startB.y + 2 })
    expect(interaction.previewFor(b)).toBeUndefined()
  })

  it('ignores a settle once the scene changed under the drag', () => {
    const { scene, interaction, create, anchor } = setup()
    const a = create()
    const start = { ...anchor(a) }

    expect(interaction.beginMove(a)).toBe(true)
    create() // Any scene change replaces the source the drag started from.
    interaction.settle(a, { x: start.x, y: start.y + 3 })

    expect(anchor(a)).toEqual(start)
    expect(scene.tiles.value).toHaveLength(2)
  })

  it('clamps a drag to what the scene allows', () => {
    const { interaction, create, anchor } = setup()
    const a = create()
    const start = { ...anchor(a) }

    interaction.beginMove(a)
    expect(interaction.constrain(a, { x: -50, y: start.y })).toEqual({ x: 0, y: start.y })
    // Other pieces are not under this drag, so they pass through unchanged.
    expect(interaction.constrain('other', { x: -50, y: 0 })).toEqual({ x: -50, y: 0 })
  })

  it('blocks selection and drags while the menu is open, and cancel reopens input', () => {
    const { scene, interaction, create } = setup()
    const a = create(), b = create()

    interaction.openMenu(a, { x: 10, y: 10 })
    expect(interaction.menu.value).toEqual({ id: a, x: 10, y: 10 })
    expect([...scene.selection.value]).toEqual([a])
    expect(interaction.blocked.value).toBe(true)
    interaction.select(b, 'replace')
    expect(interaction.beginMove(b)).toBe(false)
    expect([...scene.selection.value]).toEqual([a])

    interaction.cancel()
    expect(interaction.menu.value).toBeNull()
    expect(interaction.blocked.value).toBe(false)
  })

  it('cancels synchronously when the page bumps the cancel version or disables editing', () => {
    const { interaction, version, disabled, create } = setup()
    const a = create()

    interaction.openMenu(a, { x: 0, y: 0 })
    version.value++
    expect(interaction.menu.value).toBeNull()

    expect(interaction.beginMove(a)).toBe(true)
    disabled.value = true
    expect(interaction.previewFor(a)).toBeUndefined()
    expect(interaction.blocked.value).toBe(true)
    expect(interaction.beginMove(a)).toBe(false)
  })

  it('applies toolbar actions to the current selection', () => {
    const { scene, interaction, create } = setup()
    const a = create()
    create()
    scene.select([a])

    expect(interaction.apply({ type: 'delete' }).allowed).toBe(true)
    expect(scene.tiles.value.map(tile => tile.id)).not.toContain(a)
    expect(scene.tiles.value).toHaveLength(1)
  })
})
