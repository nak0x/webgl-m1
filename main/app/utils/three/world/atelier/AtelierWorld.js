import * as THREE        from '/lib/three.js'
import { clone as skeletonClone } from '/lib/addons/utils/SkeletonUtils.js'
import FpsController    from '../../FpsController.js'
import CrosshairTarget  from '../../CrosshairTarget.js'
import QuestManager          from '../../quest/QuestManager.js'
import QuestIndicatorManager from '../../quest/QuestIndicatorManager.js'
import PcScreen         from '../../PcScreen.js'
import DialogueManager  from '../../dialogue/DialogueManager.js'
import { buildOctree } from '../../buildOctree.js'
import VoiceBabble   from '../../sound/VoiceBabble.js'
import GlassesManager from '../../glasses/GlassesManager.js'
import { usePcState } from '~/composables/usePcState.js'
import { OBJECTS, PROXIMITY, SCENE, ACT_LABEL, CHARACTER_1, CHARACTER_2 } from './AtelierConfig.js'

export default class AtelierWorld {
  constructor(experience, callbacks = {}) {
    this.experience  = experience
    this.scene       = experience.scene
    this.camera      = experience.camera
    this.resources   = experience.resources
    this.sound       = experience.sound
    this._callbacks  = callbacks

    this.scene.background = new THREE.Color(0x1a1a1a)
    this.scene.fog = new THREE.Fog(0x1a1a1a, 20, 60)

    // Le World possède son DialogueManager — Experience en garde la référence
    this.dialogue = new DialogueManager()
    experience.setDialogue(this.dialogue)

    this._glasses = new GlassesManager()
    experience.setGlasses(this._glasses)
    this._callbacks.onGlassesReady?.(this._glasses)

    this._characters = []

    this.resources.on('ready', () => this._setup())
  }

  _setup() {
    this._setupLights()
    this._setupModel()
    if (SCENE.USE_BUILTIN_FLOOR) this._setupFloor()
    this._setupCharacters()
    this._setupFps()
    this._setupPcScreen()
    this._setupQuest()
    this._setupAmbient()
    this._exempleInteractionProximity()
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

  _setupCharacters() {
    const gltf = this.resources.items.character
    if (!gltf) {
      console.warn('AtelierWorld: character GLB introuvable')
      return
    }

    this._spawnCharacter(gltf, CHARACTER_1, 'npc',         'Character 1 (NPC)')
    this._spawnCharacter(gltf, CHARACTER_2, 'character_2', 'Character 2')
    this._setupCharacterDialogueSync()
  }

  _spawnCharacter(gltf, cfg, id, debugLabel) {
    const mesh = skeletonClone(gltf.scene)
    const { position: p, rotation: r, scale: s } = cfg

    mesh.position.set(p.x, p.y, p.z)
    mesh.rotation.y = r.y
    mesh.scale.setScalar(s)

    mesh.traverse(child => {
      if (child.isMesh) {
        child.castShadow    = true
        child.receiveShadow = true
      }
    })

    this.scene.add(mesh)

    let mixer    = null
    let nodAction = null
    if (gltf.animations?.length > 0) {
      mixer = new THREE.AnimationMixer(mesh)
      const nodClip = gltf.animations.find(a => a.name === 'Nod')
      if (nodClip) {
        nodAction = mixer.clipAction(nodClip)
        nodAction.setLoop(THREE.LoopRepeat)
      } else {
        console.warn(`AtelierWorld: animation "Nod" introuvable sur ${id}. Clips dispo :`, gltf.animations.map(a => a.name))
      }
    }

    const proximityKey = id === 'npc' ? 'CHARACTER_1' : 'CHARACTER_2'
    this.experience.interaction.registerProximity(mesh, id, PROXIMITY[proximityKey])

    const entry = { mesh, mixer, nodAction, id, debugFolder: null }
    this._characters.push(entry)

    if (this.experience.debug.active) {
      entry.debugFolder = this._addCharacterDebugFolder(mesh, debugLabel, id)
    }
  }

  _setupCharacterDialogueSync() {
    let lastId = null

    this.experience.interaction.on('interact', e => { lastId = e.id })

    this.dialogue.on('open', () => {
      const entry = this._characters.find(c => c.id === lastId)
      entry?.nodAction?.reset().play()
    })

    this.dialogue.on('complete', () => {
      const entry = this._characters.find(c => c.id === lastId)
      entry?.nodAction?.stop()
    })
  }

  _addCharacterDebugFolder(mesh, label, configKey) {
    const pos = mesh.position
    const rot = mesh.rotation
    const scl = mesh.scale

    const state = {
      x:     pos.x,
      y:     pos.y,
      z:     pos.z,
      rotY:  rot.y,
      scale: scl.x,
    }

    const folder = this.experience.debug.gui.addFolder(label)
    folder.open()

    folder.add(state, 'x',    -20,      20,       0.01).name('pos X') .onChange(v => { pos.x = v })
    folder.add(state, 'y',    -5,        5,        0.01).name('pos Y') .onChange(v => { pos.y = v })
    folder.add(state, 'z',    -20,      20,       0.01).name('pos Z') .onChange(v => { pos.z = v })
    folder.add(state, 'rotY', -Math.PI,  Math.PI,  0.01).name('rot Y') .onChange(v => { rot.y = v })
    folder.add(state, 'scale', 0.01,     5,        0.01).name('scale') .onChange(v => { scl.setScalar(v) })

    folder.add({
      log: () => console.log(
        `${configKey}: { position: { x: ${pos.x.toFixed(3)}, y: ${pos.y.toFixed(3)}, z: ${pos.z.toFixed(3)} }, rotation: { y: ${rot.y.toFixed(3)} }, scale: ${scl.x.toFixed(3)} }`
      )
    }, 'log').name('⬇ Log in console')

    return folder
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
      'Collègue 1':           { freq: 480 },
      'Collègue 2':           { freq: 380 },
      'Le personnage (Vous)': { freq: 520 },
    })

    this._callbacks.onFpsReady?.(this._fps)
  }

  _setupPcScreen() {
    const mesh = this.model?.getObjectByName(OBJECTS.SCREEN)
    if (!mesh) {
      console.warn(`AtelierWorld: mesh "${OBJECTS.SCREEN}" introuvable`)
      return
    }
    mesh.raycast = () => {}
    this._pcScreen = new PcScreen(this.experience, mesh, '/crm-scenario.html')
    this._pcScreen.setFpsController(this._fps)
    const pc = usePcState()
    this._keyboardHandle = null
    this._pcScreen.setCallbacks({
      onEnter: () => {
        this._keyboardHandle = this.experience.sound.play('keyboard', { loop: true })
        pc.enter()
      },
      onExit: () => {
        this._keyboardHandle?.stop()
        this._keyboardHandle = null
        pc.exit()
      },
      onTutoDone: pc.setTutoDone,
    })
  }

  _setupQuest() {
    const { interaction } = this.experience

    // 'npc' est déjà enregistré sur character_1 dans _setupCharacters()
    const npc  = this._characters[0]?.mesh ?? null
    const pc   = this.model?.getObjectByName(OBJECTS.PC)
    const tool = this.model?.getObjectByName(OBJECTS.TOOL)
    const door = this.model?.getObjectByName(OBJECTS.DOOR)

    if (pc)   interaction.registerProximity(pc,   'pc',   PROXIMITY.PC)
    if (tool) interaction.registerProximity(tool, 'tool', PROXIMITY.TOOL)
    if (door) interaction.registerProximity(door, 'door', PROXIMITY.DOOR)

    const steps = [
      {
        id:        'talk_npc',
        label:     'Discuter avec ses collègues',
        hint:      'Allez à la rencontre de l\'équipe pour prendre les nouvelles du matin.',
        trigger:   { type: 'interact', id: 'npc' },
        indicator: { type: 'npc' },
        dialogue: [
          { speaker: 'Collègue 1', text: "Salut ! Alors, prêt à tester les nouvelles lunettes ce matin ? Nous avons déjà plusieurs alertes qui sont priorisées en fonction de l’urgence sociale." },
          { speaker: 'Le personnage (Vous)', text: "Salut ! Oui, curieux de voir ce que ça donne. C’est vrai que la réception des alertes était un peu compliquée jusque là." },
          { speaker: 'Collègue 2', text: "Tu vas voir, les lunettes combinées au CRM fluidifient pas mal les choses. Prends ton café, connecte-toi à l'interface de l'Atelier, et dis-nous si la prise en main est aussi intuitive qu'ils le disent !" }
        ],
      },
      {
        id:        'use_pc',
        label:     'Se connecter à l\'ordinateur pour voir le planning de la journée',
        hint:      'Ouvrez le CRM sur l\'ordinateur de l\'atelier pour consulter les alertes en cours.',
        trigger:   { type: 'interact', id: 'pc' },
        indicator: { type: 'pc' },
        onComplete: () => {
          this._pcScreen?.enter()
        },
      },
      {
        id:        'pick_tool',
        label:     'Prendre ses lunettes de réalité augmentée',
        hint:      'Récupérez vos lunettes de réalité augmentée sur l\'établi avant de partir en intervention.',
        trigger:   { type: 'interact', id: 'tool' },
        indicator: { type: 'item' },
        onComplete: () => {
          this.toolPickedUp = true
          tool?.removeFromParent()
          interaction.unregister('tool')
          this.experience.sound.play('pick_object')
          this._glasses.equip()
          this._glasses.notify({
            id:       'glasses_on',
            title:    'Lunettes AR activées',
            text:     'Système opérationnel. Navigation disponible.',
            permanent: false,
            duration:  5000,
          })
          this.experience.sound.play('notification')
        },
      },
      {
        id:        'exit_door',
        label:     'Sortir de l\'atelier',
        hint:      'Dirigez-vous vers la porte principale pour vous rendre sur le terrain.',
        trigger:   { type: 'interact', id: 'door' },
        indicator: { type: 'door' },
        onComplete: (callbacks) => {
          this.experience.sound.play('door')
          callbacks.transitionTo?.('scene_2')
        },
      },
    ]

    const meshMap = { npc, pc, tool, door }

    this._quest = new QuestManager(this.experience, steps, this._callbacks)
    this._indicator = new QuestIndicatorManager(this.experience, this._quest, meshMap)

    this._callbacks.onQuestReady?.(this._quest, { act: ACT_LABEL })
    this._callbacks.onIndicatorReady?.(this._indicator)
    this._callbacks.onDialogueReady?.(this.dialogue)
    this._quest.start()
  }

  _setupAmbient() {
    this._ambientHandle = this.experience.sound.play('repair_ambient', { loop: true })
  }

  _exempleInteractionProximity() {
    const { interaction, sound } = this.experience

    interaction.on('proximity:enter', e => {
      if (e.id === 'npc' || e.id === 'character_2') {

      }
    })

    const CLIC_IDS = new Set(['npc', 'pc', 'character_2'])
    interaction.on('interact', e => {
      if (CLIC_IDS.has(e.id)) sound.play('clic')
    })
  }

  update() {
    this._fps?.update(this.experience.time.delta)
    this._crosshairTarget?.update()
    this._pcScreen?.update(this.experience.time.delta)
    this._indicator?.update(this.experience.time.delta)
    const dt = this.experience.time.delta / 1000
    this._characters.forEach(c => c.mixer?.update(dt))
  }

  resize() {
    this._pcScreen?.resize()
  }

  dispose() {
    this._ambientHandle?.stop()
    this._keyboardHandle?.stop()
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

    if (SCENE.USE_BUILTIN_FLOOR) {
      this._floorGeo?.dispose()
      this._floorMat?.dispose()
    }

    this._characters.forEach(c => {
      c.debugFolder?.destroy()
      c.mixer?.stopAllAction()
      this.experience.interaction.unregister(c.id)
      c.mesh.traverse(child => {
        child.geometry?.dispose()
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        mats.forEach(m => m?.dispose())
      })
      this.scene.remove(c.mesh)
    })
    this._characters = []

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
