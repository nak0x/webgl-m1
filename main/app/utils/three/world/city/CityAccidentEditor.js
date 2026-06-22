import * as THREE from '/lib/three.js'

const FLOOR_Y = 0.15   // sol ville (cf. CityWorld FLOOR_Y)

const FIELD_DEFAULTS = {
  label:         'Accident',
  modelPath:     '/models/vehicles/.glb',
  repairFile:    'car_repair_.json',
  triggerRadius: 3.5,
  promptText:    'Appuyez sur E pour réparer',
}

/**
 * CityAccidentEditor — outil debug (#debug) de placement des accidents.
 *
 * Pose un accident à la position caméra courante, édite ses champs via lil-gui,
 * visualise la zone d'interaction par un gizmo, et sauvegarde l'ensemble dans
 * public/settings/city_accidents.json via l'API d'écriture (dev-only).
 */
export default class CityAccidentEditor {
  constructor(experience, parentFolder, accidents = []) {
    this._exp       = experience
    this._accidents = accidents.map(a => ({ ...a, position: { ...a.position } }))
    this._gizmos    = new Map()
    this._selectedId = this._accidents[0]?.id ?? null
    this._counter    = this._accidents.length

    const parent = parentFolder ?? experience.debug.gui
    this._root = parent.addFolder('Accidents (editor)')
    this._root.close()

    this._root.add({ place: () => this._placeHere() }, 'place').name('Poser ici (caméra)')
    this._root.add({ save:  () => this._save() }, 'save').name('Sauvegarder ↑')

    this._editorFolder = null
    this._rebuildGizmos()
    this._rebuildEditor()
  }

  _placeHere() {
    const cam = this._exp.camera.instance
    const dir = new THREE.Vector3()
    cam.getWorldDirection(dir)

    const id  = this._nextId()
    const acc = {
      id,
      label:         FIELD_DEFAULTS.label,
      modelPath:     FIELD_DEFAULTS.modelPath,
      repairFile:    FIELD_DEFAULTS.repairFile,
      position:      { x: +cam.position.x.toFixed(2), y: FLOOR_Y, z: +cam.position.z.toFixed(2) },
      rotationY:     +Math.atan2(dir.x, dir.z).toFixed(3),
      triggerRadius: FIELD_DEFAULTS.triggerRadius,
      promptText:    FIELD_DEFAULTS.promptText,
    }
    this._accidents.push(acc)
    this._selectedId = id
    this._rebuildGizmos()
    this._rebuildEditor()
  }

  _delete() {
    if (!this._selectedId) return
    this._accidents = this._accidents.filter(a => a.id !== this._selectedId)
    this._selectedId = this._accidents[0]?.id ?? null
    this._rebuildGizmos()
    this._rebuildEditor()
  }

  async _save() {
    const body = { version: 1, accidents: this._accidents }
    try {
      const res = await fetch('/api/settings/city_accidents.json', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      this._toast(`Sauvegardé — ${this._accidents.length} accident(s)`, true)
    } catch (err) {
      console.error('[CityAccidentEditor] save failed:', err)
      this._toast('Échec de la sauvegarde', false)
    }
  }

  // ── lil-gui ────────────────────────────────────────────────────

  _rebuildEditor() {
    this._editorFolder?.destroy()
    this._editorFolder = this._root.addFolder('Sélection')

    if (!this._accidents.length) {
      this._editorFolder.add({ empty: '(aucun accident)' }, 'empty').name('—').disable()
      return
    }

    const ids = this._accidents.map(a => a.id)
    const sel = { id: this._selectedId ?? ids[0] }
    this._editorFolder.add(sel, 'id', ids).name('Accident').onChange(id => {
      this._selectedId = id
      this._rebuildEditor()
    })

    const acc = this._find(this._selectedId)
    if (!acc) return

    const f = this._editorFolder
    f.add(acc, 'label').name('label')
    f.add(acc, 'modelPath').name('modelPath')
    f.add(acc, 'repairFile').name('repairFile')
    f.add(acc, 'promptText').name('promptText')
    f.add(acc, 'rotationY', -Math.PI, Math.PI, 0.01).name('rotationY').onChange(() => this._syncGizmo(acc))
    f.add(acc, 'triggerRadius', 0.5, 12, 0.1).name('triggerRadius').onChange(() => this._syncGizmo(acc))
    f.add(acc.position, 'x', -512, 512, 0.1).name('pos X').onChange(() => this._syncGizmo(acc))
    f.add(acc.position, 'y',   -2,   8, 0.05).name('pos Y').onChange(() => this._syncGizmo(acc))
    f.add(acc.position, 'z', -512, 512, 0.1).name('pos Z').onChange(() => this._syncGizmo(acc))
    f.add({ del: () => this._delete() }, 'del').name('Supprimer')
  }

  // ── Gizmos ─────────────────────────────────────────────────────

  _rebuildGizmos() {
    this._gizmos.forEach(g => this._disposeGizmo(g))
    this._gizmos.clear()
    this._accidents.forEach(acc => {
      const gizmo = this._makeGizmo()
      this._exp.scene.add(gizmo)
      this._gizmos.set(acc.id, gizmo)
      this._syncGizmo(acc)
    })
  }

  _makeGizmo() {
    const group = new THREE.Group()

    const discGeo = new THREE.CylinderGeometry(1, 1, 0.04, 32)
    const discMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.18, depthWrite: false })
    const disc    = new THREE.Mesh(discGeo, discMat)
    disc.position.y = 0.02
    group.add(disc)

    const pinGeo = new THREE.ConeGeometry(0.18, 0.7, 12)
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc })
    const pin    = new THREE.Mesh(pinGeo, pinMat)
    pin.position.y = 1.0
    pin.rotation.x = Math.PI
    group.add(pin)

    const arrowGeo = new THREE.BoxGeometry(0.06, 0.06, 1.2)
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 })
    const arrow    = new THREE.Mesh(arrowGeo, arrowMat)
    arrow.position.set(0, 0.05, 0.6)
    group.add(arrow)

    group.userData = { disc, pin, arrow, discGeo, discMat, pinGeo, pinMat, arrowGeo, arrowMat }
    return group
  }

  _syncGizmo(acc) {
    const gizmo = this._gizmos.get(acc.id)
    if (!gizmo) return
    gizmo.position.set(acc.position.x, acc.position.y, acc.position.z)
    gizmo.rotation.y = acc.rotationY ?? 0
    gizmo.userData.disc.scale.set(acc.triggerRadius, 1, acc.triggerRadius)
  }

  _disposeGizmo(gizmo) {
    this._exp.scene.remove(gizmo)
    const u = gizmo.userData
    u.discGeo?.dispose();  u.discMat?.dispose()
    u.pinGeo?.dispose();   u.pinMat?.dispose()
    u.arrowGeo?.dispose(); u.arrowMat?.dispose()
  }

  // ── Divers ─────────────────────────────────────────────────────

  _toast(message, ok) {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position:   'fixed',
      top:        '16px',
      left:       '50%',
      transform:  'translateX(-50%)',
      padding:    '8px 16px',
      background: ok ? 'rgba(0,180,120,0.92)' : 'rgba(200,40,60,0.92)',
      color:      '#fff',
      font:       '12px/1.4 monospace',
      borderRadius: '6px',
      zIndex:     '11000',
      pointerEvents: 'none',
    })
    el.textContent = message
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 2200)
  }

  _nextId() {
    let id
    do { id = `acc_${++this._counter}` } while (this._accidents.some(a => a.id === id))
    return id
  }

  _find(id) {
    return this._accidents.find(a => a.id === id) ?? null
  }

  destroy() {
    this._gizmos.forEach(g => this._disposeGizmo(g))
    this._gizmos.clear()
    this._editorFolder?.destroy()
    this._root?.destroy()
  }
}
