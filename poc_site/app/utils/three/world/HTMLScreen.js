/**
 * HTMLScreen — écran 3D avec iframe HTML dans l'espace 3D via CSS3DObject
 *
 * Un div contenant une <iframe> est placé dans la scène Three.js.
 * Scale 0.002 → 1600px × 0.002 = 3.2 THREE units = largeur du bezel.
 *
 * L'iframe charge n'importe quel fichier HTML local (depuis /public/).
 * Le fichier HTML peut communiquer avec Three.js via postMessage.
 *
 * Messages entrants (iframe → parent) :
 *   { type: 'itemClick', label: string }  — item cliqué dans l'iframe
 *   { type: 'close' }                     — l'iframe demande à se fermer
 *   { type: 'cardClose' }                 — sélection annulée
 *
 * Messages sortants (parent → iframe) :
 *   world.htmlScreen.send({ type: 'anything' })
 *
 * Pointer events :
 *   Le container CSS3DRenderer est pointer-events:none (géré dans ScreenWorld).
 *   Seul le div racine est pointer-events:auto → OrbitControls fonctionne ailleurs.
 *
 * Usage :
 *   new HTMLScreen(experience, '/screens/test.html', callbacks)
 */
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js'

const W     = 1600
const H     = 1000
const SCALE = 0.002  // 1600 × 0.002 = 3.2 THREE units

export default class HTMLScreen {
  constructor(experience, src = '/screens/test.html', callbacks = {}) {
    this.experience = experience
    this.scene      = experience.scene
    this._src       = src
    this._callbacks = callbacks

    this._buildDOM()
    this._setupObject()
    this._listenMessages()

    console.log(`HTML Screen created — src: ${src}`)
  }

  // ════════════════════════════════════════════════════════════
  //  DOM
  // ════════════════════════════════════════════════════════════

  _buildDOM() {
    // Wrapper (nécessaire pour border-radius + overflow sur l'iframe)
    this._root = document.createElement('div')
    this._root.style.cssText = `
      width: ${W}px;
      height: ${H}px;
      border-radius: 14px;
      overflow: hidden;
      background: #000;
      pointer-events: auto;
    `

    // Iframe — charge le fichier HTML
    this._iframe = document.createElement('iframe')
    this._iframe.src = this._src
    this._iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    `
    // Empêche le scroll de buller vers OrbitControls
    this._iframe.setAttribute('scrolling', 'no')

    this._root.appendChild(this._iframe)
  }

  // ════════════════════════════════════════════════════════════
  //  CSS3DObject
  // ════════════════════════════════════════════════════════════

  _setupObject() {
    this._object = new CSS3DObject(this._root)
    this._object.position.set(0, 1.6, 0.05)  // légèrement devant le bezel WebGL
    this._object.scale.setScalar(SCALE)
    this.scene.add(this._object)
  }

  // ════════════════════════════════════════════════════════════
  //  Communication postMessage
  // ════════════════════════════════════════════════════════════

  _listenMessages() {
    this._onMessage = (e) => {
      const data = e.data
      if (!data || typeof data !== 'object') return

      switch (data.type) {
        case 'itemClick':
          console.log(`Item clicked: ${data.label}`)
          this._callbacks.onItemClick?.(data.label)
          break

        case 'close':
          console.log('Screen closed by iframe')
          this._callbacks.onClose?.()
          break

        case 'cardClose':
          this._callbacks.onCardClose?.()
          break

        default:
          // Transmet tous les autres messages au callback générique
          this._callbacks.onMessage?.(data)
      }
    }
    window.addEventListener('message', this._onMessage)
  }

  /**
   * Envoie un message à l'iframe (parent → iframe).
   * @param {object} data
   */
  send(data) {
    this._iframe.contentWindow?.postMessage(data, '*')
  }

  // ════════════════════════════════════════════════════════════
  //  Lifecycle
  // ════════════════════════════════════════════════════════════

  dispose() {
    window.removeEventListener('message', this._onMessage)
    this.scene.remove(this._object)
    this._root.remove()
  }
}
