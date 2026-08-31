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
