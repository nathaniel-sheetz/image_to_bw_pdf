// Adaptive thresholding using integral image for fast local mean calculation

// Build integral image for O(1) region sum queries
function buildIntegralImage(gray, width, height) {
  const integral = new Float64Array(width * height)

  // Build integral image where each pixel stores sum of all pixels above and to the left
  for (let y = 0; y < height; y++) {
    let rowSum = 0
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      rowSum += gray[idx]

      if (y === 0) {
        integral[idx] = rowSum
      } else {
        integral[idx] = rowSum + integral[(y - 1) * width + x]
      }
    }
  }

  return integral
}

// Calculate sum of rectangular region using integral image
// Formula: sum = D - B - C + A
// Where: A = top-left, B = top-right, C = bottom-left, D = bottom-right
function getRegionSum(integral, width, x1, y1, x2, y2) {
  const A = (x1 > 0 && y1 > 0) ? integral[(y1 - 1) * width + (x1 - 1)] : 0
  const B = (y1 > 0) ? integral[(y1 - 1) * width + x2] : 0
  const C = (x1 > 0) ? integral[y2 * width + (x1 - 1)] : 0
  const D = integral[y2 * width + x2]

  return D - B - C + A
}

// Build integral image of squared pixel values, used for O(1) variance queries
function buildSquaredIntegralImage(gray, width, height) {
  const integral = new Float64Array(width * height)

  for (let y = 0; y < height; y++) {
    let rowSum = 0
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const v = gray[idx]
      rowSum += v * v

      if (y === 0) {
        integral[idx] = rowSum
      } else {
        integral[idx] = rowSum + integral[(y - 1) * width + x]
      }
    }
  }

  return integral
}

// Apply mean adaptive thresholding to convert grayscale to pure black & white
export function adaptiveThreshold(sourceCanvas, blockSize = 11, constantC = 2) {
  try {
    // Validate block size is odd
    if (blockSize % 2 === 0) {
      blockSize = blockSize + 1
    }

    // Create output canvas
    const canvas = document.createElement('canvas')
    canvas.width = sourceCanvas.width
    canvas.height = sourceCanvas.height
    const ctx = canvas.getContext('2d')

    // Copy source image
    ctx.drawImage(sourceCanvas, 0, 0)

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const width = canvas.width
    const height = canvas.height

    // Extract grayscale values (R channel, since R=G=B in grayscale image)
    const gray = new Uint8ClampedArray(width * height)
    for (let i = 0; i < width * height; i++) {
      gray[i] = data[i * 4]  // R channel
    }

    // Build integral image for fast region sum calculation
    const integral = buildIntegralImage(gray, width, height)

    // Apply adaptive threshold
    const halfBlock = Math.floor(blockSize / 2)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Calculate region bounds (clamped to image boundaries)
        const x1 = Math.max(0, x - halfBlock)
        const y1 = Math.max(0, y - halfBlock)
        const x2 = Math.min(width - 1, x + halfBlock)
        const y2 = Math.min(height - 1, y + halfBlock)

        // Calculate mean of region using integral image
        const count = (x2 - x1 + 1) * (y2 - y1 + 1)
        const sum = getRegionSum(integral, width, x1, y1, x2, y2)
        const mean = sum / count

        // Calculate threshold for this pixel
        const threshold = mean - constantC
        const idx = y * width + x
        const pixelValue = gray[idx]

        // Apply threshold: white if above threshold, black otherwise
        const output = pixelValue > threshold ? 255 : 0

        // Write to all RGB channels (creating pure B&W)
        const dataIdx = idx * 4
        data[dataIdx] = output      // R
        data[dataIdx + 1] = output  // G
        data[dataIdx + 2] = output  // B
        // Alpha channel unchanged at dataIdx + 3
      }
    }

    // Write processed data back to canvas
    ctx.putImageData(imageData, 0, 0)

    return canvas
  } catch (error) {
    console.error('Adaptive threshold error:', error)
    return null
  }
}

// Sauvola adaptive thresholding: T = mean * (1 + k * (std/R - 1))
// Better than mean-only thresholding for documents with stains, bleed-through,
// or uneven lighting because the threshold drops in low-variance (uniform)
// regions, suppressing background, while staying near the mean at text edges.
export function sauvolaThreshold(sourceCanvas, windowSize = 15, k = 0.2, R = 128) {
  try {
    if (windowSize % 2 === 0) {
      windowSize = windowSize + 1
    }

    const canvas = document.createElement('canvas')
    canvas.width = sourceCanvas.width
    canvas.height = sourceCanvas.height
    const ctx = canvas.getContext('2d')

    ctx.drawImage(sourceCanvas, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const width = canvas.width
    const height = canvas.height

    const gray = new Uint8ClampedArray(width * height)
    for (let i = 0; i < width * height; i++) {
      gray[i] = data[i * 4]
    }

    const integral = buildIntegralImage(gray, width, height)
    const sqIntegral = buildSquaredIntegralImage(gray, width, height)

    const halfWindow = Math.floor(windowSize / 2)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const x1 = Math.max(0, x - halfWindow)
        const y1 = Math.max(0, y - halfWindow)
        const x2 = Math.min(width - 1, x + halfWindow)
        const y2 = Math.min(height - 1, y + halfWindow)

        const count = (x2 - x1 + 1) * (y2 - y1 + 1)
        const sum = getRegionSum(integral, width, x1, y1, x2, y2)
        const sqSum = getRegionSum(sqIntegral, width, x1, y1, x2, y2)

        const mean = sum / count
        // Clamp to 0 to guard against negative variance from float drift
        const variance = Math.max(0, sqSum / count - mean * mean)
        const std = Math.sqrt(variance)

        const threshold = mean * (1 + k * (std / R - 1))
        const idx = y * width + x
        const pixelValue = gray[idx]

        const output = pixelValue > threshold ? 255 : 0

        const dataIdx = idx * 4
        data[dataIdx] = output
        data[dataIdx + 1] = output
        data[dataIdx + 2] = output
      }
    }

    ctx.putImageData(imageData, 0, 0)

    return canvas
  } catch (error) {
    console.error('Sauvola threshold error:', error)
    return null
  }
}
