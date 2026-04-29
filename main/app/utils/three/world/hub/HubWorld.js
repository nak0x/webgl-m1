import * as THREE       from 'three'
import FpsController   from '../../FpsController.js'
import CrosshairTarget from '../../CrosshairTarget.js'
import DialogueManager from '../../dialogue/DialogueManager.js'
import QuestManager    from '../../quest/QuestManager.js'
import { buildOctree } from '../../buildOctree.js'
import { OBJECTS, PROXIMITY } from './HubConfig.js'

export default class HubWorld {
  constructor(experience, callbacks = {}) {
    this.experience = experience
    this.scene      = experience.scene
    this.camera     = experience.camera
    this._callbacks = callbacks

    this.scene.background = new THREE.Color(0x111118)
    this.scene.fog = new THREE.Fog(0x111118, 25, 70)

    this.dialogue = new DialogueManager()
    experience.setDialogue(this.dialogue)

    experience.resources.on('ready', () => this._setup())
  }

  _setup() {
    this._setupLights()
    this._setupModel()
    this._setupFps()
    this._setupQuest()
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xfff5e0, 0.5))

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.8)
    sun.position.set(3, 8, 4)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near   = 0.1
    sun.shadow.camera.far    = 30
    sun.shadow.camera.left   = -10
    sun.shadow.camera.right  =  10
    sun.shadow.camera.top    =  10
    sun.shadow.camera.bottom = -10
    this.scene.add(sun)

    const fill = new THREE.DirectionalLight(0x8090ff, 0.25)
    fill.position.set(-5, 3, -3)
    this.scene.add(fill)
  }

  _setupModel() {
    const gltf = this.experience.resources.items.atelierScene2
    if (!gltf) return

    this.model = gltf.scene
    this.model.traverse(child => {
      if (child.isMesh) {
        child.castShadow    = true
        child.receiveShadow = true
      }
    })
    this.scene.add(this.model)

    if (gltf.cameras?.length > 0) {
      const gltfCam = gltf.cameras[0]
      gltfCam.updateWorldMatrix(true, false)
      const pos  = new THREE.Vector3()
      const quat = new THREE.Quaternion()
      gltfCam.matrixWorld.decompose(pos, quat, new THREE.Vector3())
      this.camera.instance.position.copy(pos)
      this.camera.instance.quaternion.copy(quat)
    } else {
      this.camera.instance.position.set(0, 2, 6)
      this.camera.instance.lookAt(0, 1, 0)
    }

    if (this.experience.debug.active) {
      const names = []
      this.model.traverse(c => { if (c.isMesh) names.push(c.name) })
      console.log('[HubWorld] meshes GLTF :', names)
    }
  }

  _setupFps() {
    this._fps             = new FpsController(this.experience, buildOctree(this.scene))
    this._crosshairTarget = new CrosshairTarget(this.experience)
    this.experience.interaction.setFpsMode(true)

    this.dialogue.on('open',     () => { this._fps.enabled = false; this._fps.controls.unlock() })
    this.dialogue.on('complete', () => { this._fps.enabled = true;  this._fps.lock() })

    this._callbacks.onFpsReady?.(this._fps)
  }

  _setupQuest() {
    const { interaction } = this.experience

    const wrench      = this.model?.getObjectByName(OBJECTS.WRENCH)
    const screwdriver = this.model?.getObjectByName(OBJECTS.SCREWDRIVER)
    const screwBox    = this.model?.getObjectByName(OBJECTS.SCREW_BOX)
    const door        = this.model?.getObjectByName(OBJECTS.DOOR)

    if (wrench)      interaction.registerProximity(wrench,      'wrench',      PROXIMITY.WRENCH)
    if (screwdriver) interaction.registerProximity(screwdriver, 'screwdriver', PROXIMITY.SCREWDRIVER)
    if (screwBox)    interaction.registerProximity(screwBox,    'screw_box',   PROXIMITY.SCREW_BOX)
    if (door)        interaction.registerProximity(door,        'door',        PROXIMITY.DOOR)

    const steps = [
      {
        id:      'pick_wrench',
        label:   'Récupérer la clé à molette',
        hint:    'Approchez-vous et appuyez sur E',
        trigger: { type: 'interact', id: 'wrench' },
        onComplete: () => {
          wrench?.removeFromParent()
          interaction.unregister('wrench')
        },
      },
      {
        id:      'pick_screwdriver',
        label:   'Récupérer le tournevis',
        hint:    'Approchez-vous du tournevis et appuyez sur E',
        trigger: { type: 'interact', id: 'screwdriver' },
        onComplete: () => {
          screwdriver?.removeFromParent()
          interaction.unregister('screwdriver')
        },
      },
      {
        id:      'pick_screw_box',
        label:   'Récupérer la boîte de vis',
        hint:    'Approchez-vous de la boîte de vis et appuyez sur E',
        trigger: { type: 'interact', id: 'screw_box' },
        onComplete: () => {
          screwBox?.removeFromParent()
          interaction.unregister('screw_box')
        },
      },
      {
        id:      'exit_door',
        label:   'Sortir par la porte',
        hint:    'Approchez-vous de la porte et appuyez sur E',
        trigger: { type: 'interact', id: 'door' },
        onComplete: (callbacks) => {
          callbacks.transitionTo?.('scene_3')
        },
      },
    ]

    this._quest = new QuestManager(this.experience, steps, this._callbacks)
    this._callbacks.onQuestReady?.(this._quest)
    this._callbacks.onDialogueReady?.(this.dialogue)
    this._quest.start()
  }

  update() {
    this._fps?.update(this.experience.time.delta)
    this._crosshairTarget?.update()
  }

  resize() {}

  dispose() {
    this._quest?.dispose()
    this.dialogue.dispose()
    this._fps?.dispose()
    this._crosshairTarget?.dispose()
    this.experience.interaction.setFpsMode(false)

    if (this.model) {
      this.model.traverse(child => {
        child.geometry?.dispose()
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach(m => m.dispose?.())
        }
      })
    }
  }
}
