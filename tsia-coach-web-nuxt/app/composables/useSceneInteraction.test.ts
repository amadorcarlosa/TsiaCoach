// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useRodScene } from '~/composables/useRodScene'
import { useSceneInteraction } from '~/composables/useSceneInteraction'
import { useRodPlaygroundInteraction } from '~/composables/useRodPlaygroundInteraction'
import { copyScene } from '~/components/rod/scene/scene-snapshot'

type Scene = ReturnType<typeof useRodScene>

function createScene(editable: () => boolean = () => true) {
  return useRodScene({
    columns: 24,
    rows: 12,
    spawnRows: [4],
    editable,
    allowOrientation: true,
  })
}

function snapshot(scene: Scene) {
  return {
    trains: scene.trains.value.map(train => ({
      id: train.id,
      anchor: { ...train.anchor },
    })),
    selection: [...scene.selection.value],
  }
}

/** Creates two rods, selects both, and returns [leader, follower]. */
function selectedPair(scene: Scene): [string, string] {
  scene.apply([], { type: 'create', value: 3 })
  scene.apply([], { type: 'create', value: 5 })

  const [leader, follower] = scene.trains.value.map(train => train.id)
  scene.select([leader!, follower!])

  return [leader!, follower!]
}

function anchorOf(scene: Scene, id: string) {
  return scene.trains.value.find(train => train.id === id)!.anchor
}

describe('useSceneInteraction cancelMove', () => {
  it('resets the movement session and follower previews', () => {
    const scene = createScene()
    const [leader, follower] = selectedPair(scene)

    const interaction = useSceneInteraction({
      scene,
      blocked: () => false,
    })

    expect(interaction.beginMove(leader)).toBe(true)
    expect(interaction.leaderId.value).toBe(leader)

    const origin = anchorOf(scene, leader)
    const target = { x: origin.x + 2, y: origin.y + 1 }

    interaction.previewMove(leader, target)

    // Followers preview the leader's delta; the leader renders itself.
    expect(interaction.previewFor(follower)).toEqual({ x: 2, y: 1 })
    expect(interaction.previewFor(leader)).toBeUndefined()

    const before = snapshot(scene)

    interaction.cancelMove()

    expect(interaction.leaderId.value).toBeNull()
    expect(interaction.previewFor(follower)).toBeUndefined()
    expect(interaction.previewFor(leader)).toBeUndefined()

    // A late settle from the cancelled gesture must commit nothing.
    interaction.settleMove(leader, target)
    interaction.endMove(leader)

    expect(snapshot(scene)).toEqual(before)

    // The next gesture can start cleanly.
    expect(interaction.beginMove(leader)).toBe(true)
    expect(interaction.previewFor(follower)).toEqual({ x: 0, y: 0 })
  })

  it('is safe to call without an active session', () => {
    const scene = createScene()
    const [leader, follower] = selectedPair(scene)

    const interaction = useSceneInteraction({
      scene,
      blocked: () => false,
    })

    const before = snapshot(scene)

    expect(() => interaction.cancelMove()).not.toThrow()
    expect(interaction.leaderId.value).toBeNull()
    expect(interaction.previewFor(follower)).toBeUndefined()
    expect(interaction.previewFor(leader)).toBeUndefined()
    expect(snapshot(scene)).toEqual(before)
  })

  it('endMove ignores non-leaders and resets for the leader', () => {
    const scene = createScene()
    const [leader, follower] = selectedPair(scene)

    const interaction = useSceneInteraction({
      scene,
      blocked: () => false,
    })

    interaction.beginMove(leader)
    const origin = anchorOf(scene, leader)
    interaction.previewMove(leader, { x: origin.x + 1, y: origin.y })

    interaction.endMove(follower)
    expect(interaction.leaderId.value).toBe(leader)
    expect(interaction.previewFor(follower)).toEqual({ x: 1, y: 0 })

    interaction.endMove(leader)
    expect(interaction.leaderId.value).toBeNull()
    expect(interaction.previewFor(follower)).toBeUndefined()
  })
})

describe('useRodPlaygroundInteraction cancellation', () => {
  function mountPlayground(options: {
    cancelVersion: () => number
    disabled: () => boolean
  }) {
    let captured: {
      scene: Scene
      playground: ReturnType<typeof useRodPlaygroundInteraction>
    } | undefined

    const Host = defineComponent({
      setup() {
        const scene = createScene(() => !options.disabled())
        const viewport = ref<HTMLElement | null>(null)

        captured = {
          scene,
          playground: useRodPlaygroundInteraction({
            scene,
            viewport,
            disabled: options.disabled,
            cancelVersion: options.cancelVersion,
          }),
        }

        return () => h('div')
      },
    })

    const wrapper = mount(Host)
    if (!captured) throw new Error('setup did not run')

    return { wrapper, ...captured }
  }

  it('captures committed anchors and cancels movement without sharing scene data', () => {
    const { wrapper, scene, playground } = mountPlayground({
      cancelVersion: () => 0, disabled: () => false,
    })
    try {
      const [leader, follower] = selectedPair(scene)
      const before = copyScene(scene.trains.value)
      const origin = anchorOf(scene, leader)
      const target = { x: origin.x + 2, y: origin.y }
      playground.interaction.beginMove(leader)
      playground.interaction.previewMove(leader, target)
      expect(playground.interaction.previewFor(follower)).toEqual({ x: 2, y: 0 })
      const captured = playground.captureScene()
      expect(captured).toEqual(before)
      expect(playground.interaction.leaderId.value).toBeNull()
      expect(playground.interaction.previewFor(follower)).toBeUndefined()
      playground.interaction.settleMove(leader, target)
      expect(scene.trains.value).toEqual(before)
      captured[0]!.anchor.x = 20
      captured[0]!.parts[0]!.offset.x = 10
      expect(scene.trains.value).toEqual(before)
    } finally {
      wrapper.unmount()
    }
  })

  it('replacement clears movement and menu even when destination IDs are unchanged', () => {
    const { wrapper, scene, playground } = mountPlayground({
      cancelVersion: () => 0, disabled: () => false,
    })
    try {
      const [leader, follower] = selectedPair(scene)
      const destination = copyScene(scene.trains.value)
      const origin = anchorOf(scene, leader)
      const target = { x: origin.x + 2, y: origin.y }
      playground.interaction.beginMove(leader)
      playground.interaction.previewMove(leader, target)
      expect(playground.replaceScene(destination).allowed).toBe(true)
      expect(playground.interaction.leaderId.value).toBeNull()
      expect(playground.interaction.previewFor(follower)).toBeUndefined()
      playground.interaction.settleMove(leader, target)
      expect(scene.trains.value).toEqual(destination)

      playground.menu.open({ trainId: leader, anchor: { x: 0, y: 0, width: 10, height: 10 } })
      expect(playground.menu.request.value).not.toBeNull()
      expect(playground.replaceScene(destination).allowed).toBe(true)
      expect(playground.menu.request.value).toBeNull()
      expect([...scene.selection.value]).toEqual([])
    } finally {
      wrapper.unmount()
    }
  })

  it('rejected replacement preserves an active movement or open menu', () => {
    const { wrapper, scene, playground } = mountPlayground({
      cancelVersion: () => 0, disabled: () => false,
    })
    try {
      const [leader, follower] = selectedPair(scene)
      const invalid = copyScene(scene.trains.value)
      invalid[0]!.anchor.x = 24
      playground.interaction.beginMove(leader)
      const origin = anchorOf(scene, leader)
      playground.interaction.previewMove(leader, { x: origin.x + 2, y: origin.y })
      const before = snapshot(scene)
      expect(playground.replaceScene(invalid).allowed).toBe(false)
      expect(playground.interaction.leaderId.value).toBe(leader)
      expect(playground.interaction.previewFor(follower)).toEqual({ x: 2, y: 0 })
      expect(snapshot(scene)).toEqual(before)

      playground.menu.open({ trainId: leader, anchor: { x: 0, y: 0, width: 10, height: 10 } })
      const request = playground.menu.request.value
      scene.apply([], { type: 'delete' })
      const message = scene.message.value
      expect(playground.replaceScene(invalid).allowed).toBe(false)
      expect(playground.menu.request.value).toEqual(request)
      expect(scene.message.value).toBe(message)
      expect(snapshot(scene)).toEqual(before)
    } finally {
      wrapper.unmount()
    }
  })

  it('cancels the session synchronously when the cancel version changes', () => {
    const version = ref(0)

    const { wrapper, scene, playground } = mountPlayground({
      cancelVersion: () => version.value,
      disabled: () => false,
    })

    const [leader, follower] = selectedPair(scene)
    const { interaction } = playground

    expect(interaction.beginMove(leader)).toBe(true)
    const origin = anchorOf(scene, leader)
    const target = { x: origin.x + 3, y: origin.y }
    interaction.previewMove(leader, target)
    expect(interaction.previewFor(follower)).toEqual({ x: 3, y: 0 })

    const before = snapshot(scene)

    // No tick: the watcher flushes synchronously.
    version.value++

    expect(interaction.leaderId.value).toBeNull()
    expect(interaction.previewFor(follower)).toBeUndefined()

    interaction.settleMove(leader, target)
    interaction.endMove(leader)
    expect(snapshot(scene)).toEqual(before)

    wrapper.unmount()
  })

  it('cancels the session synchronously when the playground becomes blocked', () => {
    const disabled = ref(false)

    const { wrapper, scene, playground } = mountPlayground({
      cancelVersion: () => 0,
      disabled: () => disabled.value,
    })

    const [leader, follower] = selectedPair(scene)
    const { interaction, blocked } = playground

    expect(blocked.value).toBe(false)
    expect(interaction.beginMove(leader)).toBe(true)
    const origin = anchorOf(scene, leader)
    interaction.previewMove(leader, { x: origin.x + 1, y: origin.y + 1 })
    expect(interaction.previewFor(follower)).toEqual({ x: 1, y: 1 })

    const before = snapshot(scene)

    disabled.value = true

    expect(blocked.value).toBe(true)
    expect(interaction.leaderId.value).toBeNull()
    expect(interaction.previewFor(follower)).toBeUndefined()
    expect(interaction.beginMove(leader)).toBe(false)
    expect(snapshot(scene)).toEqual(before)

    wrapper.unmount()
  })
})
