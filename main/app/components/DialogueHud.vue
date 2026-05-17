<template>
  <Transition name="dialogue">
    <div v-if="active" class="dialogue-root">
      <div class="dialogue-box">

        <p v-if="current?.speaker" class="dialogue-speaker">{{ current.speaker }}</p>

        <p class="dialogue-text">{{ displayedText }}</p>

        <hr class="dialogue-sep" />

        <div class="dialogue-footer">
          <span class="dialogue-dots">
            <span
              v-for="i in total"
              :key="i"
              class="dot"
              :class="{ 'dot--active': i - 1 === index }"
            />
          </span>
          <button class="dialogue-btn" @click="next">
            {{ isTyping ? 'Passer' : isLast ? 'Terminer' : 'Continuer' }}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="4,2 10,7 4,12"/>
            </svg>
          </button>
        </div>

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

.dialogue-box {
  pointer-events: all;
  width: min(720px, 90vw);
  background: #000;
  border-radius: 12px;
  padding: 24px 28px 20px;
}

.dialogue-speaker {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 10px;
}

.dialogue-text {
  font-size: 15px;
  line-height: 1.7;
  color: #fff;
  min-height: 48px;
}

.dialogue-sep {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  margin: 18px 0 14px;
}

.dialogue-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dialogue-dots {
  display: flex;
  gap: 5px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255,255,255,0.18);
  transition: background 0.2s;
}

.dot--active {
  background: rgba(255,255,255,0.85);
}

.dialogue-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.1);
  border: none;
  border-radius: 999px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 18px 8px 22px;
  cursor: pointer;
  transition: background 0.15s;
}

.dialogue-btn:hover {
  background: rgba(255,255,255,0.18);
}

/* Transition */
.dialogue-enter-active { transition: opacity 0.2s, transform 0.2s; }
.dialogue-leave-active { transition: opacity 0.15s, transform 0.15s; }
.dialogue-enter-from   { opacity: 0; transform: translateY(12px); }
.dialogue-leave-to     { opacity: 0; transform: translateY(8px); }
</style>
