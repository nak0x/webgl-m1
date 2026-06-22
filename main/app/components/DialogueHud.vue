<template>
  <Transition name="dialogue">
    <div v-if="active" class="dialogue-root">
      <div class="dialogue-wrap">

        <div class="dialogue-box">
          <p v-if="current?.speaker" class="dialogue-speaker">{{ current.speaker }}</p>
          <p class="dialogue-text">{{ displayedText }}</p>
        </div>

        <button class="dialogue-btn" @click="next">
          <span>{{ isTyping ? 'Passer' : isLast ? 'Terminer' : current?.cta ?? 'Continuer' }}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </button>

      </div>
    </div>
  </Transition>
</template>

<script setup>
const props = defineProps({
  active:  { type: Boolean, required: true },
  current: { type: Object,  default: null  },
  index:   { type: Number,  default: 0     },
  total:   { type: Number,  default: 0     },
  isLast:  { type: Boolean, default: false },
})

const emit = defineEmits(['next'])

const displayedText = ref('')
const isTyping = ref(false)
let _timer = null

function startTyping(text) {
  clearInterval(_timer)
  displayedText.value = ''
  if (!text) return
  isTyping.value = true
  let i = 0
  _timer = setInterval(() => {
    displayedText.value = text.slice(0, ++i)
    if (i >= text.length) {
      clearInterval(_timer)
      isTyping.value = false
    }
  }, 30)
}

function skipTyping() {
  clearInterval(_timer)
  displayedText.value = props.current?.text ?? ''
  isTyping.value = false
}

function next() {
  if (isTyping.value) { skipTyping(); return }
  emit('next')
}

watch(() => props.current, (val) => {
  if (val?.text) startTyping(val.text)
})

function onKey(e) {
  if (!props.active) return
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault()
    next()
  }
}

onMounted(()  => window.addEventListener('keydown', onKey))
onUnmounted(() => { window.removeEventListener('keydown', onKey); clearInterval(_timer) })
</script>

<style scoped>
.dialogue-root {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  padding: 0 0 36px;
  z-index: 500;
  pointer-events: none;
}

.dialogue-wrap {
  pointer-events: all;
  width: min(720px, 90vw);
  display: flex;
  gap: 14px;
  flex-direction: column;
}

.dialogue-box {
  background: var(--color-black);
  padding: 24px 28px;
}

.dialogue-speaker {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(239, 234, 223, 0.5);
  margin-bottom: 10px;
}

.dialogue-text {
  font-size: 16px;
  font-weight: 400;
  line-height: 20px;
  color: var(--color-white);
  min-height: 48px;
}

.dialogue-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--color-orange);
  border: none;
  color: var(--color-black);
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 16px 28px;
  cursor: pointer;
  width: 100%;
  transition: filter 0.15s;
}

.dialogue-btn:hover {
  filter: brightness(1.08);
}

/* Transition */
.dialogue-enter-active { transition: opacity 0.2s, transform 0.2s; }
.dialogue-leave-active { transition: opacity 0.15s, transform 0.15s; }
.dialogue-enter-from   { opacity: 0; transform: translateY(12px); }
.dialogue-leave-to     { opacity: 0; transform: translateY(8px); }
</style>
