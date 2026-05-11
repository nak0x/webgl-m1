import { reactive } from 'vue'

let nextId = 0
const toasts = reactive([])

export function useToast() {
  function push(type, message, detail = '', duration = null) {
    const id = ++nextId
    const ms = duration ?? (type === 'error' ? 8000 : 4000)
    toasts.push({ id, type, message, detail })
    setTimeout(() => dismiss(id), ms)
  }

  function dismiss(id) {
    const idx = toasts.findIndex(t => t.id === id)
    if (idx !== -1) toasts.splice(idx, 1)
  }

  return {
    toasts,
    info: (msg, detail, dur) => push('info', msg, detail, dur),
    warn: (msg, detail, dur) => push('warn', msg, detail, dur),
    error: (msg, detail, dur) => push('error', msg, detail, dur),
    dismiss
  }
}
