import * as THREE from '/lib/three.js'
import Resources     from '../../Resources.js'
import { assetPath } from '../../../assetPath.js'

/**
 * CityAccidentManager — runtime ville.
 *
 * Pose les véhicules accidentés lus depuis city_accidents.json, enregistre une
 * zone d'interaction (sphère) par accident, affiche un prompt « E » à l'entrée,
 * et déclenche onEnterRepair(accident) à l'appui sur E dans la zone.
 *
 * Les trigger zones n'alimentent pas `_aimedId` de l'InteractionManager (réservé
 * au crosshair) : on écoute donc KeyE localement, gardé par la zone active.
 */
export default class CityAccidentManager {
  constructor(experience, accidents, { onEnterRepair, onPromptShow, onPromptHide } = {}) {
    this._exp           = experience
    this._accidents     = accidents ?? []
    this._onEnterRepair = onEnterRepair
    this._onPromptShow  = onPromptShow
    this._onPromptHide  = onPromptHide
    this._models        = new Map()   // id → THREE.Object3D
    this._activeId      = null

    const { interaction } = experience
    this._onTriggerEnter = ({ id }) => this._handleEnter(id)
    this._onTriggerLeave = ({ id }) => this._handleLeave(id)
    interaction.on('trigger:enter', this._onTriggerEnter)
    interaction.on('trigger:leave', this._onTriggerLeave)

    this._onKeyDown = this._onKeyDown.bind(this)
    window.addEventListener('keydown', this._onKeyDown)
  }

  async loadModels() {
    const sources = this._accidents
      .filter(a => a.modelPath)
      .map(a => ({ name: a.id, type: a.modelPath.toLowerCase().endsWith('.glb') ? 'glb' : 'gltf', path: assetPath(a.modelPath) }))

    if (!sources.length) return

    await new Promise(resolve => {
      const res = new Resources(sources)
      res.on('ready', () => {
        this._accidents.forEach(a => {
          const gltf = res.items[a.id]
          if (gltf?.scene) this._models.set(a.id, gltf.scene)
        })
        resolve()
      })
    })
  }

  spawn() {
    const { scene, interaction } = this._exp

    this._accidents.forEach(a => {
      const model = this._models.get(a.id)
      if (model) {
        model.position.set(a.position.x, a.position.y, a.position.z)
        model.rotation.y = a.rotationY ?? 0
        model.traverse(c => {
          if (c.isMesh) { c.castShadow = true; c.receiveShadow = true }
        })
        scene.add(model)
      }

      const center = new THREE.Vector3(a.position.x, a.position.y + 1, a.position.z)
      const zone   = new THREE.Sphere(center, a.triggerRadius ?? 3.5)
      interaction.registerTriggerZone(zone, a.id)
    })
  }

  _handleEnter(id) {
    if (!this._isAccident(id)) return
    this._activeId = id
    const acc = this._find(id)
    this._onPromptShow?.(acc?.promptText ?? 'Appuyez sur E pour réparer')
  }

  _handleLeave(id) {
    if (this._activeId !== id) return
    this._activeId = null
    this._onPromptHide?.()
  }

  _onKeyDown(e) {
    if (e.code !== 'KeyE' || !this._activeId) return
    const acc = this._find(this._activeId)
    if (!acc) return
    this._onPromptHide?.()
    this._onEnterRepair?.(acc)
  }

  destroy() {
    const { scene, interaction } = this._exp

    window.removeEventListener('keydown', this._onKeyDown)
    interaction.off('trigger:enter', this._onTriggerEnter)
    interaction.off('trigger:leave', this._onTriggerLeave)
    interaction.unregisterAll(this._accidents.map(a => a.id))

    this._models.forEach(model => {
      scene.remove(model)
      model.traverse(c => {
        c.geometry?.dispose()
        const mats = Array.isArray(c.material) ? c.material : [c.material]
        mats.forEach(m => m?.dispose?.())
      })
    })

    this._models.clear()
    this._onPromptHide?.()
    this._activeId = null
  }

  _isAccident(id) {
    return this._accidents.some(a => a.id === id)
  }

  _find(id) {
    return this._accidents.find(a => a.id === id) ?? null
  }
}
