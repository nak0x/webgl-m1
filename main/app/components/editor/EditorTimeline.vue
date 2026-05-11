<template>
  <div class="timeline-root" ref="rootEl">
    <!-- Controls -->
    <div class="tl-controls">
      <button class="tl-btn" @click="onStop">■</button>
      <button class="tl-btn" @click="onPlayPause">{{ store.isPlaying ? '⏸' : '▶' }}</button>
      <span class="tl-frame">{{ store.currentFrame }} / {{ store.totalFrames }}</span>
      <span class="tl-time">{{ currentTime }}</span>
    </div>

    <!-- SVG tracks -->
    <svg
      ref="svgEl"
      class="tl-svg"
      :width="svgW"
      :height="SVG_H"
      @mousemove="onSvgMouseMove"
      @mouseup="onSvgMouseUp"
      @mouseleave="onSvgMouseUp"
      @dragover.prevent
      @drop.prevent="onSvgDrop"
    >
      <!-- Timescale header -->
      <line :x1="LABEL_W" y1="24" :x2="svgW" y2="24" stroke="#444" />
      <template v-for="tick in ticks" :key="tick.frame">
        <line
          :x1="frameToX(tick.frame)" y1="18"
          :x2="frameToX(tick.frame)" y2="24"
          stroke="#666"
        />
        <text
          :x="frameToX(tick.frame)"
          y="14"
          text-anchor="middle"
          fill="#888"
          font-size="9"
        >{{ tick.label }}</text>
      </template>

      <!-- Tracks -->
      <g v-for="(track, ti) in TRACKS" :key="track.id" :transform="`translate(0, ${HEADER_H + ti * TRACK_H})`">
        <!-- Label -->
        <rect x="0" y="0" :width="LABEL_W" :height="TRACK_H" fill="#222" />
        <text x="8" :y="TRACK_H / 2 + 4" fill="#aaa" font-size="11">{{ track.label }}</text>
        <!-- Track bg -->
        <rect :x="LABEL_W" y="0" :width="svgW - LABEL_W" :height="TRACK_H" fill="#181818" />
        <line :x1="LABEL_W" :y1="TRACK_H" :x2="svgW" :y2="TRACK_H" stroke="#2a2a2a" />

        <!-- Events -->
        <g
          v-for="ev in eventsForTrack(track)"
          :key="ev.id"
          style="cursor: pointer"
          @mousedown.stop="startDragEvent($event, ev)"
          @click.stop="store.selectedEventId = ev.id"
        >
          <rect
            :x="frameToX(ev.frame)"
            y="4"
            :width="eventBlockWidth(ev)"
            :height="TRACK_H - 8"
            :fill="EVENT_COLORS[ev.type]"
            :opacity="ev.id === store.selectedEventId ? 1 : 0.75"
            rx="3"
          />
          <!-- Right-edge tick for duration blocks -->
          <line
            v-if="(ev.duration ?? 0) > 0"
            :x1="frameToX(ev.frame) + eventBlockWidth(ev) - 2"
            y1="4"
            :x2="frameToX(ev.frame) + eventBlockWidth(ev) - 2"
            :y2="TRACK_H - 4"
            stroke="rgba(0,0,0,0.4)"
            stroke-width="2"
            pointer-events="none"
          />
          <text
            :x="frameToX(ev.frame) + eventBlockWidth(ev) / 2"
            :y="TRACK_H / 2 + 4"
            text-anchor="middle"
            fill="#000"
            font-size="8"
            pointer-events="none"
          >{{ eventLabel(ev) }}</text>
        </g>
      </g>

      <!-- Playhead -->
      <line
        :x1="frameToX(store.currentFrame)"
        y1="0"
        :x2="frameToX(store.currentFrame)"
        :y2="SVG_H"
        stroke="#ff4444"
        stroke-width="1.5"
        style="cursor: ew-resize"
        @mousedown.stop="startDragPlayhead"
      />
      <polygon
        :points="playheadHead"
        fill="#ff4444"
        style="cursor: ew-resize"
        @mousedown.stop="startDragPlayhead"
      />
    </svg>
  </div>
</template>

<script setup>
import { useCinematicEditorStore, EVENT_COLORS } from '~/stores/cinematicEditor.js'

const props  = defineProps({ player: { type: Object, default: null } })
const emit   = defineEmits(['seek'])
const store  = useCinematicEditorStore()
const rootEl = ref(null)
const svgEl  = ref(null)
const svgW   = ref(800)

const LABEL_W  = 72
const HEADER_H = 28
const TRACK_H  = 32
const EVENT_W  = 10
const TRACKS   = [
  { id: 'camera',  label: 'Camera',  types: ['cameraCut', 'fov'] },
  { id: 'sound',   label: 'Sounds',  types: ['sound'] },
  { id: 'effects', label: 'Effects', types: ['vignette', 'shake'] },
  { id: 'postfx',  label: 'PostFX',  types: [
    'bloom', 'dof', 'ssao', 'motionBlur', 'vignetteGl',
    'chromaticAberration', 'filmGrain', 'exposure', 'lut', 'disableEffect',
  ]},
  { id: 'custom',  label: 'Custom',  types: ['custom'] },
]
const SVG_H = HEADER_H + TRACKS.length * TRACK_H

// ─── Helpers ───────────────────────────────────────────────────────────────

const contentW = computed(() => Math.max(svgW.value - LABEL_W, 1))

function frameToX(frame) {
  return LABEL_W + (frame / Math.max(store.totalFrames, 1)) * contentW.value
}

function xToFrame(x) {
  return Math.round(((x - LABEL_W) / contentW.value) * store.totalFrames)
}

function eventsForTrack(track) {
  return store.events.filter(e => track.types.includes(e.type))
}

function eventBlockWidth(ev) {
  const dur = ev.duration ?? 0
  if (dur <= 0) return EVENT_W
  return Math.max(EVENT_W, frameToX(ev.frame + dur) - frameToX(ev.frame))
}

function eventLabel(ev) {
  if (ev.type === 'cameraCut')    return ev.camera?.split('.')[0] ?? 'cut'
  if (ev.type === 'disableEffect') return `!${ev.effectName ?? ''}`
  if (ev.type === 'fov')          return `${ev.fov ?? '?'}°`
  return ev.type
}

const currentTime = computed(() => {
  const s = Math.floor(store.currentFrame / store.fps)
  const f = store.currentFrame % store.fps
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(f).padStart(2, '0')}`
})

const ticks = computed(() => {
  const result = []
  const step = store.fps
  for (let f = 0; f <= store.totalFrames; f += step) {
    const s = f / store.fps
    result.push({ frame: f, label: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` })
  }
  return result
})

const playheadHead = computed(() => {
  const x = frameToX(store.currentFrame)
  return `${x - 5},0 ${x + 5},0 ${x},8`
})

// ─── Resize ────────────────────────────────────────────────────────────────

onMounted(() => {
  const ro = new ResizeObserver(([entry]) => { svgW.value = entry.contentRect.width })
  ro.observe(rootEl.value)
  onUnmounted(() => ro.disconnect())
})

// ─── Drag playhead ─────────────────────────────────────────────────────────

let draggingPlayhead = false

function startDragPlayhead(e) {
  draggingPlayhead = true
  e.preventDefault()
}

// ─── Drag event ────────────────────────────────────────────────────────────

let draggingEvent     = null
let dragClickOffsetPx = 0

function startDragEvent(e, ev) {
  draggingEvent     = ev
  const rect        = svgEl.value.getBoundingClientRect()
  dragClickOffsetPx = e.clientX - rect.left - frameToX(ev.frame)
  e.preventDefault()
}

// ─── Shared mouse handlers ─────────────────────────────────────────────────

function onSvgMouseMove(e) {
  if (draggingPlayhead) {
    const rect  = svgEl.value.getBoundingClientRect()
    const frame = Math.max(0, Math.min(xToFrame(e.clientX - rect.left), store.totalFrames))
    store.currentFrame = frame
    emit('seek', frame)
  } else if (draggingEvent) {
    const rect     = svgEl.value.getBoundingClientRect()
    const newFrame = Math.max(0, Math.min(
      xToFrame(e.clientX - rect.left - dragClickOffsetPx),
      store.totalFrames,
    ))
    store.updateEvent(draggingEvent.id, { frame: newFrame })
  }
}

function onSvgMouseUp() {
  draggingPlayhead = false
  draggingEvent    = null
}

function onSvgDrop(e) {
  try {
    const data = JSON.parse(e.dataTransfer.getData('application/json'))
    const rect  = svgEl.value.getBoundingClientRect()
    const frame = Math.max(0, Math.min(xToFrame(e.clientX - rect.left), store.totalFrames))
    if (data.type === 'sound-asset') {
      const ev = store.addEvent('sound', frame)
      store.updateEvent(ev.id, { file: data.name })
    } else if (data.type === 'lut-asset') {
      const ev = store.addEvent('lut', frame)
      store.updateEvent(ev.id, { file: data.name })
    }
  } catch {}
}

// ─── Playback controls ─────────────────────────────────────────────────────

function onPlayPause() {
  if (store.isPlaying) {
    store.isPlaying = false
    props.player?.pause()
  } else {
    store.isPlaying = true
    props.player?.play()
  }
}

function onStop() {
  store.isPlaying = false
  props.player?.stop()
}
</script>

<style scoped>
.timeline-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #141414;
  border-top: 1px solid #333;
  overflow: hidden;
  user-select: none;
}

.tl-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #1e1e1e;
  border-bottom: 1px solid #2a2a2a;
  flex-shrink: 0;
}

.tl-btn {
  background: #333;
  border: none;
  color: #fff;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.tl-btn:hover { background: #444; }

.tl-frame { color: #eee; font-size: 12px; font-family: monospace; }
.tl-time  { color: #888; font-size: 11px; font-family: monospace; }

.tl-svg {
  flex: 1;
  display: block;
  overflow: visible;
}
</style>
