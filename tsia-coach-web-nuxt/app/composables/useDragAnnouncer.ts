import { nextTick, ref } from 'vue'

export function useDragAnnouncer() {
  const message = ref('')

  function announce(nextMessage: string) {
    message.value = ''
    nextTick(() => {
      message.value = nextMessage
    })
  }

  return {
    message,
    announce
  }
}
