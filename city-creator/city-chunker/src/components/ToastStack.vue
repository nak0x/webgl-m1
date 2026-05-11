<script setup>
import { useToast } from '../composables/useToast.js'

const { toasts, dismiss } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="toast-stack">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast"
          :class="t.type"
          @click="dismiss(t.id)"
        >
          <span class="toast-icon">
            {{ t.type === 'error' ? '✖' : t.type === 'warn' ? '⚠' : 'ℹ' }}
          </span>
          <div class="toast-body">
            <span class="toast-msg">{{ t.message }}</span>
            <span v-if="t.detail" class="toast-detail">{{ t.detail }}</span>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  max-width: 380px;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px solid;
  cursor: pointer;
  pointer-events: all;
  background: #161b22;
  font-size: 12px;
  line-height: 1.4;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

.toast.info  { border-color: #1f6feb; color: #79c0ff; }
.toast.warn  { border-color: #9e6a03; color: #e3b341; }
.toast.error { border-color: #6e1a1a; color: #f85149; }

.toast-icon {
  flex-shrink: 0;
  margin-top: 1px;
  font-size: 11px;
}

.toast-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.toast-msg {
  color: #c9d1d9;
  font-weight: 500;
}

.toast-detail {
  color: #6e7681;
  font-size: 11px;
  word-break: break-all;
}

/* TransitionGroup animations */
.toast-enter-active { transition: opacity 0.2s, transform 0.2s; }
.toast-leave-active { transition: opacity 0.15s, transform 0.15s; }
.toast-enter-from   { opacity: 0; transform: translateY(8px); }
.toast-leave-to     { opacity: 0; transform: translateY(4px); }
</style>
