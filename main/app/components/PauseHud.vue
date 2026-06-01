<template>
  <Transition name="pause-fade">
    <div v-if="visible" class="pause-backdrop" @click.self="$emit('close')">

      <div class="pause-modal">

        <button class="pause-close" @click="$emit('close')" aria-label="Fermer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <!-- Menu principal -->
        <template v-if="!activePanel">
          <button class="pause-btn" @click="activePanel = 'aide'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Aide
          </button>
          <button class="pause-btn" @click="activePanel = 'params'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Paramètres
          </button>
          <button class="pause-btn" @click="$emit('return-home')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
            </svg>
            Retour à l'accueil
          </button>
        </template>

        <!-- Panel Aide -->
        <template v-else-if="activePanel === 'aide'">
          <div class="panel-header">
            <button class="panel-back" @click="activePanel = null">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15,18 9,12 15,6"/></svg>
            </button>
            <span>Aide</span>
          </div>
          <div class="panel-tabs">
            <button :class="['tab-btn', { 'tab-btn--active': activeTab === 'touches' }]" @click="activeTab = 'touches'">Touches</button>
            <button :class="['tab-btn', { 'tab-btn--active': activeTab === 'interface' }]" @click="activeTab = 'interface'">Interface</button>
          </div>
          <div v-if="activeTab === 'touches'" class="panel-content">
            <div v-for="row in KEYS" :key="row.key" class="key-row">
              <kbd class="key-badge">{{ row.key }}</kbd>
              <span class="key-desc">{{ row.desc }}</span>
            </div>
          </div>
          <div v-else class="panel-content">
            <div v-for="item in UI_ITEMS" :key="item.label" class="ui-row">
              <span class="ui-tag" :class="'ui-tag--' + item.side">{{ item.side === 'left' ? 'Gauche' : 'Droit' }}</span>
              <div>
                <div class="ui-label">{{ item.label }}</div>
                <div class="ui-desc">{{ item.desc }}</div>
              </div>
            </div>
          </div>
        </template>

        <!-- Panel Paramètres -->
        <template v-else-if="activePanel === 'params'">
          <div class="panel-header">
            <button class="panel-back" @click="activePanel = null">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15,18 9,12 15,6"/></svg>
            </button>
            <span>Paramètres</span>
          </div>
          <div class="panel-content">
            <div class="param-row">
              <label class="param-label">Volume général</label>
              <div class="param-control">
                <input type="range" min="0" max="1" step="0.01" :value="volumes.master" @input="e => $emit('volume-change', { category: 'master', value: parseFloat(e.target.value) })" class="param-slider" />
                <span class="param-value">{{ Math.round(volumes.master * 100) }}%</span>
              </div>
            </div>
            <div class="param-row">
              <label class="param-label">Ambiance</label>
              <div class="param-control">
                <input type="range" min="0" max="1" step="0.01" :value="volumes.ambient" @input="e => $emit('volume-change', { category: 'ambient', value: parseFloat(e.target.value) })" class="param-slider" />
                <span class="param-value">{{ Math.round(volumes.ambient * 100) }}%</span>
              </div>
            </div>
            <div class="param-row">
              <label class="param-label">Voix</label>
              <div class="param-control">
                <input type="range" min="0" max="1" step="0.01" :value="volumes.voice" @input="e => $emit('volume-change', { category: 'voice', value: parseFloat(e.target.value) })" class="param-slider" />
                <span class="param-value">{{ Math.round(volumes.voice * 100) }}%</span>
              </div>
            </div>
          </div>
        </template>

      </div>
    </div>
  </Transition>
</template>

<script setup>
const emit = defineEmits(['close', 'return-home', 'volume-change'])

const props = defineProps({
  visible:  { type: Boolean, default: false },
  volumes:  { type: Object,  default: () => ({ master: 1, ambient: 0.4, voice: 0.8 }) },
})

const activePanel = ref(null)
const activeTab   = ref('touches')

watch(() => props.visible, (v) => {
  if (!v) { activePanel.value = null; activeTab.value = 'touches' }
})

const KEYS = [
  { key: 'Z / W',  desc: 'Avancer'             },
  { key: 'S',      desc: 'Reculer'              },
  { key: 'Q / A',  desc: 'Aller à gauche'       },
  { key: 'D',      desc: 'Aller à droite'       },
  { key: 'Souris', desc: 'Regarder autour'      },
  { key: 'E',      desc: 'Interagir'            },
  { key: 'Échap',  desc: 'Ouvrir le menu pause' },
]

const UI_ITEMS = [
  { side: 'left',  label: 'Acte',             desc: "Nom de l'acte en cours"                          },
  { side: 'left',  label: 'Progression',      desc: 'Avancement dans les objectifs'                   },
  { side: 'left',  label: 'Quête',            desc: 'Objectif actuel à accomplir'                     },
  { side: 'right', label: 'Batterie / Heure', desc: 'État des lunettes AR'                            },
  { side: 'right', label: 'Outils requis',    desc: 'Objets à récupérer, se cochent automatiquement'  },
  { side: 'right', label: 'Notifications',    desc: 'Alertes temporaires du système AR'               },
]
</script>

<style scoped>
.pause-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(45, 29, 27, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 800;
}

/* ── Modal ── */

.pause-modal {
  position: relative;
  background: var(--color-white);
  box-shadow: 0 0 5px rgba(142, 184, 184, 0.75);
  padding: 92px 98px;
  display: flex;
  flex-direction: column;
  gap: 23px;
}

.pause-close {
  position: absolute;
  top: 5px;
  right: 11px;
  width: 40px;
  height: 40px;
  background: none;
  border: none;
  color: var(--color-black);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s;
}

.pause-close:hover { opacity: 0.6; }

/* ── Boutons principaux ── */

.pause-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--color-orange);
  color: var(--color-black);
  border: none;
  box-shadow: 0 0 3px rgba(45, 29, 27, 0.25);
  padding: 14px 40px;
  width: 260px;
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  cursor: pointer;
  transition: filter 0.15s;
}

.pause-btn:hover { filter: brightness(1.08); }

/* ── Panels ── */

.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: var(--color-black);
  width: 260px;
}

.panel-back {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--color-black);
  display: flex;
  align-items: center;
  transition: opacity 0.15s;
}

.panel-back:hover { opacity: 0.6; }

.panel-tabs {
  display: flex;
  background: rgba(45, 29, 27, 0.08);
  padding: 3px;
  gap: 3px;
  width: 260px;
  box-sizing: border-box;
}

.tab-btn {
  flex: 1;
  background: none;
  border: none;
  padding: 7px 0;
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: rgba(45, 29, 27, 0.5);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.tab-btn--active {
  background: var(--color-white);
  color: var(--color-black);
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 280px;
  overflow-y: auto;
  width: 260px;
}

/* ── Touches ── */

.key-row { display: flex; align-items: center; gap: 12px; }

.key-badge {
  background: var(--color-black);
  color: var(--color-white);
  padding: 4px 8px;
  font-size: 11px;
  font-family: monospace;
  white-space: nowrap;
  min-width: 64px;
  text-align: center;
}

.key-desc { font-size: 13px; color: var(--color-black); }

/* ── Interface ── */

.ui-row { display: flex; align-items: flex-start; gap: 10px; }

.ui-tag {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 6px;
  white-space: nowrap;
  margin-top: 2px;
}

.ui-tag--left  { background: var(--color-black);  color: var(--color-white); }
.ui-tag--right { background: var(--color-orange); color: var(--color-black); }

.ui-label { font-size: 13px; font-weight: 500; color: var(--color-black); }
.ui-desc  { font-size: 11px; color: rgba(45, 29, 27, 0.6); margin-top: 2px; line-height: 1.4; }

/* ── Paramètres ── */

.param-row { display: flex; flex-direction: column; gap: 6px; }

.param-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-black);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.param-control { display: flex; align-items: center; gap: 10px; }

.param-slider { flex: 1; accent-color: var(--color-orange); cursor: pointer; }

.param-value {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--color-black);
  min-width: 36px;
  text-align: right;
}

/* ── Transition ── */

.pause-fade-enter-active { transition: opacity 0.2s ease; }
.pause-fade-leave-active { transition: opacity 0.15s ease; }
.pause-fade-enter-from,
.pause-fade-leave-to     { opacity: 0; }
</style>
