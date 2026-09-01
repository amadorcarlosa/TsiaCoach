import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'

export default defineNuxtPlugin(() => {
  gsap.registerPlugin(Draggable, InertiaPlugin)

  return {
    provide: {
      gsap,
      Draggable,
    },
  }
})

declare module '#app' {
  interface NuxtApp {
    $gsap: typeof gsap
    $Draggable: typeof Draggable
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $gsap: typeof gsap
    $Draggable: typeof Draggable
  }
}
