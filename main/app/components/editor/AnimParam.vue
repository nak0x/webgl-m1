<template>
  <div class="anim-param">
    <div class="field">
      <label>{{ label }}{{ animated ? ' (fin)' : '' }}{{ unit }}</label>
      <div class="field-row">
        <input v-if="isRange" type="range" :min="min" :max="max" :step="step" :value="val"
          @input="$emit('update:val', +$event.target.value)" />
        <input type="number" :min="min" :max="max" :step="step" :value="val"
          :style="isRange ? 'width:60px;flex-shrink:0' : ''"
          @change="$emit('update:val', +$event.target.value)" />
      </div>
    </div>
    <div v-if="animated && !progressive" class="field field--from">
      <label>{{ label }} (début){{ unit }}</label>
      <div class="field-row">
        <input v-if="isRange" type="range" :min="min" :max="max" :step="step" :value="from ?? val"
          @input="$emit('update:from', +$event.target.value)" />
        <input type="number" :min="min" :max="max" :step="step" :value="from ?? val"
          :style="isRange ? 'width:60px;flex-shrink:0' : ''"
          @change="$emit('update:from', +$event.target.value)" />
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  label:       { type: String,  required: true },
  unit:        { type: String,  default: '' },
  val:         { type: Number,  default: undefined },
  from:        { type: Number,  default: undefined },
  animated:    { type: Boolean, default: false },
  progressive: { type: Boolean, default: false },
  min:         { type: Number,  default: 0 },
  max:         { type: Number,  default: 1 },
  step:        { type: Number,  default: 0.01 },
  isRange:     { type: Boolean, default: true },
})

defineEmits(['update:val', 'update:from'])
</script>

<style scoped>
.anim-param { display: flex; flex-direction: column; gap: 4px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field--from {
  padding-left: 10px;
  border-left: 2px solid #1d4ed8;
}
.field-row { display: flex; align-items: center; gap: 8px; }
.field-row input[type="range"] { flex: 1; }

.field label {
  color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
}

.field input[type="number"] {
  background: #252525; border: 1px solid #333; color: #ddd;
  padding: 5px 8px; border-radius: 4px; font-size: 12px; outline: none;
}
.field input:focus { border-color: #555; }
.field input[type="range"] { accent-color: #4fc3f7; }
</style>
