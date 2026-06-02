// Cropping UI with draggable corners

import { CanvasViewport } from './viewport.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

// Target on-screen size for touch handles (radius in CSS pixels -> ~44px diameter).
const HANDLE_RADIUS_PX = 22
const EDGE_HANDLE_PX = 18
const STROKE_PX = 2

export class CropUI {
  constructor(canvas, svg) {
    this.canvas = canvas
    this.svg = svg
    this.corners = null
    this.image = null
    this.handleEls = {}
    this.polygonEl = null

    this.viewport = new CanvasViewport(this.svg.parentElement, this.svg, {
      hitTestHandle: (target) =>
        target.classList?.contains('corner-handle')
          ? target.getAttribute('data-corner')
          : null,
      onHandleDrag: (corner, x, y) => this.moveCorner(corner, x, y),
      onViewChange: () => this.updateHandleSizes()
    })
  }

  initialize(image) {
    this.image = image

    // Set canvas size to match image
    this.canvas.width = image.width
    this.canvas.height = image.height

    // Draw image on canvas
    const ctx = this.canvas.getContext('2d')
    ctx.drawImage(image, 0, 0)

    // Initialize corners to image edges
    this.corners = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: image.width, y: 0 },
      bottomRight: { x: image.width, y: image.height },
      bottomLeft: { x: 0, y: image.height }
    }

    // Set SVG size to match canvas AND add viewBox for proper scaling
    this.svg.setAttribute('width', image.width)
    this.svg.setAttribute('height', image.height)
    this.svg.setAttribute('viewBox', `0 0 ${image.width} ${image.height}`)
    this.svg.style.width = '100%'
    this.svg.style.height = '100%'

    this.viewport.attach(image)
    this.buildOverlay()
    this.updateGeometry()
    this.updateHandleSizes()
  }

  // Build the SVG elements once; never recreate them mid-drag.
  buildOverlay() {
    this.svg.innerHTML = ''
    this.handleEls = {}

    this.polygonEl = document.createElementNS(SVG_NS, 'polygon')
    this.polygonEl.setAttribute('fill', 'rgba(0, 120, 255, 0.1)')
    this.polygonEl.setAttribute('stroke', '#0078ff')
    this.svg.appendChild(this.polygonEl)

    Object.keys(this.corners).forEach((name) => {
      const circle = document.createElementNS(SVG_NS, 'circle')
      circle.setAttribute('fill', '#0078ff')
      circle.setAttribute('stroke', 'white')
      circle.setAttribute('class', 'corner-handle')
      circle.setAttribute('data-corner', name)
      circle.style.cursor = 'move'
      this.svg.appendChild(circle)
      this.handleEls[name] = circle
    })
  }

  // Update only positions on existing elements (no DOM rebuild during drag).
  updateGeometry() {
    const points = [
      `${this.corners.topLeft.x},${this.corners.topLeft.y}`,
      `${this.corners.topRight.x},${this.corners.topRight.y}`,
      `${this.corners.bottomRight.x},${this.corners.bottomRight.y}`,
      `${this.corners.bottomLeft.x},${this.corners.bottomLeft.y}`
    ].join(' ')
    this.polygonEl.setAttribute('points', points)

    Object.entries(this.corners).forEach(([name, pos]) => {
      const el = this.handleEls[name]
      el.setAttribute('cx', pos.x)
      el.setAttribute('cy', pos.y)
    })
  }

  // Keep handle radius + stroke a constant on-screen size at any zoom/resolution.
  updateHandleSizes() {
    if (!this.image || !this.polygonEl) return
    const r = this.viewport.pxToImageUnits(HANDLE_RADIUS_PX)
    const stroke = this.viewport.pxToImageUnits(STROKE_PX)
    this.polygonEl.setAttribute('stroke-width', stroke)
    Object.values(this.handleEls).forEach((el) => {
      el.setAttribute('r', r)
      el.setAttribute('stroke-width', stroke)
    })
  }

  moveCorner(name, logicalX, logicalY) {
    const x = Math.max(0, Math.min(this.image.width, logicalX))
    const y = Math.max(0, Math.min(this.image.height, logicalY))
    this.corners[name] = { x, y }
    this.updateGeometry()
  }

  reset() {
    if (!this.image) return

    this.corners = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: this.image.width, y: 0 },
      bottomRight: { x: this.image.width, y: this.image.height },
      bottomLeft: { x: 0, y: this.image.height }
    }

    this.viewport.resetView()
    this.updateGeometry()
    this.updateHandleSizes()
  }

  resetView() {
    this.viewport.resetView()
  }

  getCorners() {
    return this.corners
  }
}

// Simple bounding box crop
export function cropToBoundingBox(image, corners) {
  // Find bounding box
  const minX = Math.min(corners.topLeft.x, corners.topRight.x, corners.bottomLeft.x, corners.bottomRight.x)
  const maxX = Math.max(corners.topLeft.x, corners.topRight.x, corners.bottomLeft.x, corners.bottomRight.x)
  const minY = Math.min(corners.topLeft.y, corners.topRight.y, corners.bottomLeft.y, corners.bottomRight.y)
  const maxY = Math.max(corners.topLeft.y, corners.topRight.y, corners.bottomLeft.y, corners.bottomRight.y)

  const width = maxX - minX
  const height = maxY - minY

  // Create canvas and crop
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, minX, minY, width, height, 0, 0, width, height)

  return canvas
}

// Rectangular crop UI with draggable rectangle
export class RectangularCropUI {
  constructor(canvas, svg) {
    this.canvas = canvas
    this.svg = svg
    this.rect = null // { x, y, width, height }
    this.dragStart = null
    this.image = null
    this.rectEl = null
    this.handleEls = {}

    this.viewport = new CanvasViewport(this.svg.parentElement, this.svg, {
      hitTestHandle: (target) => {
        if (target.hasAttribute?.('data-handle')) return target.getAttribute('data-handle')
        if (target.classList?.contains('crop-rectangle')) return 'move'
        return null
      },
      onHandleDragStart: (mode, x, y) => this.beginDrag(mode, x, y),
      onHandleDrag: (mode, x, y) => this.applyDrag(mode, x, y),
      onHandleDragEnd: () => { this.dragStart = null },
      onViewChange: () => this.updateHandleSizes()
    })
  }

  initialize(image) {
    this.image = image

    // Set canvas
    this.canvas.width = image.width
    this.canvas.height = image.height
    const ctx = this.canvas.getContext('2d')
    ctx.drawImage(image, 0, 0)

    // Set SVG with viewBox for proper scaling
    this.svg.setAttribute('width', image.width)
    this.svg.setAttribute('height', image.height)
    this.svg.setAttribute('viewBox', `0 0 ${image.width} ${image.height}`)
    this.svg.style.width = '100%'
    this.svg.style.height = '100%'

    // Initialize rectangle (80% of image, centered)
    const margin = 0.1
    this.rect = {
      x: image.width * margin,
      y: image.height * margin,
      width: image.width * (1 - 2 * margin),
      height: image.height * (1 - 2 * margin)
    }

    this.viewport.attach(image)
    this.buildOverlay()
    this.updateGeometry()
    this.updateHandleSizes()
  }

  buildOverlay() {
    this.svg.innerHTML = ''
    this.handleEls = {}

    this.rectEl = document.createElementNS(SVG_NS, 'rect')
    this.rectEl.setAttribute('fill', 'rgba(0, 120, 255, 0.1)')
    this.rectEl.setAttribute('stroke', '#0078ff')
    this.rectEl.setAttribute('class', 'crop-rectangle')
    this.rectEl.style.cursor = 'move'
    this.svg.appendChild(this.rectEl)

    // Corner handles (circles)
    ;['tl', 'tr', 'bl', 'br'].forEach((pos) => {
      const circle = document.createElementNS(SVG_NS, 'circle')
      circle.setAttribute('fill', '#0078ff')
      circle.setAttribute('stroke', 'white')
      circle.setAttribute('class', 'resize-handle')
      circle.setAttribute('data-handle', `resize-${pos}`)
      circle.style.cursor = this.getResizeCursor(pos)
      this.svg.appendChild(circle)
      this.handleEls[pos] = circle
    })

    // Edge handles (squares)
    ;['top', 'bottom', 'left', 'right'].forEach((edge) => {
      const rect = document.createElementNS(SVG_NS, 'rect')
      rect.setAttribute('fill', '#0078ff')
      rect.setAttribute('stroke', 'white')
      rect.setAttribute('class', 'resize-handle')
      rect.setAttribute('data-handle', `resize-${edge}`)
      rect.style.cursor = this.getResizeCursor(edge)
      this.svg.appendChild(rect)
      this.handleEls[edge] = rect
    })
  }

  updateGeometry() {
    const r = this.rect
    this.rectEl.setAttribute('x', r.x)
    this.rectEl.setAttribute('y', r.y)
    this.rectEl.setAttribute('width', r.width)
    this.rectEl.setAttribute('height', r.height)

    const positions = {
      tl: [r.x, r.y],
      tr: [r.x + r.width, r.y],
      bl: [r.x, r.y + r.height],
      br: [r.x + r.width, r.y + r.height],
      top: [r.x + r.width / 2, r.y],
      bottom: [r.x + r.width / 2, r.y + r.height],
      left: [r.x, r.y + r.height / 2],
      right: [r.x + r.width, r.y + r.height / 2]
    }

    Object.entries(positions).forEach(([key, [cx, cy]]) => {
      const el = this.handleEls[key]
      if (el.tagName === 'circle') {
        el.setAttribute('cx', cx)
        el.setAttribute('cy', cy)
      } else {
        // Edge square: position is set relative to its size in updateHandleSizes;
        // store the center so we can recompute when the size changes.
        el._cx = cx
        el._cy = cy
        const half = (this._edgeHalf ?? 0)
        el.setAttribute('x', cx - half)
        el.setAttribute('y', cy - half)
      }
    })
  }

  updateHandleSizes() {
    if (!this.image || !this.rectEl) return
    const r = this.viewport.pxToImageUnits(HANDLE_RADIUS_PX)
    const edge = this.viewport.pxToImageUnits(EDGE_HANDLE_PX)
    const stroke = this.viewport.pxToImageUnits(STROKE_PX)
    this._edgeHalf = edge / 2

    this.rectEl.setAttribute('stroke-width', stroke)
    Object.values(this.handleEls).forEach((el) => {
      el.setAttribute('stroke-width', stroke)
      if (el.tagName === 'circle') {
        el.setAttribute('r', r)
      } else {
        el.setAttribute('width', edge)
        el.setAttribute('height', edge)
        if (el._cx != null) {
          el.setAttribute('x', el._cx - this._edgeHalf)
          el.setAttribute('y', el._cy - this._edgeHalf)
        }
      }
    })
  }

  getResizeCursor(position) {
    const cursors = {
      'tl': 'nwse-resize',
      'tr': 'nesw-resize',
      'bl': 'nesw-resize',
      'br': 'nwse-resize',
      'top': 'ns-resize',
      'bottom': 'ns-resize',
      'left': 'ew-resize',
      'right': 'ew-resize'
    }
    return cursors[position] || 'move'
  }

  beginDrag(mode, imgX, imgY) {
    this.dragStart = {
      x: imgX,
      y: imgY,
      rect: { ...this.rect }
    }
  }

  applyDrag(mode, imgX, imgY) {
    if (!this.dragStart) return

    const dx = imgX - this.dragStart.x
    const dy = imgY - this.dragStart.y

    if (mode === 'move') {
      this.rect.x = this.constrain(this.dragStart.rect.x + dx, 0, this.image.width - this.rect.width)
      this.rect.y = this.constrain(this.dragStart.rect.y + dy, 0, this.image.height - this.rect.height)
    } else {
      this.handleResize(mode, dx, dy)
    }

    this.updateGeometry()
  }

  handleResize(mode, dx, dy) {
    const start = this.dragStart.rect
    const minSize = 50 // Minimum rectangle size

    switch (mode) {
      case 'resize-tl':
        this.rect.x = Math.max(0, Math.min(start.x + dx, start.x + start.width - minSize))
        this.rect.y = Math.max(0, Math.min(start.y + dy, start.y + start.height - minSize))
        this.rect.width = start.width - (this.rect.x - start.x)
        this.rect.height = start.height - (this.rect.y - start.y)
        break
      case 'resize-tr':
        this.rect.y = Math.max(0, Math.min(start.y + dy, start.y + start.height - minSize))
        this.rect.width = Math.max(minSize, Math.min(start.width + dx, this.image.width - start.x))
        this.rect.height = start.height - (this.rect.y - start.y)
        break
      case 'resize-bl':
        this.rect.x = Math.max(0, Math.min(start.x + dx, start.x + start.width - minSize))
        this.rect.width = start.width - (this.rect.x - start.x)
        this.rect.height = Math.max(minSize, Math.min(start.height + dy, this.image.height - start.y))
        break
      case 'resize-br':
        this.rect.width = Math.max(minSize, Math.min(start.width + dx, this.image.width - start.x))
        this.rect.height = Math.max(minSize, Math.min(start.height + dy, this.image.height - start.y))
        break
      case 'resize-top':
        this.rect.y = Math.max(0, Math.min(start.y + dy, start.y + start.height - minSize))
        this.rect.height = start.height - (this.rect.y - start.y)
        break
      case 'resize-bottom':
        this.rect.height = Math.max(minSize, Math.min(start.height + dy, this.image.height - start.y))
        break
      case 'resize-left':
        this.rect.x = Math.max(0, Math.min(start.x + dx, start.x + start.width - minSize))
        this.rect.width = start.width - (this.rect.x - start.x)
        break
      case 'resize-right':
        this.rect.width = Math.max(minSize, Math.min(start.width + dx, this.image.width - start.x))
        break
    }
  }

  constrain(value, min, max) {
    return Math.max(min, Math.min(value, max))
  }

  reset() {
    if (!this.image) return

    const margin = 0.1
    this.rect = {
      x: this.image.width * margin,
      y: this.image.height * margin,
      width: this.image.width * (1 - 2 * margin),
      height: this.image.height * (1 - 2 * margin)
    }

    this.viewport.resetView()
    this.updateGeometry()
    this.updateHandleSizes()
  }

  resetView() {
    this.viewport.resetView()
  }

  getRectangle() {
    return this.rect
  }
}

// Apply rectangular crop
export function applyRectangularCrop(image, rect) {
  const canvas = document.createElement('canvas')
  canvas.width = rect.width
  canvas.height = rect.height

  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height)

  return canvas
}
