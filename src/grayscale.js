// Grayscale conversion using luminance formula

// Convert RGB image to grayscale
export function convertToGrayscale(sourceCanvas) {
  try {
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

    // Process each pixel using standard luminance formula
    // This weights RGB channels based on human perception
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      // Alpha at i+3 stays unchanged

      const gray = 0.299 * r + 0.587 * g + 0.114 * b

      data[i] = gray      // R
      data[i + 1] = gray  // G
      data[i + 2] = gray  // B
      // data[i + 3] unchanged (alpha)
    }

    // Write back to canvas
    ctx.putImageData(imageData, 0, 0)

    return canvas
  } catch (error) {
    console.error('Grayscale conversion error:', error)
    return null
  }
}
