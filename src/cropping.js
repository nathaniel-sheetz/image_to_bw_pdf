// Cropping UI with draggable corners

export class CropUI {
  constructor(canvas, svg) {
    this.canvas = canvas
    this.svg = svg
    this.corners = null
    this.draggedCorner = null
    this.image = null

    this.setupEventListeners()
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

    this.render()
  }

  render() {
    // Clear SVG
    this.svg.innerHTML = ''

    // Draw lines connecting corners
    const lines = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
    const points = [
      `${this.corners.topLeft.x},${this.corners.topLeft.y}`,
      `${this.corners.topRight.x},${this.corners.topRight.y}`,
      `${this.corners.bottomRight.x},${this.corners.bottomRight.y}`,
      `${this.corners.bottomLeft.x},${this.corners.bottomLeft.y}`
    ].join(' ')

    lines.setAttribute('points', points)
    lines.setAttribute('fill', 'rgba(0, 120, 255, 0.1)')
    lines.setAttribute('stroke', '#0078ff')
    lines.setAttribute('stroke-width', '2')
    this.svg.appendChild(lines)

    // Draw corner circles
    Object.entries(this.corners).forEach(([name, pos]) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', pos.x)
      circle.setAttribute('cy', pos.y)
      circle.setAttribute('r', '20')  // Increased from 8 to 20 for mobile touch targets
      circle.setAttribute('fill', '#0078ff')
      circle.setAttribute('stroke', 'white')
      circle.setAttribute('stroke-width', '3')  // Increased from 2 to 3
      circle.setAttribute('class', 'corner-handle')
      circle.setAttribute('data-corner', name)
      circle.style.cursor = 'move'
      this.svg.appendChild(circle)
    })
  }

  getScale() {
    // Get the ratio between CSS display size and logical canvas size
    const rect = this.svg.getBoundingClientRect()
    const scaleX = this.image.width / rect.width
    const scaleY = this.image.height / rect.height
    return { scaleX, scaleY, rect }
  }

  setupEventListeners() {
    // Mouse events
    this.svg.addEventListener('mousedown', this.onDragStart.bind(this))
    document.addEventListener('mousemove', this.onDrag.bind(this))
    document.addEventListener('mouseup', this.onDragEnd.bind(this))

    // Touch events
    this.svg.addEventListener('touchstart', this.onDragStart.bind(this))
    document.addEventListener('touchmove', this.onDrag.bind(this))
    document.addEventListener('touchend', this.onDragEnd.bind(this))
  }

  onDragStart(e) {
    console.log('[CropUI.onDragStart] FIRED', {
      type: e.type,
      target: e.target.tagName,
      corner: e.target.getAttribute('data-corner'),
      touches: e.touches?.length,
      cancelable: e.cancelable,
      timeStamp: e.timeStamp
    })

    const target = e.target
    if (target.classList.contains('corner-handle')) {
      e.preventDefault()
      this.draggedCorner = target.getAttribute('data-corner')
      console.log('[CropUI.onDragStart] Set draggedCorner to:', this.draggedCorner)
    }
  }

  onDrag(e) {
    console.log('[CropUI.onDrag] FIRED', {
      type: e.type,
      draggedCorner: this.draggedCorner,
      touches: e.touches?.length,
      timeStamp: e.timeStamp
    })

    if (!this.draggedCorner) {
      console.warn('[CropUI.onDrag] draggedCorner is NULL - drag stopped!')
      return
    }

    e.preventDefault()

    // Get scale factors
    const { scaleX, scaleY, rect } = this.getScale()

    // Get coordinates relative to SVG
    let clientX, clientY

    if (e.type.startsWith('touch')) {
      if (e.touches.length === 0) return
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    // Transform CSS pixels to logical canvas pixels
    const cssX = clientX - rect.left
    const cssY = clientY - rect.top
    const logicalX = cssX * scaleX
    const logicalY = cssY * scaleY

    // Constrain to image bounds
    const constrainedX = Math.max(0, Math.min(this.image.width, logicalX))
    const constrainedY = Math.max(0, Math.min(this.image.height, logicalY))

    // Update corner position
    this.corners[this.draggedCorner] = { x: constrainedX, y: constrainedY }

    this.render()
  }

  onDragEnd(e) {
    console.log('[CropUI.onDragEnd] FIRED', {
      type: e.type,
      draggedCorner: this.draggedCorner,
      timeStamp: e.timeStamp
    })

    this.draggedCorner = null
  }

  reset() {
    if (!this.image) return

    this.corners = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: this.image.width, y: 0 },
      bottomRight: { x: this.image.width, y: this.image.height },
      bottomLeft: { x: 0, y: this.image.height }
    }

    this.render()
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
    this.dragMode = null // 'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | 'resize-top' | 'resize-bottom' | 'resize-left' | 'resize-right'
    this.dragStart = null
    this.image = null

    this.setupEventListeners()
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

    this.render()
  }

  render() {
    // Clear SVG
    this.svg.innerHTML = ''

    // Draw rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('x', this.rect.x)
    rect.setAttribute('y', this.rect.y)
    rect.setAttribute('width', this.rect.width)
    rect.setAttribute('height', this.rect.height)
    rect.setAttribute('fill', 'rgba(0, 120, 255, 0.1)')
    rect.setAttribute('stroke', '#0078ff')
    rect.setAttribute('stroke-width', '2')
    rect.setAttribute('class', 'crop-rectangle')
    rect.style.cursor = 'move'
    this.svg.appendChild(rect)

    // Draw corner handles
    this.drawHandle('tl', this.rect.x, this.rect.y)
    this.drawHandle('tr', this.rect.x + this.rect.width, this.rect.y)
    this.drawHandle('bl', this.rect.x, this.rect.y + this.rect.height)
    this.drawHandle('br', this.rect.x + this.rect.width, this.rect.y + this.rect.height)

    // Draw edge handles
    this.drawEdgeHandle('top', this.rect.x + this.rect.width / 2, this.rect.y)
    this.drawEdgeHandle('bottom', this.rect.x + this.rect.width / 2, this.rect.y + this.rect.height)
    this.drawEdgeHandle('left', this.rect.x, this.rect.y + this.rect.height / 2)
    this.drawEdgeHandle('right', this.rect.x + this.rect.width, this.rect.y + this.rect.height / 2)
  }

  drawHandle(position, x, y) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', x)
    circle.setAttribute('cy', y)
    circle.setAttribute('r', '16')  // Increased from 8 to 16 for mobile touch targets
    circle.setAttribute('fill', '#0078ff')
    circle.setAttribute('stroke', 'white')
    circle.setAttribute('stroke-width', '2')
    circle.setAttribute('class', 'resize-handle')
    circle.setAttribute('data-handle', `resize-${position}`)
    circle.style.cursor = this.getResizeCursor(position)
    this.svg.appendChild(circle)
  }

  drawEdgeHandle(edge, x, y) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('x', x - 4)
    rect.setAttribute('y', y - 4)
    rect.setAttribute('width', '8')
    rect.setAttribute('height', '8')
    rect.setAttribute('fill', '#0078ff')
    rect.setAttribute('stroke', 'white')
    rect.setAttribute('stroke-width', '2')
    rect.setAttribute('class', 'resize-handle')
    rect.setAttribute('data-handle', `resize-${edge}`)
    rect.style.cursor = this.getResizeCursor(edge)
    this.svg.appendChild(rect)
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

  getScale() {
    const rect = this.svg.getBoundingClientRect()
    const scaleX = this.image.width / rect.width
    const scaleY = this.image.height / rect.height
    return { scaleX, scaleY, rect }
  }

  setupEventListeners() {
    this.svg.addEventListener('mousedown', this.onDragStart.bind(this))
    document.addEventListener('mousemove', this.onDrag.bind(this))
    document.addEventListener('mouseup', this.onDragEnd.bind(this))

    this.svg.addEventListener('touchstart', this.onDragStart.bind(this))
    document.addEventListener('touchmove', this.onDrag.bind(this))
    document.addEventListener('touchend', this.onDragEnd.bind(this))
  }

  onDragStart(e) {
    console.log('[RectangularCropUI.onDragStart] FIRED', {
      type: e.type,
      target: e.target.tagName,
      handle: e.target.getAttribute('data-handle'),
      touches: e.touches?.length,
      cancelable: e.cancelable,
      timeStamp: e.timeStamp
    })

    e.preventDefault()

    const target = e.target
    if (target.hasAttribute('data-handle')) {
      this.dragMode = target.getAttribute('data-handle')
    } else if (target.classList.contains('crop-rectangle')) {
      this.dragMode = 'move'
    } else {
      return
    }

    console.log('[RectangularCropUI.onDragStart] Set dragMode to:', this.dragMode)

    const { scaleX, scaleY, rect } = this.getScale()
    const clientX = e.clientX || e.touches[0].clientX
    const clientY = e.clientY || e.touches[0].clientY

    // Store CSS coordinates and scale factors
    this.dragStart = {
      cssX: clientX - rect.left,
      cssY: clientY - rect.top,
      scaleX,
      scaleY,
      rect: { ...this.rect }
    }
  }

  onDrag(e) {
    console.log('[RectangularCropUI.onDrag] FIRED', {
      type: e.type,
      dragMode: this.dragMode,
      touches: e.touches?.length,
      timeStamp: e.timeStamp
    })

    if (!this.dragMode || !this.dragStart) {
      console.warn('[RectangularCropUI.onDrag] dragMode or dragStart is NULL - drag stopped!')
      return
    }

    e.preventDefault()

    const { scaleX, scaleY, rect } = this.getScale()
    const clientX = e.clientX || (e.touches && e.touches[0].clientX)
    const clientY = e.clientY || (e.touches && e.touches[0].clientY)

    if (!clientX || !clientY) return

    // Calculate delta in CSS pixels
    const cssDx = (clientX - rect.left) - this.dragStart.cssX
    const cssDy = (clientY - rect.top) - this.dragStart.cssY

    // Transform to logical pixels
    const dx = cssDx * scaleX
    const dy = cssDy * scaleY

    if (this.dragMode === 'move') {
      this.rect.x = this.constrain(this.dragStart.rect.x + dx, 0, this.image.width - this.rect.width)
      this.rect.y = this.constrain(this.dragStart.rect.y + dy, 0, this.image.height - this.rect.height)
    } else {
      this.handleResize(dx, dy)
    }

    this.render()
  }

  handleResize(dx, dy) {
    const start = this.dragStart.rect
    const minSize = 50 // Minimum rectangle size

    switch (this.dragMode) {
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

  onDragEnd(e) {
    console.log('[RectangularCropUI.onDragEnd] FIRED', {
      type: e.type,
      dragMode: this.dragMode,
      timeStamp: e.timeStamp
    })

    this.dragMode = null
    this.dragStart = null
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

    this.render()
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
