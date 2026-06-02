<template>
  <div class="rb">
    <!-- ── Colonne gauche : chargement + pièces ──────────────────── -->
    <aside class="rb__col rb__col--left">
      <h1 class="rb__title">Repair Builder</h1>

      <div class="rb__field">
        <label>Modèle (chemin MinIO)</label>
        <input v-model="modelPath" placeholder="/models/vehicles/dacia_sandero.glb" />
        <button :disabled="loading || !modelPath" @click="loadModel">
          {{ loading ? 'Chargement…' : 'Charger' }}
        </button>
      </div>

      <div class="rb__section">
        <div class="rb__section-title">Pièces du modèle ({{ parts.length }})</div>
        <ul class="rb__parts">
          <li
            v-for="p in parts"
            :key="p"
            :class="{ 'is-selected': p === selectedPart }"
            @click="selectPart(p)"
          >
            {{ p }}
          </li>
        </ul>
        <p v-if="!parts.length" class="rb__hint">Charge un modèle pour lister ses pièces.</p>
      </div>
    </aside>

    <!-- ── Centre : aperçu 3D ────────────────────────────────────── -->
    <main class="rb__viewport">
      <canvas ref="canvas" />
      <div v-if="selectedPart" class="rb__selected-tag">Sélection : {{ selectedPart }}</div>
    </main>

    <!-- ── Colonne droite : réparations + véhicule + save ────────── -->
    <aside class="rb__col rb__col--right">
      <!-- Réparation en cours -->
      <div class="rb__section">
        <div class="rb__section-title">
          {{ editingIndex >= 0 ? 'Modifier réparation' : 'Nouvelle réparation' }}
        </div>

        <div class="rb__field"><label>id</label><input v-model="draft.id" placeholder="panne_moteur" /></div>
        <div class="rb__field"><label>Nom</label><input v-model="draft.name" /></div>
        <div class="rb__field"><label>Description</label><textarea v-model="draft.description" rows="2" /></div>
        <div class="rb__field">
          <label>Gravité</label>
          <select v-model="draft.severity">
            <option v-for="s in SEVERITIES" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="rb__row">
          <label><input type="checkbox" v-model="draft.repairable" /> réparable</label>
          <label><input type="checkbox" v-model="draft.replaceable" /> remplaçable</label>
        </div>

        <div class="rb__section-title rb__section-title--sub">Pièces concernées</div>
        <div class="rb__add-piece">
          <input v-model="pieceLabel" placeholder="Label (ex: Moteur hydrogène)" />
          <button :disabled="!selectedPart || !pieceLabel" @click="addPiece">
            + {{ selectedPart || 'aucune pièce' }}
          </button>
        </div>
        <ul class="rb__pieces">
          <li v-for="(pc, i) in draft.pieces" :key="i">
            <span>{{ pc.name }} <em>({{ pc.mesh }})</em></span>
            <button class="rb__x" @click="draft.pieces.splice(i, 1)">×</button>
          </li>
        </ul>

        <div class="rb__row">
          <button class="rb__primary" :disabled="!canSaveRepair" @click="saveRepair">
            {{ editingIndex >= 0 ? 'Mettre à jour' : 'Ajouter la réparation' }}
          </button>
          <button v-if="editingIndex >= 0" @click="startNewRepair">Annuler</button>
        </div>
      </div>

      <!-- Liste des réparations -->
      <div class="rb__section">
        <div class="rb__section-title">Réparations ({{ data.repairs.length }})</div>
        <ul class="rb__repairs">
          <li v-for="(r, i) in data.repairs" :key="r.id">
            <span class="rb__sev" :class="`rb__sev--${r.severity}`" />
            <span class="rb__repair-name" @click="editRepair(i)">{{ r.name || r.id }}</span>
            <button class="rb__x" @click="removeRepair(i)">×</button>
          </li>
        </ul>
      </div>

      <!-- Véhicule + meta -->
      <details class="rb__section">
        <summary class="rb__section-title">Véhicule & contexte</summary>
        <div class="rb__field"><label>Nom</label><input v-model="data.vehicle.name" /></div>
        <div class="rb__row">
          <div class="rb__field"><label>Année</label><input v-model.number="data.vehicle.year" type="number" /></div>
          <div class="rb__field"><label>KM</label><input v-model.number="data.vehicle.km" type="number" /></div>
        </div>
        <div class="rb__field"><label>Immatriculation</label><input v-model="data.vehicle.immatriculation" /></div>
        <div class="rb__row">
          <div class="rb__field"><label>Carburant</label><input v-model="data.vehicle.fuel_type" /></div>
          <div class="rb__field"><label>Niveau</label><input v-model.number="data.vehicle.fuel_level" type="number" /></div>
        </div>
        <div class="rb__field"><label>Contexte</label><textarea v-model="data.context" rows="2" /></div>
        <div class="rb__row">
          <div class="rb__field">
            <label>Priorité</label>
            <select v-model="data.priority">
              <option v-for="p in PRIORITIES" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
          <div class="rb__field"><label>Délai (j)</label><input v-model.number="data.repair_delay_days" type="number" /></div>
        </div>
      </details>

      <!-- Sauvegarde -->
      <div class="rb__section rb__save">
        <div class="rb__field">
          <label>Fichier réparation</label>
          <input v-model="repairFile" placeholder="car_repair_dacia.json" />
        </div>
        <button class="rb__primary" :disabled="!canSaveJson" @click="saveAndRedirect">Sauvegarder le JSON ↑</button>

        <div class="rb__field rb__assoc">
          <label>Associer à un accident</label>
          <select v-model="assocId">
            <option value="">— aucun —</option>
            <option v-for="a in accidents" :key="a.id" :value="a.id">{{ a.label || a.id }}</option>
          </select>
          <button :disabled="!assocId || !repairFile || !modelPath" @click="associate">Associer + sauver ville</button>
        </div>

        <p v-if="message" class="rb__message" :class="{ 'is-error': messageError }">{{ message }}</p>
      </div>
    </aside>
  </div>
</template>

<script setup>
import * as THREE from '/lib/three.js'
import { OrbitControls } from '/lib/addons/controls/OrbitControls.js'
import Resources     from '~/utils/three/Resources.js'
import { assetPath } from '~/utils/assetPath.js'

const SEVERITIES = ['bon', 'use', 'endommage', 'critique']
const PRIORITIES = ['urgent', 'high', 'normal', 'low']
const HIGHLIGHT  = new THREE.Color(0x35a0ff)
const PART_COLOR = new THREE.Color(0x9fb4c4)

const canvas    = useTemplateRef('canvas')
const modelPath = ref('')
const loading   = ref(false)
const parts     = ref([])
const selectedPart = ref('')
const pieceLabel   = ref('')
const repairFile   = ref('')
const accidents    = ref([])
const assocId      = ref('')
const message      = ref('')
const messageError = ref(false)
const editingIndex = ref(-1)

const data = reactive({
  vehicle: { name: '', year: 2030, immatriculation: '', km: 0, fuel_level: 0, fuel_type: '' },
  context: '',
  priority: 'normal',
  repair_delay_days: 0,
  available_parts: [],
  repair_history: [],
  repairs: [],
})

const draft = reactive(emptyRepair())

function emptyRepair() {
  return { id: '', name: '', description: '', severity: 'use', repairable: true, replaceable: true, pieces: [] }
}

const canSaveRepair = computed(() =>
  draft.id.trim() && draft.pieces.length > 0 && SEVERITIES.includes(draft.severity)
)
const canSaveJson = computed(() =>
  /^[a-z0-9_]+\.json$/i.test(repairFile.value) && data.repairs.length > 0
)

// ── Three preview (non réactif) ──────────────────────────────────
let renderer, scene, camera, controls, raf, resizeObserver
let model = null
const xrays = new Map()   // meshName → { mesh, origMat, xray }
const raycaster = new THREE.Raycaster()
const pointer   = new THREE.Vector2()

onMounted(() => {
  initThree()
  loadAccidents()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  resizeObserver?.disconnect()
  disposeModel()
  controls?.dispose()
  renderer?.dispose()
})

function initThree() {
  const el = canvas.value
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x10141c)

  camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, 0.05, 500)
  camera.position.set(4, 2.5, 4)

  renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(el.clientWidth, el.clientHeight, false)

  controls = new OrbitControls(camera, el)
  controls.enableDamping = true
  controls.target.set(0, 0.6, 0)

  scene.add(new THREE.AmbientLight(0xffffff, 1.2))
  const dir = new THREE.DirectionalLight(0xffffff, 1.6)
  dir.position.set(5, 8, 5)
  scene.add(dir)
  scene.add(new THREE.GridHelper(20, 40, 0x2a3340, 0x1c2430))

  el.addEventListener('pointerdown', onPointerDown)
  resizeObserver = new ResizeObserver(onResize)
  resizeObserver.observe(el)
  onResize()

  const tick = () => {
    controls.update()
    renderer.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }
  tick()
}

function onResize() {
  const el = canvas.value
  if (!el || !el.clientWidth || !el.clientHeight) return
  camera.aspect = el.clientWidth / el.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(el.clientWidth, el.clientHeight, false)
}

function loadModel() {
  if (!modelPath.value) return
  loading.value = true
  setMessage('')
  const path = assetPath(modelPath.value)
  const type = path.toLowerCase().endsWith('.glb') ? 'glb' : 'gltf'
  const res  = new Resources([{ name: 'preview', type, path }])
  res.on('ready', () => {
    loading.value = false
    const gltf = res.items.preview
    if (!gltf?.scene) { setMessage('Modèle introuvable ou invalide', true); return }
    setupModel(gltf.scene)
  })
}

function setupModel(root) {
  disposeModel()
  model = root

  const names = []
  model.traverse(o => {
    if (o.isMesh && o.name) {
      names.push(o.name)
      const xray = createXray({ color: PART_COLOR.clone() })
      xrays.set(o.name, { mesh: o, origMat: o.material, xray })
      o.material = xray.material
    }
  })
  parts.value = [...new Set(names)]
  selectedPart.value = ''

  scene.add(model)
  frameModel(model)
}

function frameModel(obj) {
  const box  = new THREE.Box3().setFromObject(obj)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1
  controls.target.copy(center)
  camera.position.copy(center).add(new THREE.Vector3(radius * 2.2, radius * 1.6, radius * 2.2))
  camera.near = radius / 100
  camera.far  = radius * 100
  camera.updateProjectionMatrix()
}

function onPointerDown(e) {
  if (!model) return
  const rect = canvas.value.getBoundingClientRect()
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObject(model, true)
  const mesh = hits.find(h => h.object.isMesh && h.object.name)?.object
  if (mesh) selectPart(mesh.name)
}

function selectPart(name) {
  selectedPart.value = name
  xrays.forEach(({ xray }, key) => {
    xray.setColor(key === name ? HIGHLIGHT : PART_COLOR)
  })
}

function addPiece() {
  if (!selectedPart.value || !pieceLabel.value) return
  if (draft.pieces.some(p => p.mesh === selectedPart.value)) return
  draft.pieces.push({ mesh: selectedPart.value, name: pieceLabel.value })
  pieceLabel.value = ''
}

function saveRepair() {
  if (!canSaveRepair.value) return
  const entry = JSON.parse(JSON.stringify(draft))
  if (editingIndex.value >= 0) data.repairs.splice(editingIndex.value, 1, entry)
  else data.repairs.push(entry)
  startNewRepair()
}

function editRepair(i) {
  Object.assign(draft, JSON.parse(JSON.stringify(data.repairs[i])))
  editingIndex.value = i
}

function removeRepair(i) {
  data.repairs.splice(i, 1)
  if (editingIndex.value === i) startNewRepair()
}

function startNewRepair() {
  Object.assign(draft, emptyRepair())
  draft.pieces = []
  editingIndex.value = -1
}

async function saveJson() {
  if (!canSaveJson.value) return false
  const body = JSON.parse(JSON.stringify(data))
  try {
    const res = await fetch('/api/settings/' + repairFile.value, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    setMessage(`Sauvegardé : ${repairFile.value}`)
    return true
  } catch (err) {
    setMessage('Échec : ' + err.message, true)
    return false
  }
}

async function saveAndRedirect() {
  const ok = await saveJson()
  if (ok) setTimeout(() => window.location.assign('/repair-builder'), 700)
}

async function loadAccidents() {
  try {
    const res = await fetch('/settings/city_accidents.json')
    if (!res.ok) return
    const json = await res.json()
    accidents.value = Array.isArray(json?.accidents) ? json.accidents : []
  } catch { /* fichier absent : pas d'association possible, sans bloquer l'outil */ }
}

async function associate() {
  if (!assocId.value) return
  await saveJson()
  const res = await fetch('/settings/city_accidents.json')
  const json = res.ok ? await res.json() : { version: 1, accidents: [] }
  const list = Array.isArray(json.accidents) ? json.accidents : []
  const acc  = list.find(a => a.id === assocId.value)
  if (!acc) { setMessage('Accident introuvable', true); return }
  acc.repairFile = repairFile.value
  acc.modelPath  = modelPath.value
  try {
    const save = await fetch('/api/settings/city_accidents.json', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: 1, accidents: list }),
    })
    if (!save.ok) throw new Error(`HTTP ${save.status}`)
    accidents.value = list
    setMessage(`Associé à ${assocId.value}`)
  } catch (err) {
    setMessage('Échec association : ' + err.message, true)
  }
}

function disposeModel() {
  if (!model) return
  scene.remove(model)
  xrays.forEach(({ mesh, origMat, xray }) => {
    mesh.material = origMat
    xray.dispose()
  })
  xrays.clear()
  model.traverse(o => { if (o.isMesh) o.geometry?.dispose() })
  model = null
  parts.value = []
}

function setMessage(text, isError = false) {
  message.value = text
  messageError.value = isError
}
</script>

<style scoped>
.rb {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 320px;
  height: 100vh;
  overflow: hidden;
  background: #0b0e14;
  color: #e6ebf2;
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: 13px;
}

.rb__col {
  overflow-y: auto;
  min-width: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rb__col--left  { border-right: 1px solid #1c2330; }
.rb__col--right { border-left: 1px solid #1c2330; }

.rb__title { font-size: 16px; font-weight: 700; margin: 0; color: #fff; }

.rb__viewport {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.rb__viewport canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.rb__selected-tag {
  position: absolute; top: 12px; left: 12px;
  background: rgba(53,160,255,0.18); color: #9fd0ff;
  padding: 4px 10px; border-radius: 5px; font-size: 12px;
}

.rb__field { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.rb__field label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #7d8aa0; }
.rb__field input, .rb__field textarea, .rb__field select,
.rb__add-piece input {
  background: #131925; border: 1px solid #232c3c; color: #e6ebf2;
  border-radius: 5px; padding: 6px 8px; font: inherit; font-size: 12px;
}
.rb__row { display: flex; gap: 8px; align-items: flex-end; }

.rb__section { display: flex; flex-direction: column; gap: 8px; }
.rb__section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #aab6c8; cursor: default; }
.rb__section-title--sub { color: #7d8aa0; font-size: 11px; margin-top: 4px; }
.rb__hint { color: #5f6b80; font-size: 12px; margin: 0; }

button {
  background: #232c3c; color: #e6ebf2; border: none; border-radius: 5px;
  padding: 7px 10px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
}
button:hover:not(:disabled) { filter: brightness(1.2); }
button:disabled { opacity: 0.4; cursor: not-allowed; }
.rb__primary { background: #2563c4; color: #fff; flex: 1; }

.rb__parts, .rb__pieces, .rb__repairs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.rb__parts { max-height: 40vh; overflow-y: auto; }
.rb__parts li { padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; color: #c2ccda; }
.rb__parts li:hover { background: #161d2a; }
.rb__parts li.is-selected { background: #1c3a5c; color: #9fd0ff; }

.rb__add-piece { display: flex; gap: 6px; }
.rb__add-piece input { flex: 1; }

.rb__pieces li, .rb__repairs li {
  display: flex; align-items: center; gap: 8px; justify-content: space-between;
  background: #131925; padding: 5px 8px; border-radius: 4px; font-size: 12px;
}
.rb__pieces em { color: #6c7a90; font-style: normal; }
.rb__repair-name { flex: 1; cursor: pointer; }
.rb__repair-name:hover { color: #9fd0ff; }
.rb__x { background: transparent; color: #d05c6c; padding: 0 4px; font-size: 16px; }

.rb__sev { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.rb__sev--bon { background: #00ff88; }
.rb__sev--use { background: #ffcc00; }
.rb__sev--endommage { background: #ff6600; }
.rb__sev--critique { background: #ff0044; }

.rb__save { margin-top: auto; }
.rb__assoc { margin-top: 4px; }
.rb__message { font-size: 12px; color: #5fd0a0; margin: 4px 0 0; }
.rb__message.is-error { color: #ff7088; }
</style>
