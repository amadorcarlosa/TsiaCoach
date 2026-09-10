import type { InjectionKey, Ref } from 'vue'

export const sceneCancellationKey: InjectionKey<Readonly<Ref<number>>> =
  Symbol('scene-cancellation')
