import { computed } from 'vue'
import type { useRodScene } from './useRodScene'

type Scene = ReturnType<typeof useRodScene>

/**
 * One editing target for a board that can switch scenes, such as a committed
 * scene and a conversion draft. Interaction, menus, marquee, keyboard and
 * toolbar all bind to this once, so switching the target can never leave one
 * of them attached to the other scene. Every read and call is delegated at use
 * time to whichever scene `pick` returns.
 */
export function useActiveScene(pick: () => Scene): Scene {
  return {
    trains: computed(() => pick().trains.value),
    selection: computed(() => pick().selection.value),
    message: computed(() => pick().message.value),
    check: (ids, action) => pick().check(ids, action),
    apply: (ids, action) => pick().apply(ids, action),
    checkReplacement: source => pick().checkReplacement(source),
    validateSnapshot: source => pick().validateSnapshot(source),
    replace: source => pick().replace(source),
    select: ids => pick().select(ids),
    constrainMove: (ids, delta, direction) => pick().constrainMove(ids, delta, direction),
    getAddendChoices: id => pick().getAddendChoices(id),
    getFactorChoices: id => pick().getFactorChoices(id),
    getAreaGroupingChoices: ids => pick().getAreaGroupingChoices(ids),
    getRectangleChoices: (ids, prefer) => pick().getRectangleChoices(ids, prefer),
    planZeroPair: ids => pick().planZeroPair(ids),
  }
}
