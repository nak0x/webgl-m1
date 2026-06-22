<template>
  <Transition name="home" @after-leave="onAfterLeave">
    <div v-if="visible" ref="root" class="home">
      <div ref="scaler" class="home__scaler">
        <div ref="stage" class="home__stage">

          <!-- ── Fond hero ── -->
          <div class="bg-hero" aria-hidden="true"></div>
          <img class="bat-centre" src="/images/home/batiment-centre.png" alt="" aria-hidden="true">
          <div class="beige-mask" aria-hidden="true"></div>
          <img class="bat-ressources" src="/images/home/batiment-ressources.png" alt="" aria-hidden="true">

          <!-- ── Header ── -->
          <header class="home-header">
            <img class="header-logo" src="/images/home/logo-small.svg" alt="ad-hoc">
            <div class="header-link">
              <span class="header-dot"></span>
              <span>A propos</span>
            </div>
          </header>

          <!-- ── Hero ── -->
          <div class="hero-content">
            <div class="hero-logo">
              <img src="/images/home/logo-adhoc.svg" alt="ad-hoc">
            </div>
            <p class="hero-subtitle">Artisans de la maintenance</p>
            <button class="home-start-btn" @click="launch">Commencer</button>
          </div>

          <!-- ── Section 2050 ── -->
          <div class="box-2050"></div>
          <img class="img-2050" src="/images/home/2050.svg" alt="2050">
          <p class="text-2050">Après l'effondrement de l'ère des Villes-Marques, Altera s'est reconstruite sur les ruines du capitalisme pour devenir un écosystème de "Communs" géré par et pour ses citoyens.</p>

          <!-- ── Section Atelier ── -->
          <h2 class="atelier-title">Atelier<br>de la Maintenance</h2>
          <p class="atelier-text">Les artisans veillent sur la flotte de véhicules partagés, répondant aux alertes pour garantir une mobilité fluide et solidaire basée sur l'urgence sociale.</p>

        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
const emit = defineEmits(['start'])

const DESIGN_W = 1440
const DESIGN_H = 3185

// ── Séquence de scroll : [position en px design, pause en ms] ─────────────
const WAYPOINTS = [
  { designY: 1100, pauseMs: 1400 },  // Section 2050
  { designY: 2200, pauseMs: 1400 },  // Section Atelier
]
const EASE_DURATION_MS = 1600        // Durée de chaque segment d'ease (ms)

const visible = ref(true)
const root    = useTemplateRef('root')
const scaler  = useTemplateRef('scaler')
const stage   = useTemplateRef('stage')

let _raf = null

function fit() {
  if (!root.value || !stage.value || !scaler.value) return
  const s = root.value.clientWidth / DESIGN_W
  stage.value.style.transform = `scale(${s})`
  scaler.value.style.height = `${DESIGN_H * s}px`
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

function scrollTo(el, target, duration) {
  return new Promise(resolve => {
    const from  = el.scrollTop
    const start = performance.now()

    function step(now) {
      const t = Math.min((now - start) / duration, 1)
      el.scrollTop = from + (target - from) * easeInOut(t)
      if (t < 1) {
        _raf = requestAnimationFrame(step)
      } else {
        el.scrollTop = target
        resolve()
      }
    }
    _raf = requestAnimationFrame(step)
  })
}

function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function launch() {
  const el = root.value
  if (!el) return

  const scale = el.clientWidth / DESIGN_W

  for (const wp of WAYPOINTS) {
    await scrollTo(el, wp.designY * scale, EASE_DURATION_MS)
    await pause(wp.pauseMs)
  }

  // Scroll final vers le bas
  await scrollTo(el, el.scrollHeight - el.clientHeight, EASE_DURATION_MS)
  visible.value = false
}

function onAfterLeave() {
  emit('start')
}

onMounted(() => {
  fit()
  window.addEventListener('resize', fit)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', fit)
  if (_raf) cancelAnimationFrame(_raf)
})
</script>

<style scoped>
.home {
  position: fixed;
  inset: 0;
  z-index: 500;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--color-white);
}

.home__scaler { width: 100%; }

.home__stage {
  position: relative;
  width: 1440px;
  height: 3185px;
  transform-origin: top left;
  overflow: hidden;
  font-family: 'Fira Sans', system-ui, sans-serif;
}

/* ── Fond hero (image + dégradé combinés) ── */

.bg-hero {
  position: absolute;
  left: 0; top: 0;
  width: 1440px; height: 1111px;
  background:
    linear-gradient(180deg, rgba(239, 234, 223, 0.50) 93.37%, #efeadf 99.26%),
    url('/images/home/bg-city.png') lightgray 0px -107.055px / 100% 113.412% no-repeat;
  z-index: 1;
  pointer-events: none;
}

.bat-centre {
  position: absolute;
  left: -370px; top: 978px;
  width: 1588px; height: 893px;
  object-fit: cover;
  z-index: 3;
}

.beige-mask {
  position: absolute;
  left: 761px; top: 1858px;
  width: 307px; height: 242px;
  background: var(--color-white);
  z-index: 4;
}

.bat-ressources {
  position: absolute;
  left: -274px; top: 1878px;
  width: 2323px; height: 1307px;
  object-fit: cover;
  z-index: 5;
}

/* ── Header ── */

.home-header {
  position: absolute;
  left: 25px; top: 26px;
  height: 50px;
  display: flex;
  align-items: center;
  gap: 24px;
  z-index: 20;
}

.header-logo { width: 50px; height: 50px; display: block; }

.header-link {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 18px;
  font-weight: 400;
  color: var(--color-black);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.header-dot { width: 6px; height: 6px; background: var(--color-black); }

/* ── Hero ── */

.hero-content {
  position: absolute;
  top: 240px;
  left: 0;
  width: 1440px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  z-index: 20;
}

.hero-logo { width: 500px; height: 200px; }
.hero-logo img { width: 100%; height: 100%; object-fit: contain; display: block; }

.hero-subtitle {
  font-size: 24px;
  font-weight: 400;
  line-height: 25px;
  color: var(--color-black);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.home-start-btn {
  margin-top: 149px;
  background: var(--color-orange);
  box-shadow: 0 0 3px rgba(45, 29, 27, 0.25);
  border: none;
  padding: 14px 40px;
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: var(--color-black);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: filter 0.15s;
}
.home-start-btn:hover { filter: brightness(1.08); }

/* ── Section 2050 ── */

.box-2050 {
  position: absolute;
  left: 761px; top: 1219px;
  width: 556px; height: 598px;
  background: var(--color-orange);
  z-index: 10;
}

.img-2050 {
  position: absolute;
  left: 794px; top: 1266px;
  width: 352px; height: 150px;
  object-fit: contain;
  z-index: 11;
}

.text-2050 {
  position: absolute;
  left: 794px; top: 1466px;
  width: 489px;
  font-size: 24px;
  font-weight: 400;
  line-height: 40px;
  color: var(--color-white);
  z-index: 11;
}

/* ── Section Atelier ── */

.atelier-title {
  position: absolute;
  left: 175px; top: 2249px;
  width: 343px;
  font-size: 32px;
  font-weight: 700;
  line-height: 32px;
  color: #ff5020;
  text-transform: uppercase;
  z-index: 20;
}

.atelier-text {
  position: absolute;
  left: 175px; top: 2376px;
  width: 672px;
  font-size: 24px;
  font-weight: 400;
  line-height: 40px;
  color: var(--color-black);
  z-index: 20;
}

/* ── Transition de sortie ── */
.home-leave-active { transition: opacity 600ms ease; }
.home-leave-to     { opacity: 0; }
</style>
