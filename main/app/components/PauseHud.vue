<template>
  <Transition name="pause-fade">
    <div v-if="visible" class="pause-backdrop" @click.self="$emit('close')">

      <div class="pause-modal">

        <button class="pause-close" @click="$emit('close')">✕</button>

        <!-- Menu principal -->
        <template v-if="!activePanel">
          <button class="pause-btn" @click="activePanel = 'aide'">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Aide
          </button>
          <button class="pause-btn" @click="activePanel = 'params'">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M4.93 4.93a10 10 0 0 0 14.14 14.14"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/></svg>
            Paramètres
          </button>
          <button class="pause-btn" @click="$emit('return-home')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
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
                <input
                  type="range" min="0" max="1" step="0.01"
                  :value="volumes.master"
                  @input="e => $emit('volume-change', { category: 'master', value: parseFloat(e.target.value) })"
                  class="param-slider"
                />
                <span class="param-value">{{ Math.round(volumes.master * 100) }}%</span>
              </div>
            </div>

            <div class="param-row">
              <label class="param-label">Ambiance</label>
              <div class="param-control">
                <input
                  type="range" min="0" max="1" step="0.01"
                  :value="volumes.ambient"
                  @input="e => $emit('volume-change', { category: 'ambient', value: parseFloat(e.target.value) })"
                  class="param-slider"
                />
                <span class="param-value">{{ Math.round(volumes.ambient * 100) }}%</span>
              </div>
            </div>

            <div class="param-row">
              <label class="param-label">Voix</label>
              <div class="param-control">
                <input
                  type="range" min="0" max="1" step="0.01"
                  :value="volumes.voice"
                  @input="e => $emit('volume-change', { category: 'voice', value: parseFloat(e.target.value) })"
                  class="param-slider"
                />
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
  { key: 'Z / W',  desc: 'Avancer'            },
  { key: 'S',      desc: 'Reculer'             },
  { key: 'Q / A',  desc: 'Aller à gauche'      },
  { key: 'D',      desc: 'Aller à droite'      },
  { key: 'Souris', desc: 'Regarder autour'     },
  { key: 'E',      desc: 'Interagir'           },
  { key: 'Échap',  desc: 'Ouvrir le menu pause'},
]

const UI_ITEMS = [
  { side: 'left',  label: 'Acte',         desc: 'Nom de l\'acte en cours'           },
  { side: 'left',  label: 'Progression',  desc: 'Avancement dans les objectifs'     },
  { side: 'left',  label: 'Quête',        desc: 'Objectif actuel à accomplir'       },
  { side: 'right', label: 'Batterie / Heure', desc: 'État des lunettes AR'          },
  { side: 'right', label: 'Outils requis', desc: 'Objets à récupérer, se cochent automatiquement' },
  { side: 'right', label: 'Notifications', desc: 'Alertes temporaires du système AR'},
]
</script>

<style scoped>
.pause-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 800;
}

.pause-modal {
  position: relative;
  background: #e8e8e8;
  border-radius: 8px;
  padding: 32px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.pause-close {
  position: absolute;
  top: -14px;
  right: -14px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #111;
  color: #fff;
  border: none;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.pause-close:hover { background: #333; }

/* ── Boutons principaux ── */

.pause-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: #000;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 16px 32px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  width: 256px;
  transition: background 0.15s;
}

.pause-btn:hover { background: #222; }

/* ── Panels ── */

.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  color: #111;
  margin-bottom: 4px;
  width: 256px;
}

.panel-back {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #111;
  display: flex;
  align-items: center;
  border-radius: 4px;
}

.panel-back:hover { background: rgba(0,0,0,0.08); }

.panel-tabs {
  display: flex;
  background: rgba(0,0,0,0.08);
  border-radius: 6px;
  padding: 3px;
  gap: 3px;
  width: 256px;
  box-sizing: border-box;
}

.tab-btn {
  flex: 1;
  background: none;
  border: none;
  border-radius: 4px;
  padding: 7px 0;
  font-size: 13px;
  font-weight: 500;
  color: #555;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.tab-btn--active {
  background: #fff;
  color: #000;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 280px;
  overflow-y: auto;
  width: 256px;
}

/* ── Touches ── */

.key-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.key-badge {
  background: #111;
  color: #fff;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  font-family: monospace;
  white-space: nowrap;
  min-width: 64px;
  text-align: center;
}

.key-desc {
  font-size: 13px;
  color: #333;
}

/* ── Interface ── */

.ui-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.ui-tag {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 6px;
  border-radius: 3px;
  white-space: nowrap;
  margin-top: 2px;
}

.ui-tag--left  { background: #000;    color: #fff; }
.ui-tag--right { background: #4a7fa5; color: #fff; }

.ui-label { font-size: 13px; font-weight: 600; color: #111; }
.ui-desc  { font-size: 11px; color: #555; margin-top: 2px; line-height: 1.4; }

/* ── Paramètres ── */

.param-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.param-label {
  font-size: 12px;
  font-weight: 600;
  color: #111;
}

.param-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.param-slider {
  flex: 1;
  accent-color: #000;
  cursor: pointer;
}

.param-value {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #333;
  min-width: 36px;
  text-align: right;
}

/* ── Transition ── */

.pause-fade-enter-active { transition: opacity 0.2s ease; }
.pause-fade-leave-active { transition: opacity 0.15s ease; }
.pause-fade-enter-from,
.pause-fade-leave-to     { opacity: 0; }
</style>
