import * as THREE        from 'three'
import FpsController    from '../FpsController.js'
import CrosshairTarget  from '../CrosshairTarget.js'
import QuestManager     from '../quest/QuestManager.js'
import PcScreen         from '../PcScreen.js'
import DialogueManager  from '../dialogue/DialogueManager.js'
import { OBJECTS, PROXIMITY, SCENE } from './AtelierConfig.js'

export default class AtelierWorld {
  constructor(experience, callbacks = {}) {
    this.experience  = experience
    this.scene       = experience.scene
    this.camera      = experience.camera
    this.resources   = experience.resources
    this._callbacks  = callbacks

    this.scene.background = new THREE.Color(0x1a1a1a)
    this.scene.fog = new THREE.Fog(0x1a1a1a, 20, 60)

    // Le World possède son DialogueManager — Experience en garde la référence
    this.dialogue = new DialogueManager()
    experience.setDialogue(this.dialogue)

    this.resources.on('ready', () => this._setup())
  }

  _setup() {
    this._setupLights()
    this._setupModel()
    if (SCENE.USE_BUILTIN_FLOOR) this._setupFloor()
    this._setupFps()
    this._setupPcScreen()
    this._setupQuest()
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

    if (this.experience.debug.active) {
      const meshNames = []
      this.model.traverse(c => { if (c.isMesh) meshNames.push(c.name) })
      console.log('[AtelierWorld] meshes GLTF :', meshNames)
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
    this._fps             = new FpsController(this.experience)
    this._crosshairTarget = new CrosshairTarget(this.experience)
    this.experience.interaction.setFpsMode(true)

    this.dialogue.on('open',     () => {
      this._fps.enabled = false
      this._fps.controls.unlock()
    })
    this.dialogue.on('complete', () => {
      this._fps.enabled = true
    })
  }

  _setupPcScreen() {
    const mesh = this.model?.getObjectByName(OBJECTS.SCREEN)
    if (!mesh) {
      console.warn(`AtelierWorld: mesh "${OBJECTS.SCREEN}" introuvable`)
      return
    }
    this._pcScreen = new PcScreen(this.experience, mesh)
    this._pcScreen.setFpsController(this._fps)
  }

  _setupQuest() {
    const { interaction } = this.experience

    const npc  = this.model?.getObjectByName(OBJECTS.NPC)
    const pc   = this.model?.getObjectByName(OBJECTS.PC)
    const tool = this.model?.getObjectByName(OBJECTS.TOOL)
    const door = this.model?.getObjectByName(OBJECTS.DOOR)

    if (npc)  interaction.registerProximity(npc,  'npc',  PROXIMITY.NPC)
    if (pc)   interaction.registerProximity(pc,   'pc',   PROXIMITY.PC)
    if (tool) interaction.registerProximity(tool, 'tool', PROXIMITY.TOOL)
    if (door) interaction.registerProximity(door, 'door', PROXIMITY.DOOR)

    const steps = [
      {
        id:      'talk_npc',
        label:   'Parler au technicien',
        hint:    'Approchez-vous et appuyez sur E',
        trigger: { type: 'interact', id: 'npc' },
        dialogue: [
          { speaker: 'Technicien', text: 'Ah, vous êtes enfin là.' },
          { speaker: 'Technicien', text: 'Votre mission : accéder au PC et récupérer le dossier.' },
          { speaker: 'Technicien', text: 'L\'outil dont vous aurez besoin est dans l\'atelier.' },
        ],
      },
      {
        id:      'use_pc',
        label:   'Accéder au PC de bureau',
        hint:    'Approchez-vous du PC et appuyez sur E',
        trigger: { type: 'interact', id: 'pc' },
        onComplete: () => {
          this._pcScreen?.enter()
        },
      },
      {
        id:      'pick_tool',
        label:   'Récupérer l\'outil',
        hint:    'L\'outil se trouve dans l\'atelier',
        trigger: { type: 'interact', id: 'tool' },
        onComplete: () => {
          this.toolPickedUp = true
          tool?.removeFromParent()
          interaction.unregister('tool')
        },
      },
      {
        id:      'exit_door',
        label:   'Sortir du bureau',
        hint:    'Approchez-vous de la porte et appuyez sur E',
        trigger: { type: 'interact', id: 'door' },
        onComplete: (callbacks) => {
          callbacks.transitionTo?.('scene2')
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
    this._pcScreen?.update(this.experience.time.delta)
  }

  resize() {
    this._pcScreen?.resize()
  }

  dispose() {
    this._quest?.dispose()
    this.dialogue.dispose()
    this._fps?.dispose()
    this._crosshairTarget?.dispose()
    this._pcScreen?.dispose()
    this.experience.interaction.setFpsMode(false)

    if (SCENE.USE_BUILTIN_FLOOR) {
      this._floorGeo?.dispose()
      this._floorMat?.dispose()
    }

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
