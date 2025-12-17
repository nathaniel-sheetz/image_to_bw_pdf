import './styles.css'
import exifr from 'exifr'
import { jsPDF } from 'jspdf'
import { CropUI, cropToBoundingBox, RectangularCropUI, applyRectangularCrop } from './cropping.js'
import { perspectiveTransform } from './perspective.js'
import { convertToGrayscale } from './grayscale.js'
import { adaptiveThreshold } from './threshold.js'

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024  // 10MB

// DOM elements
const fileInput = document.getElementById('file-input')
const fileName = document.getElementById('file-name')
const previewSection = document.getElementById('preview-section')
const previewCanvas = document.getElementById('preview-canvas')
const identifyCornersBtn = document.getElementById('identify-corners')
const skipToCropBtn = document.getElementById('skip-to-crop')
const identifyCornersSection = document.getElementById('identify-corners-section')
const cornerCanvas = document.getElementById('corner-canvas')
const cornerOverlay = document.getElementById('corner-overlay')
const resetCornersBtn = document.getElementById('reset-corners')
const previewCornersBtn = document.getElementById('preview-corners')
const previewResultsSection = document.getElementById('preview-results-section')
const previewCroppedCanvas = document.getElementById('preview-cropped')
const previewCorrectedCanvas = document.getElementById('preview-corrected')
const useCroppedBtn = document.getElementById('use-cropped')
const useCorrectedBtn = document.getElementById('use-corrected')
const adjustCornersAgainBtn = document.getElementById('adjust-corners-again')
const rectangularCropSection = document.getElementById('rectangular-crop-section')
const cropTargetCanvas = document.getElementById('crop-target-canvas')
const rectangleOverlay = document.getElementById('rectangle-overlay')
const resetRectangularCropBtn = document.getElementById('reset-rectangular-crop')
const confirmRectangularCropBtn = document.getElementById('confirm-rectangular-crop')
const skipRectangularCropBtn = document.getElementById('skip-rectangular-crop')
const grayscaleSection = document.getElementById('grayscale-section')
const grayscaleCanvas = document.getElementById('grayscale-canvas')
const proceedToThresholdBtn = document.getElementById('proceed-to-threshold')
const backToRectangularCropBtn = document.getElementById('back-to-rectangular-crop')
const thresholdSection = document.getElementById('threshold-section')
const thresholdCanvas = document.getElementById('threshold-canvas')
const blockSizeSlider = document.getElementById('block-size')
const blockSizeValue = document.getElementById('block-size-value')
const constantCSlider = document.getElementById('constant-c')
const constantCValue = document.getElementById('constant-c-value')
const reprocessThresholdBtn = document.getElementById('reprocess-threshold')
const pageSizeSelector = document.getElementById('page-size')
const generatePdfBtn = document.getElementById('generate-pdf')
const backToGrayscaleBtn = document.getElementById('back-to-grayscale')

// State: store current image and orientation
let currentImage = null
let imageOrientation = 1
let cornerUI = null
let rectangularCropUI = null
let cornerCorrectedImage = null
let cropTargetImage = null
let rectangularCroppedImage = null
let currentGrayscale = null
let currentThreshold = null

// Handle file selection
fileInput.addEventListener('change', handleFileSelect)

function handleFileSelect(event) {
  const file = event.target.files[0]

  if (!file) {
    return
  }

  // Validate file type
  if (!file.type.match('image/jpeg') && !file.type.match('image/png')) {
    alert('Please select a JPEG or PNG image')
    return
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    alert(`File is too large (${sizeMB}MB). Please use an image under 10MB.`)
    return
  }

  // Display filename
  fileName.textContent = `Selected: ${file.name}`

  // Load and display image
  loadImage(file)
}

async function loadImage(file) {
  try {
    // Extract EXIF orientation
    const exif = await exifr.parse(file)
    imageOrientation = exif?.Orientation || 1
  } catch (error) {
    // If EXIF parsing fails, assume normal orientation
    console.warn('Could not read EXIF data:', error)
    imageOrientation = 1
  }

  // Load image data
  const reader = new FileReader()

  reader.onload = function(e) {
    const img = new Image()

    img.onload = function() {
      currentImage = img
      displayImage(img, imageOrientation)
    }

    img.onerror = function() {
      alert('Error loading image')
    }

    img.src = e.target.result
  }

  reader.onerror = function() {
    alert('Error reading file')
  }

  reader.readAsDataURL(file)
}

function displayImage(img, orientation) {
  const ctx = previewCanvas.getContext('2d')

  // Determine canvas dimensions based on orientation
  // Orientations 5,6,7,8 require swapping width/height
  const needsSwap = orientation >= 5 && orientation <= 8

  if (needsSwap) {
    previewCanvas.width = img.height
    previewCanvas.height = img.width
  } else {
    previewCanvas.width = img.width
    previewCanvas.height = img.height
  }

  // Apply EXIF orientation transformation
  ctx.save()
  applyOrientation(ctx, orientation, previewCanvas.width, previewCanvas.height, img.width, img.height)

  // Draw image
  ctx.drawImage(img, 0, 0)

  ctx.restore()

  // Show preview section
  previewSection.style.display = 'block'

  // Initialize corner UI
  cornerUI = new CropUI(cornerCanvas, cornerOverlay)
}

function applyOrientation(ctx, orientation, canvasWidth, canvasHeight, imgWidth, imgHeight) {
  // Apply canvas transformations based on EXIF orientation
  switch(orientation) {
    case 2:
      // Flip horizontal
      ctx.translate(canvasWidth, 0)
      ctx.scale(-1, 1)
      break
    case 3:
      // Rotate 180°
      ctx.translate(canvasWidth, canvasHeight)
      ctx.rotate(Math.PI)
      break
    case 4:
      // Flip vertical
      ctx.translate(0, canvasHeight)
      ctx.scale(1, -1)
      break
    case 5:
      // Rotate 90° CCW + flip horizontal
      ctx.translate(0, canvasWidth)
      ctx.rotate(-Math.PI / 2)
      ctx.scale(-1, 1)
      break
    case 6:
      // Rotate 90° CW
      ctx.translate(canvasWidth, 0)
      ctx.rotate(Math.PI / 2)
      break
    case 7:
      // Rotate 90° CW + flip horizontal
      ctx.translate(canvasWidth, canvasHeight)
      ctx.rotate(Math.PI / 2)
      ctx.scale(-1, 1)
      break
    case 8:
      // Rotate 90° CCW
      ctx.translate(0, canvasHeight)
      ctx.rotate(-Math.PI / 2)
      break
    default:
      // Orientation 1: Normal, no transformation needed
      break
  }
}

// Workflow event listeners
identifyCornersBtn.addEventListener('click', enterIdentifyCornersMode)
skipToCropBtn.addEventListener('click', skipToRectangularCrop)
resetCornersBtn.addEventListener('click', () => cornerUI?.reset())
previewCornersBtn.addEventListener('click', previewResults)
useCroppedBtn.addEventListener('click', () => selectResult('cropped'))
useCorrectedBtn.addEventListener('click', () => selectResult('corrected'))
adjustCornersAgainBtn.addEventListener('click', () => {
  previewResultsSection.style.display = 'none'
  identifyCornersSection.style.display = 'block'
})
resetRectangularCropBtn.addEventListener('click', () => rectangularCropUI?.reset())
confirmRectangularCropBtn.addEventListener('click', confirmRectangularCrop)
skipRectangularCropBtn.addEventListener('click', skipRectangularCrop)
proceedToThresholdBtn.addEventListener('click', proceedToThreshold)
backToRectangularCropBtn.addEventListener('click', () => {
  grayscaleSection.style.display = 'none'
  rectangularCropSection.style.display = 'block'
})
blockSizeSlider.addEventListener('input', () => {
  blockSizeValue.textContent = blockSizeSlider.value
})
constantCSlider.addEventListener('input', () => {
  constantCValue.textContent = constantCSlider.value
})
reprocessThresholdBtn.addEventListener('click', applyThreshold)
generatePdfBtn.addEventListener('click', generatePdf)
backToGrayscaleBtn.addEventListener('click', () => {
  thresholdSection.style.display = 'none'
  grayscaleSection.style.display = 'block'
})

function enterIdentifyCornersMode() {
  if (!currentImage) return

  // Hide preview section, show identify corners section
  previewSection.style.display = 'none'
  identifyCornersSection.style.display = 'block'

  // Initialize corner UI with current image
  cornerUI.initialize(currentImage)
}

function skipToRectangularCrop() {
  if (!currentImage) return

  // Set crop target to original image (no perspective correction)
  cropTargetImage = currentImage

  // Hide preview section, show rectangular crop section
  previewSection.style.display = 'none'
  enterRectangularCropMode(cropTargetImage)
}

function previewResults() {
  const corners = cornerUI.getCorners()

  // Generate cropped version
  const croppedCanvas = cropToBoundingBox(currentImage, corners)
  previewCroppedCanvas.width = croppedCanvas.width
  previewCroppedCanvas.height = croppedCanvas.height
  previewCroppedCanvas.getContext('2d').drawImage(croppedCanvas, 0, 0)

  // Generate perspective corrected version
  const correctedCanvas = perspectiveTransform(currentImage, corners)
  if (correctedCanvas) {
    previewCorrectedCanvas.width = correctedCanvas.width
    previewCorrectedCanvas.height = correctedCanvas.height
    previewCorrectedCanvas.getContext('2d').drawImage(correctedCanvas, 0, 0)
  } else {
    // If perspective transform fails, show error or use cropped version
    previewCorrectedCanvas.width = croppedCanvas.width
    previewCorrectedCanvas.height = croppedCanvas.height
    previewCorrectedCanvas.getContext('2d').drawImage(croppedCanvas, 0, 0)
    console.warn('Perspective transform failed, showing cropped version')
  }

  // Hide identify corners section, show preview results
  identifyCornersSection.style.display = 'none'
  previewResultsSection.style.display = 'block'
}

function selectResult(type) {
  // Store selected result
  if (type === 'cropped') {
    cornerCorrectedImage = previewCroppedCanvas
  } else {
    cornerCorrectedImage = previewCorrectedCanvas
  }

  // Set as crop target
  cropTargetImage = cornerCorrectedImage

  // Hide preview results, proceed to rectangular crop
  previewResultsSection.style.display = 'none'
  enterRectangularCropMode(cropTargetImage)
}

function enterRectangularCropMode(sourceImage) {
  if (!sourceImage) return

  // Show rectangular crop section
  rectangularCropSection.style.display = 'block'

  // Initialize rectangular crop UI
  if (!rectangularCropUI) {
    rectangularCropUI = new RectangularCropUI(cropTargetCanvas, rectangleOverlay)
  }
  rectangularCropUI.initialize(sourceImage)
}

function confirmRectangularCrop() {
  if (!rectangularCropUI) return

  // Get rectangle coordinates
  const rect = rectangularCropUI.getRectangle()

  // Apply rectangular crop
  const croppedCanvas = applyRectangularCrop(cropTargetImage, rect)
  rectangularCroppedImage = croppedCanvas

  // Convert to grayscale
  const grayscaleResult = convertToGrayscale(rectangularCroppedImage)

  if (!grayscaleResult) {
    alert('Error converting to grayscale. Please try again.')
    return
  }

  // Display grayscale preview
  grayscaleCanvas.width = grayscaleResult.width
  grayscaleCanvas.height = grayscaleResult.height
  grayscaleCanvas.getContext('2d').drawImage(grayscaleResult, 0, 0)

  // Update state
  currentGrayscale = grayscaleResult

  // Hide rectangular crop, show grayscale section
  rectangularCropSection.style.display = 'none'
  grayscaleSection.style.display = 'block'
}

function skipRectangularCrop() {
  if (!cropTargetImage) return

  // Use full image without cropping
  rectangularCroppedImage = cropTargetImage

  // Convert to grayscale
  const grayscaleResult = convertToGrayscale(rectangularCroppedImage)

  if (!grayscaleResult) {
    alert('Error converting to grayscale. Please try again.')
    return
  }

  // Display grayscale preview
  grayscaleCanvas.width = grayscaleResult.width
  grayscaleCanvas.height = grayscaleResult.height
  grayscaleCanvas.getContext('2d').drawImage(grayscaleResult, 0, 0)

  // Update state
  currentGrayscale = grayscaleResult

  // Hide rectangular crop, show grayscale section
  rectangularCropSection.style.display = 'none'
  grayscaleSection.style.display = 'block'
}

function proceedToThreshold() {
  if (!currentGrayscale) return

  // Apply threshold with default parameters
  applyThreshold()

  // Hide grayscale section, show threshold section
  grayscaleSection.style.display = 'none'
  thresholdSection.style.display = 'block'
}

function applyThreshold() {
  if (!currentGrayscale) return

  // Get parameter values
  const blockSize = parseInt(blockSizeSlider.value)
  const constantC = parseInt(constantCSlider.value)

  // Apply adaptive thresholding
  const thresholdResult = adaptiveThreshold(currentGrayscale, blockSize, constantC)

  if (!thresholdResult) {
    alert('Error applying threshold. Please try again.')
    return
  }

  // Display threshold result
  thresholdCanvas.width = thresholdResult.width
  thresholdCanvas.height = thresholdResult.height
  thresholdCanvas.getContext('2d').drawImage(thresholdResult, 0, 0)

  // Update state
  currentThreshold = thresholdResult
}

function generatePdf() {
  if (!currentThreshold) {
    alert('No document to generate PDF from.')
    return
  }

  try {
    // Get selected page size
    const pageSize = pageSizeSelector.value

    // Define page dimensions
    const pageSizes = {
      a4: { width: 210, height: 297, format: 'a4' },
      letter: { width: 215.9, height: 279.4, format: 'letter' }
    }

    const { width: pageWidth, height: pageHeight, format } = pageSizes[pageSize]

    // Create PDF document
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: format
    })

    // Convert canvas to JPEG data URL
    const imageData = currentThreshold.toDataURL('image/jpeg', 0.95)

    // Calculate scaling to fit page while maintaining aspect ratio
    const imgWidth = currentThreshold.width
    const imgHeight = currentThreshold.height
    const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight)
    const scaledWidth = imgWidth * ratio
    const scaledHeight = imgHeight * ratio

    // Center image on page
    const xOffset = (pageWidth - scaledWidth) / 2
    const yOffset = (pageHeight - scaledHeight) / 2

    // Add image to PDF
    pdf.addImage(imageData, 'JPEG', xOffset, yOffset, scaledWidth, scaledHeight)

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `document_${timestamp}.pdf`

    // Trigger download
    pdf.save(filename)

    console.log('PDF generated:', filename)
  } catch (error) {
    console.error('PDF generation error:', error)
    alert('Error generating PDF. Please try again.')
  }
}

console.log('Document Scanner initialized')
