import { ref } from 'vue'

export function useDragAnnouncer() {
  const message = ref('')

  function announce(nextMessage: string) {
    message.value = ''
    message.value = nextMessage
  }

  return {
    message,
    announce
  }
}
