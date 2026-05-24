import * as THREE             from '/lib/three.js'
import FpsController          from '../../FpsController.js'
import CrosshairTarget        from '../../CrosshairTarget.js'
import QuestManager           from '../../quest/QuestManager.js'
import QuestIndicatorManager  from '../../quest/QuestIndicatorManager.js'
import DialogueManager        from '../../dialogue/DialogueManager.js'
import PcScreen               from '../../PcScreen.js'
import { buildOctree }        from '../../buildOctree.js'
import VoiceBabble            from '../../sound/VoiceBabble.js'
import GlassesManager         from '../../glasses/GlassesManager.js'
import { OBJECTS, PROXIMITY, SCENE, ACT_LABEL } from './AtelierEndSceneConfig.js'

const RECAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  *,html,body{margin:0;padding:0;box-sizing:border-box;}
  body{
    background:#0a0a0a;color:#fff;
    font-family:'Courier New',monospace;
    padding:48px;height:100vh;
    display:flex;flex-direction:column;gap:20px;
  }
  .corp{font-size:11px;letter-spacing:.2em;color:rgba(255,255,255,.3);}
  .title{font-size:20px;font-weight:700;letter-spacing:.08em;margin-top:4px;}
  hr{border:none;border-top:1px solid rgba(255,255,255,.1);}
  .label{font-size:9px;letter-spacing:.18em;color:rgba(255,255,255,.3);margin-bottom:10px;}
  ul{list-style:none;display:flex;flex-direction:column;gap:14px;}
  li{display:flex;align-items:center;gap:14px;font-size:14px;color:rgba(255,255,255,.8);}
  .ok{color:#4caf72;}
  .status{font-size:12px;color:rgba(255,255,255,.35);}
  .status b{color:#4caf72;}
  .spacer{flex:1;}
  button{
    padding:16px 32px;
    background:rgba(255,255,255,.08);
    border:1px solid rgba(255,255,255,.2);border-radius:3px;
    color:#fff;font-family:inherit;font-size:12px;font-weight:700;
    letter-spacing:.12em;text-transform:uppercase;
    cursor:pointer;transition:background .15s,border-color .15s;
  }
  button:hover{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.4);}
</style>
</head>
<body>
  <p class="corp">NEXORA CORP.</p>
  <p class="title">RAPPORT DE MISSION</p>
  <hr>
  <p class="label">MISSIONS EFFECTUÉES</p>
  <ul>
    <li><span class="ok">✓</span> Briefing avec le technicien</li>
    <li><span class="ok">✓</span> Accès au PC de bureau</li>
    <li><span class="ok">✓</span> Récupération de l'équipement AR</li>
    <li><span class="ok">✓</span> Sortie du bureau sécurisé</li>
  </ul>
  <hr>
  <p class="status">Statut : <b>OPÉRATIONNEL</b></p>
  <div class="spacer"></div>
  <button onclick="window.parent.postMessage({type:'pcscreen:confirm'},'*')">
    Valider et terminer la mission &rarr;
  </button>
</body>
</html>`

export default class AtelierEndSceneWorld {
  constructor(experience, callbacks = {}) {
    this.experience = experience
    this.scene      = experience.scene
    this.camera     = experience.camera
    this.resources  = experience.resources
    this.sound      = experience.sound
    this._callbacks = callbacks

    this.scene.background = new THREE.Color(0x1a1a1a)
    this.scene.fog = new THREE.Fog(0x1a1a1a, 20, 60)

    this.dialogue = new DialogueManager()
    experience.setDialogue(this.dialogue)

    this._glasses = new GlassesManager()
    this._callbacks.onGlassesReady?.(this._glasses)

    this.resources.on('ready', () => this._setup())
  }

  _setup() {
    this._setupLights()
    this._setupModel()
    if (SCENE.USE_BUILTIN_FLOOR) this._setupFloor()
    this._setupFps()
    this._setupPcScreen()
    this._setupQuest()
    // Le joueur arrive avec les lunettes portées depuis la scène précédente
    this._glasses.equip()
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0xfff5e0, 0.4)
    this.scene.add(ambient)

    const ceiling = new THREE.DirectionalLight(0xfff5e0, 1.5)
    ceiling.position.set(2, 8, 4)
    ceiling.castShadow = true
    ceiling.shadow.mapSize.set(2048, 2048)
    ceiling.shadow.camera.near   = 0.1
    ceiling.shadow.camera.far    = 30
    ceiling.shadow.camera.left   = -8
    ceiling.shadow.camera.right  =  8
    ceiling.shadow.camera.top    =  8
    ceiling.shadow.camera.bottom = -8
    this.scene.add(ceiling)

    const fill = new THREE.DirectionalLight(0x80a0ff, 0.3)
    fill.position.set(-5, 3, -2)
    this.scene.add(fill)
  }

  _setupModel() {
    const gltf = this.resources.items.atelier
    if (!gltf) return

    this.model = gltf.scene

    this.model.traverse(child => {
      if (child.isMesh) {
        child.castShadow    = true
        child.receiveShadow = true
      }
    })

    this.scene.add(this.model)
    this.experience.renderProfile.apply(this.scene)

    if (this.experience.debug.active) {
      const meshNames = []
      this.model.traverse(c => { if (c.isMesh) meshNames.push(c.name) })
      console.log('[AtelierEndSceneWorld] meshes GLTF :', meshNames)
    }

    if (gltf.cameras?.length > 0) {
      const gltfCam = gltf.cameras[0]
      gltfCam.updateWorldMatrix(true, false)

      const pos  = new THREE.Vector3()
      const quat = new THREE.Quaternion()
      gltfCam.matrixWorld.decompose(pos, quat, new THREE.Vector3())

      this.camera.instance.position.copy(pos)
      this.camera.instance.quaternion.copy(quat)
    } else {
      this.camera.instance.position.set(0, 1.7, 0)
      this.camera.instance.lookAt(0, 1.7, -1)
    }
  }

  _setupFloor() {
    const geo = new THREE.PlaneGeometry(30, 30)
    const mat = new THREE.MeshStandardMaterial({
      color:     0x2a2a2a,
      roughness: 0.9,
      metalness: 0.1,
    })
    const floor = new THREE.Mesh(geo, mat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)

    this._floorGeo = geo
    this._floorMat = mat
  }

  _setupFps() {
    this._fps             = new FpsController(this.experience, buildOctree(this.scene))
    this._crosshairTarget = new CrosshairTarget(this.experience)
    this.experience.interaction.setFpsMode(true)

    this.dialogue.on('open',     () => {
      this._fps.enabled = false
      this._fps.controls.unlock()
    })
    this.dialogue.on('complete', () => {
      this._fps.enabled = true
      this._fps.lock()
    })

    this._voice = new VoiceBabble(this.experience.sound, this.dialogue, {
      Technicien: { freq: 600 },
    })

    this._callbacks.onFpsReady?.(this._fps)
  }

  _setupPcScreen() {
    const mesh = this.model?.getObjectByName(OBJECTS.SCREEN)
    if (!mesh) {
      console.warn(`AtelierEndSceneWorld: mesh "${OBJECTS.SCREEN}" introuvable`)
      return
    }
    this._pcScreen = new PcScreen(this.experience, mesh)
    this._pcScreen.setFpsController(this._fps)

    // Le bouton "Valider" dans le srcdoc envoie pcscreen:confirm
    this._onPcMsg = (e) => {
      if (e.data?.type !== 'pcscreen:confirm') return
      this._pcScreen.exit()
      this._callbacks.onGameEnd?.()
    }
    window.addEventListener('message', this._onPcMsg)

    // Charge le HTML de recap directement dans l'iframe
    this._pcScreen._iframe.srcdoc = RECAP_HTML
  }

  _setupQuest() {
    const { interaction } = this.experience

    const glassesMesh = this.model?.getObjectByName(OBJECTS.TOOL)
    const pc          = this.model?.getObjectByName(OBJECTS.PC)

    // Rend les lunettes invisibles mais garde le mesh raycastable pour l'outline.
    // On sauvegarde le matériau d'origine pour le restaurer quand elles sont posées.
    this._glassesMeshChildren = []
    this._glassesMats = []
    glassesMesh?.traverse(child => {
      if (!child.isMesh) return
      const ghost = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      this._glassesMeshChildren.push({ child, original: child.material })
      child.material = ghost
      this._glassesMats.push(ghost)
    })

    if (glassesMesh) interaction.registerProximity(glassesMesh, 'glasses_spot', PROXIMITY.TOOL)
    if (pc)          interaction.registerProximity(pc,          'pc',           PROXIMITY.PC)

    const steps = [
      {
        id:      'drop_glasses',
        label:   'Déposer les lunettes',
        hint:    'Approchez-vous du support et appuyez sur E',
        trigger: { type: 'interact', id: 'glasses_spot' },
        indicator: { type: 'item' },
        onComplete: () => {
          interaction.unregister('glasses_spot')
          // Restaure le matériau GLB d'origine → les lunettes redeviennent visibles
          this._glassesMeshChildren.forEach(({ child, original }) => {
            child.material = original
          })
          this._glasses.unequip()
        },
      },
      {
        id:      'pc_recap',
        label:   'Consulter le rapport de mission',
        hint:    'Approchez-vous du PC et appuyez sur E',
        trigger: { type: 'interact', id: 'pc' },
        indicator: { type: 'pc' },
        onComplete: () => {
          this._pcScreen?.enter()
        },
      },
    ]

    const meshMap = { glasses_spot: glassesMesh, pc }

    this._quest     = new QuestManager(this.experience, steps, this._callbacks)
    this._indicator = new QuestIndicatorManager(this.experience, this._quest, meshMap)

    this._callbacks.onQuestReady?.(this._quest, { act: ACT_LABEL })
    this._callbacks.onIndicatorReady?.(this._indicator)
    this._callbacks.onDialogueReady?.(this.dialogue)
    this._quest.start()
  }

  update() {
    this._fps?.update(this.experience.time.delta)
    this._crosshairTarget?.update()
    this._pcScreen?.update(this.experience.time.delta)
    this._indicator?.update(this.experience.time.delta)
  }

  resize() {
    this._pcScreen?.resize()
  }

  dispose() {
    window.removeEventListener('message', this._onPcMsg)
    this.sound.stopAll()
    this._indicator?.destroy()
    this._quest?.dispose()
    this._glasses?.destroy()
    this._voice?.dispose()
    this.dialogue.dispose()
    this._fps?.dispose()
    this._crosshairTarget?.dispose()
    this._pcScreen?.dispose()
    this.experience.interaction.setFpsMode(false)

    this._glassesMats?.forEach(m => m.dispose())

    if (SCENE.USE_BUILTIN_FLOOR) {
      this._floorGeo?.dispose()
      this._floorMat?.dispose()
    }

    if (this.model) {
      this.experience.renderProfile.restore(this.scene)
      this.model.traverse(child => {
        child.geometry?.dispose()
        if (child.material && child.material !== this.experience.renderProfile.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach(m => m.dispose?.())
        }
      })
    }
  }
}
