// Shared zoom/pan + pointer plumbing for the crop overlays.
//
// Wraps a canvas + SVG overlay pair and applies a single CSS transform to a
// wrapper element so the image and overlay always stay aligned. Handles all
// pointer-event bookkeeping (mouse, touch, pen) via the Pointer Events API and
// arbitrates between three gestures:
//   - 2 pointers              -> pinch-zoom + two-finger pan
//   - 1 pointer on a handle   -> delegated to the host's drag handlers
//   - 1 pointer on background  -> pan
//
// The host (CropUI / RectangularCropUI) supplies callbacks that decide whether a
// pointer target is a draggable handle and how to apply a drag.

const MIN_ZOOM = 1
const MAX_ZOOM = 8

export class CanvasViewport {
  /**
   * @param {HTMLElement} wrapper - element that gets the CSS transform (holds canvas + svg)
   * @param {SVGSVGElement} svg - overlay element (pointer events are bound here)
   * @param {object} handlers
   * @param {(target: EventTarget) => any} handlers.hitTestHandle - return a handle id/descriptor if the target is draggable, else null
   * @param {(handle: any, imgX: number, imgY: number) => void} handlers.onHandleDragStart
   * @param {(handle: any, imgX: number, imgY: number) => void} handlers.onHandleDrag
   * @param {(handle: any) => void} handlers.onHandleDragEnd
   * @param {() => void} [handlers.onViewChange] - called whenever zoom/pan changes (for resizing handles)
   */
  constructor(wrapper, svg, handlers) {
    this.wrapper = wrapper
    this.svg = svg
    this.handlers = handlers
    this.image = null

    this.zoom = 1
    this.panX = 0
    this.panY = 0

    // Active pointers keyed by pointerId.
    this.pointers = new Map()
    // The handle being dragged (single-pointer handle gesture).
    this.activeHandle = null
    this.activeHandlePointerId = null
    // Pinch gesture bookkeeping.
    this.pinchStart = null
    // Background pan bookkeeping.
    this.panPointerId = null
    this.panStart = null

    this.setupEventListeners()
  }

  attach(image) {
    this.image = image
    this.resetView()
  }

  setupEventListeners() {
    this.svg.addEventListener('pointerdown', this.onPointerDown.bind(this))
    this.svg.addEventListener('pointermove', this.onPointerMove.bind(this))
    this.svg.addEventListener('pointerup', this.onPointerUp.bind(this))
    this.svg.addEventListener('pointercancel', this.onPointerUp.bind(this))
    window.addEventListener('resize', () => this.handlers.onViewChange?.())
  }

  // --- Coordinate helpers -------------------------------------------------

  // svg.getBoundingClientRect() already reflects the CSS transform, so the
  // ratio image.width / rect.width stays correct under any zoom/pan.
  getScale() {
    const rect = this.svg.getBoundingClientRect()
    return {
      scaleX: this.image.width / rect.width,
      scaleY: this.image.height / rect.height,
      rect
    }
  }

  clientToImage(clientX, clientY) {
    const { scaleX, scaleY, rect } = this.getScale()
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  // Convert a desired on-screen pixel size into image-space units, so overlay
  // handles render at a constant size regardless of image resolution or zoom.
  pxToImageUnits(screenPx) {
    const { scaleX } = this.getScale()
    return screenPx * scaleX
  }

  // --- View transform -----------------------------------------------------

  applyTransform() {
    this.wrapper.style.transform =
      `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`
    this.handlers.onViewChange?.()
  }

  resetView() {
    this.zoom = 1
    this.panX = 0
    this.panY = 0
    this.applyTransform()
  }

  clampPan() {
    // Keep the (scaled) wrapper from being dragged entirely out of its container.
    const container = this.wrapper.parentElement
    if (!container) return
    const cw = container.clientWidth
    const ch = container.clientHeight
    const sw = cw * this.zoom
    const sh = ch * this.zoom
    // Allowed pan range: never reveal more than the container edges.
    const minX = Math.min(0, cw - sw)
    const minY = Math.min(0, ch - sh)
    this.panX = Math.max(minX, Math.min(0, this.panX))
    this.panY = Math.max(minY, Math.min(0, this.panY))
  }

  // --- Pointer handling ---------------------------------------------------

  onPointerDown(e) {
    this.svg.setPointerCapture(e.pointerId)
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // Second finger down -> start a pinch and cancel any single-pointer gesture.
    if (this.pointers.size === 2) {
      this.endHandleDrag()
      this.panPointerId = null
      this.panStart = null
      this.beginPinch()
      e.preventDefault()
      return
    }

    if (this.pointers.size > 2) return

    // Single pointer: handle drag if it landed on a handle, else pan.
    const handle = this.handlers.hitTestHandle(e.target)
    if (handle != null) {
      e.preventDefault()
      this.activeHandle = handle
      this.activeHandlePointerId = e.pointerId
      const { x, y } = this.clientToImage(e.clientX, e.clientY)
      this.handlers.onHandleDragStart?.(handle, x, y)
    } else {
      e.preventDefault()
      this.panPointerId = e.pointerId
      this.panStart = { panX: this.panX, panY: this.panY, x: e.clientX, y: e.clientY }
    }
  }

  onPointerMove(e) {
    if (!this.pointers.has(e.pointerId)) return
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (this.pinchStart && this.pointers.size >= 2) {
      e.preventDefault()
      this.updatePinch()
      return
    }

    if (this.activeHandle != null && e.pointerId === this.activeHandlePointerId) {
      e.preventDefault()
      const { x, y } = this.clientToImage(e.clientX, e.clientY)
      this.handlers.onHandleDrag?.(this.activeHandle, x, y)
      return
    }

    if (this.panPointerId === e.pointerId && this.panStart) {
      e.preventDefault()
      this.panX = this.panStart.panX + (e.clientX - this.panStart.x)
      this.panY = this.panStart.panY + (e.clientY - this.panStart.y)
      this.clampPan()
      this.applyTransform()
    }
  }

  onPointerUp(e) {
    this.pointers.delete(e.pointerId)
    if (this.svg.hasPointerCapture?.(e.pointerId)) {
      this.svg.releasePointerCapture(e.pointerId)
    }

    if (this.activeHandle != null && e.pointerId === this.activeHandlePointerId) {
      this.endHandleDrag()
    }
    if (this.panPointerId === e.pointerId) {
      this.panPointerId = null
      this.panStart = null
    }

    // Once fewer than 2 pointers remain, the pinch gesture is over.
    if (this.pointers.size < 2) {
      this.pinchStart = null
    }
  }

  endHandleDrag() {
    if (this.activeHandle != null) {
      this.handlers.onHandleDragEnd?.(this.activeHandle)
    }
    this.activeHandle = null
    this.activeHandlePointerId = null
  }

  // --- Pinch gesture ------------------------------------------------------

  beginPinch() {
    const pts = [...this.pointers.values()]
    const mid = this.midpoint(pts[0], pts[1])
    this.pinchStart = {
      dist: this.distance(pts[0], pts[1]),
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
      midX: mid.x,
      midY: mid.y
    }
  }

  updatePinch() {
    const pts = [...this.pointers.values()]
    if (pts.length < 2) return

    const dist = this.distance(pts[0], pts[1])
    const start = this.pinchStart
    const rawZoom = start.zoom * (dist / start.dist)
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, rawZoom))

    // Zoom about the gesture's starting midpoint (in container space) so the
    // content under the fingers stays put.
    const container = this.wrapper.parentElement
    const cRect = container.getBoundingClientRect()
    const anchorX = start.midX - cRect.left
    const anchorY = start.midY - cRect.top

    const ratio = newZoom / start.zoom
    this.zoom = newZoom
    this.panX = anchorX - (anchorX - start.panX) * ratio
    this.panY = anchorY - (anchorY - start.panY) * ratio

    // Follow two-finger pan by the midpoint drift.
    const mid = this.midpoint(pts[0], pts[1])
    this.panX += mid.x - start.midX
    this.panY += mid.y - start.midY

    this.clampPan()
    this.applyTransform()
  }

  distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }
}
