<template>
  <div class="inspector">
    <div class="inspector-header">
      <span class="inspector-title">Inspector</span>
      <div v-if="event" class="inspector-actions">
        <button class="ins-btn" @click="store.duplicateEvent(event.id)">Duplicate</button>
        <button class="ins-btn ins-btn--danger" @click="store.deleteEvent(event.id)">Delete</button>
      </div>
    </div>

    <div v-if="!event" class="inspector-empty">
      Sélectionne un événement ou ajoute-en un.
    </div>

    <div v-else class="inspector-body">

      <!-- ─── Frame (commun) ─── -->
      <div class="field">
        <label>Frame</label>
        <input type="number" :value="event.frame" min="0" :max="store.totalFrames"
          @change="update('frame', +$event.target.value)" />
      </div>

      <!-- ─── Durée + Easing + Progressive (pour tous les effets postfx / caméra) ─── -->
      <template v-if="hasTransition">
        <div class="transition-header">
          <span class="transition-label">Transition</span>
          <span v-if="isAnimated" class="transition-badge">animé</span>
        </div>
        <div class="field-row-inline">
          <div class="field field--half">
            <label>Durée (frames)</label>
            <input type="number" :value="event.duration" min="0"
              @change="update('duration', +$event.target.value)" />
          </div>
          <div v-if="isAnimated" class="field field--half">
            <label>Easing</label>
            <select :value="event.easing" @change="update('easing', $event.target.value)">
              <option value="linear">linear</option>
              <option value="easeIn">easeIn</option>
              <option value="easeOut">easeOut</option>
              <option value="easeInOut">easeInOut</option>
            </select>
          </div>
        </div>
        <div v-if="isAnimated" class="field field--row">
          <label>Progressive <span class="field-hint" style="display:inline">(from = état courant)</span></label>
          <input type="checkbox" :checked="event.progressive"
            @change="update('progressive', $event.target.checked)" />
        </div>
      </template>

      <!-- ─── cameraCut ─── -->
      <template v-if="event.type === 'cameraCut'">
        <div class="field">
          <label>Caméra</label>
          <select :value="event.camera" @change="update('camera', $event.target.value)">
            <option v-for="c in store.cameras" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
      </template>

      <!-- ─── sound ─── -->
      <template v-else-if="event.type === 'sound'">
        <div class="field">
          <label>Fichier</label>
          <select :value="event.file" @change="update('file', $event.target.value)">
            <option value="">-- choisir --</option>
            <option v-for="a in store.audioAssets" :key="a.id" :value="a.name">{{ a.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Volume</label>
          <div class="field-row">
            <input type="range" min="0" max="1" step="0.01" :value="event.volume"
              @input="update('volume', +$event.target.value)" />
            <span class="field-value">{{ event.volume?.toFixed(2) }}</span>
          </div>
        </div>
      </template>

      <!-- ─── vignette (CSS) ─── -->
      <template v-else-if="event.type === 'vignette'">
        <div class="field">
          <label>Direction</label>
          <select :value="event.direction" @change="update('direction', $event.target.value)">
            <option value="in">in (fade to black)</option>
            <option value="out">out (fade to clear)</option>
          </select>
        </div>
        <div class="field">
          <label>Durée (frames)</label>
          <input type="number" :value="event.duration" min="1"
            @change="update('duration', +$event.target.value)" />
        </div>
      </template>

      <!-- ─── shake ─── -->
      <template v-else-if="event.type === 'shake'">
        <div class="field">
          <label>Intensité</label>
          <div class="field-row">
            <input type="range" min="0" max="2" step="0.05" :value="event.intensity"
              @input="update('intensity', +$event.target.value)" />
            <span class="field-value">{{ event.intensity?.toFixed(2) }}</span>
          </div>
        </div>
        <div class="field">
          <label>Durée (frames)</label>
          <input type="number" :value="event.duration" min="1"
            @change="update('duration', +$event.target.value)" />
        </div>
      </template>

      <!-- ─── fov ─── -->
      <template v-else-if="event.type === 'fov'">
        <AnimParam label="FOV" unit="°" :val="event.fov" :from="event.fovFrom"
          :animated="isAnimated" :progressive="event.progressive" min="10" max="120" step="1"
          @update:val="update('fov', $event)" @update:from="update('fovFrom', $event)" />
      </template>

      <!-- ─── bloom ─── -->
      <template v-else-if="event.type === 'bloom'">
        <AnimParam label="Strength" :val="event.strength" :from="event.strengthFrom"
          :animated="isAnimated" :progressive="event.progressive" min="0" max="3" step="0.05"
          @update:val="update('strength', $event)" @update:from="update('strengthFrom', $event)" />
        <AnimParam label="Radius" :val="event.radius" :from="event.radiusFrom"
          :animated="isAnimated" :progressive="event.progressive" min="0" max="1" step="0.01"
          @update:val="update('radius', $event)" @update:from="update('radiusFrom', $event)" />
        <AnimParam label="Threshold" :val="event.threshold" :from="event.thresholdFrom"
          :animated="isAnimated" :progressive="event.progressive" min="0" max="1" step="0.01"
          @update:val="update('threshold', $event)" @update:from="update('thresholdFrom', $event)" />
        <p class="field-hint">Emissive materials Blender → contrôlent ce qui brille.</p>
      </template>

      <!-- ─── dof ─── -->
      <template v-else-if="event.type === 'dof'">
        <AnimParam label="Focus" unit=" u" :val="event.focus" :from="event.focusFrom"
          :animated="isAnimated" :progressive="event.progressive" min="0.01" max="100" step="0.1" :is-range="false"
          @update:val="update('focus', $event)" @update:from="update('focusFrom', $event)" />
        <AnimParam label="Aperture" :val="event.aperture" :from="event.apertureFrom"
          :animated="isAnimated" :progressive="event.progressive" min="0.0001" max="0.1" step="0.0001"
          @update:val="update('aperture', $event)" @update:from="update('apertureFrom', $event)" />
        <AnimParam label="Max Blur" :val="event.maxblur" :from="event.maxblurFrom"
          :animated="isAnimated" :progressive="event.progressive" min="0" max="0.02" step="0.0001"
          @update:val="update('maxblur', $event)" @update:from="update('maxblurFrom', $event)" />
      </template>

      <!-- ─── ssao ─── -->
      <template v-else-if="event.type === 'ssao'">
        <AnimParam label="Kernel Radius" :val="event.radius" :from="event.radiusFrom"
          :animated="isAnimated" :progressive="event.progressive" min="1" max="32" step="0.5"
          @update:val="update('radius', $event)" @update:from="update('radiusFrom', $event)" />
        <AnimParam label="Min Distance" :val="event.minDistance" :from="event.minDistanceFrom"
          :animated="isAnimated" :progressive="event.progressive" min="0.001" max="0.1" step="0.001" :is-range="false"
          @update:val="update('minDistance', $event)" @update:from="update('minDistanceFrom', $event)" />
        <AnimParam label="Max Distance" :val="event.maxDistance" :from="event.maxDistanceFrom"
          :animated="isAnimated" :progressive="event.progressive" min="0.01" max="1" step="0.01" :is-range="false"
          @update:val="update('maxDistance', $event)" @update:from="update('maxDistanceFrom', $event)" />
        <p class="field-hint">Coûteux sur low-end. Requiert des normales correctes dans le GLB.</p>
      </template>

      <!-- ─── motionBlur ─── -->
      <template v-else-if="event.type === 'motionBlur'">
        <AnimParam label="Damp" :val="event.damp" :from="event.dampFrom"
          :animated="isAnimated" :progressive="event.progressive" min="0.5" max="0.99" step="0.01"
          @update:val="update('damp', $event)" @update:from="update('dampFrom', $event)" />
        <p class="field-hint">AfterimagePass — accumulation, pas un vrai motion blur.</p>
      </template>

      <!-- ─── vignetteGl ─── -->
      <template v-else-if="event.type === 'vignetteGl'">
        <AnimParam label="Offset (taille)" :val="event.offset" :from="event.offsetFrom"
          :animated="isAnimated" :progressive="event.progressive" min="0" max="2" step="0.01"
          @update:val="update('offset', $event)" @update:from="update('offsetFrom', $event)" />
        <AnimParam label="Darkness" :val="event.darkness" :from="event.darknessFrom"
          :animated="isAnimated" :progressive="event.progressive" min="0" max="3" step="0.05"
          @update:val="update('darkness', $event)" @update:from="update('darknessFrom', $event)" />
      </template>

      <!-- ─── chromaticAberration ─── -->
      <template v-else-if="event.type === 'chromaticAberration'">
        <AnimParam label="Amount" :val="event.amount" :from="event.amountFrom"
          :animated="isAnimated" :progressive="event.progressive" min="0" max="0.02" step="0.0001"
          @update:val="update('amount', $event)" @update:from="update('amountFrom', $event)" />
      </template>

      <!-- ─── filmGrain ─── -->
      <template v-else-if="event.type === 'filmGrain'">
        <AnimParam label="Intensité" :val="event.nIntensity" :from="event.nIntensityFrom"
          :animated="isAnimated" :progressive="event.progressive" min="0" max="1" step="0.01"
          @update:val="update('nIntensity', $event)" @update:from="update('nIntensityFrom', $event)" />
        <div class="field field--row">
          <label>Grayscale</label>
          <input type="checkbox" :checked="event.grayscale"
            @change="update('grayscale', $event.target.checked)" />
        </div>
      </template>

      <!-- ─── exposure ─── -->
      <template v-else-if="event.type === 'exposure'">
        <AnimParam label="EV (stops)" unit=" EV" :val="event.ev" :from="event.evFrom"
          :animated="isAnimated" :progressive="event.progressive" min="-4" max="4" step="0.01"
          @update:val="update('ev', $event)" @update:from="update('evFrom', $event)" />
      </template>

      <!-- ─── lut ─── -->
      <template v-else-if="event.type === 'lut'">
        <div class="field">
          <label>Fichier LUT</label>
          <select :value="event.file" @change="update('file', $event.target.value)">
            <option value="">-- choisir .cube --</option>
            <option v-for="a in store.lutAssets" :key="a.id" :value="a.name">{{ a.name }}</option>
          </select>
        </div>
        <AnimParam label="Intensity" :val="event.intensity" :from="event.intensityFrom"
          :animated="isAnimated" :progressive="event.progressive" min="0" max="1" step="0.01"
          @update:val="update('intensity', $event)" @update:from="update('intensityFrom', $event)" />
        <p v-if="!store.lutAssets.length" class="field-hint field-hint--warn">
          Charge un fichier .cube via le panneau Assets.
        </p>
      </template>

      <!-- ─── disableEffect ─── -->
      <template v-else-if="event.type === 'disableEffect'">
        <div class="field">
          <label>Effet à désactiver</label>
          <select :value="event.effectName" @change="update('effectName', $event.target.value)">
            <option v-for="name in EFFECT_NAMES" :key="name" :value="name">{{ name }}</option>
          </select>
        </div>
      </template>

      <!-- ─── custom ─── -->
      <template v-else-if="event.type === 'custom'">
        <div class="field">
          <label>Nom</label>
          <input type="text" :value="event.name" @input="update('name', $event.target.value)"
            placeholder="onPCFocus" />
        </div>
      </template>

      <!-- Badge type -->
      <div class="type-badge" :style="{ background: EVENT_COLORS[event.type] }">
        {{ event.type }}
      </div>

    </div>
  </div>
</template>



<script setup>
import { useCinematicEditorStore, EVENT_COLORS, POSTFX_EFFECT_NAMES } from '~/stores/cinematicEditor.js'
import AnimParam from './AnimParam.vue'

const store = useCinematicEditorStore()
const event = computed(() => store.selectedEvent)

const EFFECT_NAMES    = POSTFX_EFFECT_NAMES
const TRANSITION_TYPES = [
  'fov', 'bloom', 'dof', 'ssao', 'motionBlur', 'vignetteGl',
  'chromaticAberration', 'filmGrain', 'exposure', 'lut',
]

const hasTransition = computed(() => TRANSITION_TYPES.includes(event.value?.type))
const isAnimated    = computed(() => (event.value?.duration ?? 0) > 0)

function update(key, value) {
  if (!event.value) return
  store.updateEvent(event.value.id, { [key]: value })
}
</script>

<style scoped>
.inspector {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1a1a1a;
  overflow-y: auto;
}

.inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #1e1e1e;
  border-bottom: 1px solid #2a2a2a;
  flex-shrink: 0;
}

.inspector-title { color: #ccc; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.inspector-actions { display: flex; gap: 6px; }

.ins-btn {
  background: #333; border: none; color: #ddd;
  padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;
}
.ins-btn:hover { background: #444; }
.ins-btn--danger { color: #f87171; }
.ins-btn--danger:hover { background: #3d1f1f; }

.inspector-empty { padding: 24px 16px; color: #555; font-size: 12px; }

.inspector-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }

/* Transition section */
.transition-header {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 0; border-top: 1px solid #2a2a2a; margin-top: 2px;
}
.transition-label { color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
.transition-badge {
  background: #1d4ed8; color: #93c5fd; font-size: 9px;
  padding: 1px 6px; border-radius: 3px;
}

.field-row-inline { display: flex; gap: 8px; }
.field--half { flex: 1; min-width: 0; }

/* AnimParam */
.anim-param { display: flex; flex-direction: column; gap: 4px; }
.field--from {
  padding-left: 10px;
  border-left: 2px solid #1d4ed8;
}

/* Champs communs */
.field { display: flex; flex-direction: column; gap: 4px; }
.field--row { flex-direction: row; align-items: center; justify-content: space-between; }

.field label {
  color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
}

.field-row { display: flex; align-items: center; gap: 8px; }
.field-row input[type="range"] { flex: 1; }

.field input[type="text"],
.field input[type="number"],
.field select {
  background: #252525; border: 1px solid #333; color: #ddd;
  padding: 5px 8px; border-radius: 4px; font-size: 12px; outline: none;
}
.field input:focus, .field select:focus { border-color: #555; }
.field input[type="range"]    { accent-color: #4fc3f7; }
.field input[type="checkbox"] { accent-color: #4fc3f7; cursor: pointer; }

.field-value { color: #aaa; font-size: 11px; font-family: monospace; min-width: 48px; text-align: right; }

.field-hint { color: #666; font-size: 10px; margin: 0; font-style: italic; }
.field-hint--warn { color: #ffb74d; }

.type-badge {
  align-self: flex-start; padding: 3px 10px; border-radius: 12px;
  font-size: 10px; font-weight: 600; color: #000; margin-top: 4px;
}
</style>
