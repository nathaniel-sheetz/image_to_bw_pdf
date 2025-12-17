// Perspective transformation using Homography.js

import { Homography } from 'homography'

// Calculate distance between two points
function distance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
}

// Estimate output width based on corner distances
function estimateWidth(corners) {
  const topWidth = distance(corners.topLeft, corners.topRight)
  const bottomWidth = distance(corners.bottomLeft, corners.bottomRight)
  return Math.round((topWidth + bottomWidth) / 2)
}

// Estimate output height based on corner distances
function estimateHeight(corners) {
  const leftHeight = distance(corners.topLeft, corners.bottomLeft)
  const rightHeight = distance(corners.topRight, corners.bottomRight)
  return Math.round((leftHeight + rightHeight) / 2)
}

// Apply perspective transformation to straighten document
export function perspectiveTransform(image, corners) {
  try {
    const homography = new Homography()

    // Set source points (corners of source quadrilateral)
    const srcPoints = [
      [corners.topLeft.x, corners.topLeft.y],
      [corners.topRight.x, corners.topRight.y],
      [corners.bottomRight.x, corners.bottomRight.y],
      [corners.bottomLeft.x, corners.bottomLeft.y]
    ]

    // Calculate output dimensions
    const width = estimateWidth(corners)
    const height = estimateHeight(corners)

    // Destination points (rectangle)
    const dstPoints = [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height]
    ]

    // Configure homography
    homography.setSourcePoints(srcPoints)
    homography.setDestinyPoints(dstPoints)
    homography.setImage(image)

    // Warp the image - returns ImageData
    const imageData = homography.warp()

    // Convert ImageData to canvas
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')
    ctx.putImageData(imageData, 0, 0)

    return canvas
  } catch (error) {
    console.error('Perspective transform error:', error)
    // Fallback to null if transform fails
    return null
  }
}
