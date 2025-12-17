# Document to B&W PDF Converter - Development Plan

## Project Overview
Browser-based document scanner that converts photos of documents into pure black/white PDFs using adaptive thresholding to handle uneven lighting and shadows.

## Technology Stack

**Core:**
- Vanilla JavaScript/TypeScript
- HTML5 Canvas API for image manipulation
- Custom implementations for image processing algorithms

**Libraries:**
- jsPDF - PDF generation only

**Build Tools:**
- Vite (fast, modern dev server)
- ESLint + Prettier for code quality


**Hosting:**
- GitHub Pages, Netlify, or Vercel

**Benefits of Vanilla Approach:**
- Lightweight bundle (no 8MB OpenCV.js dependency)
- Faster initial page load
- No async library loading/initialization
- Simpler deployment and maintenance

---

## MVP Development Phases

### **Phase 0: Project Setup & Foundation**

**Tasks:**
- Initialize project structure (HTML, CSS, JS files)
- Set up Vite build tooling
- Create basic HTML UI skeleton with file input
- Add dependency: jsPDF
- Set up development server with live reload
- Create .gitignore for node_modules, build artifacts

**Deliverable:** Working development environment with basic file upload UI

---

### **Phase 1: Image Loading & Display**

**Tasks:**
- Implement file picker with image format validation (JPEG, PNG)
- Handle camera capture for mobile devices (`<input capture="environment">`)
- Load image into HTML5 Canvas
- Display original image preview
- Handle image rotation/EXIF orientation
- Add basic error handling for unsupported formats

**Technical Considerations:**
- Use FileReader API for local file handling
- Canvas for image manipulation
- Consider max resolution limits for browser memory (2000px recommended)

**Deliverable:** Users can upload/capture images and see them displayed

---

### **Phase 2 & 3 Combined: Manual Cropping with Optional Perspective Correction**

**Approach:** Single workflow with preview-based selection between cropped and perspective-corrected results

**User Workflow:**
1. User enters "crop mode" after loading image
2. 4 draggable corner points appear (defaulted to image edges)
3. User drags corners to match document boundaries
4. User clicks "Preview Result" button
5. System shows TWO side-by-side previews:
   - **Cropped Only**: Simple bounding box crop (best for curved pages, books)
   - **Perspective Corrected**: 4-point transform to rectangle (best for flat documents)
6. User chooses which result to use
7. Selected image proceeds to grayscale conversion

**Tasks:**
- Create draggable corner UI (SVG overlay with 4 circles + connecting lines)
- Implement mouse and touch event handlers for dragging
- Implement simple bounding box crop
- Implement perspective transformation using Homography.js library
- Create side-by-side preview comparison UI
- Add workflow state management
- Integrate with Phase 1 and Phase 4

**Technical Considerations:**
- **Draggable corners**: SVG overlay, touch targets 44x44px minimum, visual feedback
- **Simple crop**: Find bounding box of 4 corners, extract rectangular region
- **Perspective transform**: Use Homography.js library for homography matrix calculation
  - Library handles: matrix calculation, inverse transform, image warping, edge cases
  - We handle: corner management, dimension estimation, workflow integration
- **Preview UI**: Side-by-side layout with "Use This" buttons
- **Edge cases**: Degenerate quadrilaterals, intersecting lines, extreme distortions

**Why This Approach:**
- Handles both flat AND curved documents (user picks what looks best)
- Preview prevents bad transformations from being applied
- Making perspective correction optional is critical for real-world use (books, receipts)
- Simpler than automatic edge detection for MVP

**Dependencies:**
- `homography` - Lightweight modern library for perspective transforms

**Files to Create:**
- `src/cropping.js` - Draggable corner UI and crop logic
- `src/perspective.js` - Perspective transform wrapper

**Files to Modify:**
- `index.html` - Add crop section and preview comparison UI
- `src/main.js` - Workflow integration and state management
- `src/styles.css` - Styling for crop UI and preview grid

**Deliverable:** User can crop document boundaries and choose between simple crop or perspective-corrected result

---

### **Phase 4: Grayscale Conversion**

**Tasks:**
- Convert RGB to grayscale using luminance formula
- Preview grayscale result
- Optimize for performance on large images

**Technical Considerations:**
- Standard luminance formula: `0.299R + 0.587G + 0.114B`
- Use Canvas getImageData() to access pixel data
- Process pixels using Uint8ClampedArray for speed
- Write back using putImageData()

**Implementation:**
```javascript
const imageData = ctx.getImageData(0, 0, width, height);
const data = imageData.data;
for (let i = 0; i < data.length; i += 4) {
  const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
  data[i] = data[i+1] = data[i+2] = gray;
}
ctx.putImageData(imageData, 0, 0);
```

**Deliverable:** Color images converted to grayscale

---

### **Phase 5: Adaptive Thresholding (Core Feature)**

**Tasks:**
- Implement custom adaptive thresholding algorithm
  - Mean adaptive threshold (simpler, faster)
  - Gaussian adaptive threshold (better quality, optional)
- Add basic adjustable parameters:
  - Block size (neighborhood window): default 11
  - Constant C (threshold adjustment): default 2
  - Threshold method selector (Mean/Gaussian)
- Create preview of black/white output
- Handle edge cases (very light/dark images)

**Technical Considerations:**
- Block size should be odd number (11, 15, 21, etc.)
- Use integral image for fast local mean calculation
- For each pixel, calculate mean of block size x block size neighborhood
- Threshold = local_mean - C
- If pixel > threshold: white (255), else: black (0)

**Algorithm Overview:**
```
Mean Adaptive Threshold:
1. Build integral image for O(1) region sum queries
2. For each pixel (x, y):
   - Calculate mean of blockSize×blockSize region around pixel
   - threshold = mean - C
   - output = (pixel > threshold) ? 255 : 0

Gaussian Adaptive Threshold (optional):
1. Apply Gaussian blur to create smoothed image
2. For each pixel:
   - threshold = blurred_value - C
   - output = (pixel > threshold) ? 255 : 0
```

**Deliverable:** Clean black/white output that handles uneven lighting

---

### **Phase 6: PDF Generation & Download**

**Tasks:**
- Integrate jsPDF library
- Convert processed canvas to image data
- Add image to PDF (single page for MVP)
- Page size selector (US Letter / A4)
- Optimize image compression in PDF
- Generate PDF blob
- Auto-generate timestamped filename
- Implement PDF download button

**Technical Considerations:**
- jsPDF.addImage() with JPEG compression (95% quality)
- Page size: US Letter (8.5×11") default, A4 (210×297mm) selectable
- Compression level: 0.95 quality balances size vs quality
- Filename format: `document_YYYY-MM-DDTHH-MM-SS.pdf` (auto-generated with timestamp)
- Scale image to fit page while maintaining aspect ratio
- Center image on page

**Deliverable:** Working PDF generation and download with page size selection

---

### **Phase 7: Basic Testing & Deployment**

**Tasks:**
- Cross-browser testing (Chrome, Firefox, Safari, Edge)
- Mobile testing (iOS Safari, Chrome Android)
- Test with various document types (text, receipts, handwritten notes)
- Test edge cases (dark photos, colored backgrounds, skewed angles)
- Verify touch interactions work on mobile
- Set up basic deployment
- Deploy to static hosting (GitHub Pages recommended)

**Deliverable:** Production-ready MVP application

---

## Future Enhancements (Post-MVP)

### **Automatic Edge Detection with OpenCV.js**
- Add OpenCV.js as optional dependency (~8MB)
- Implement Canny edge detection
- Find document contours (largest quadrilateral)
- Auto-detect document boundaries
- Use as suggestion, still allow manual adjustment
- Lazy load library only when auto-detect is enabled

### **Image Enhancement Options**
- Contrast adjustment
- Brightness adjustment
- Sharpening filter
- Noise reduction (bilateral filter, Gaussian blur)
- Morphological operations (dilation/erosion) to clean up noise
- Despeckle small artifacts

### **Multi-page Support**
- Allow adding multiple images
- Display thumbnails of all pages
- Enable reordering pages (drag & drop)
- Delete individual pages
- Batch process all pages with same settings

### **UI/UX Polish**
- Improved visual design and layout
- Loading indicators during processing
- Responsive design improvements
- Keyboard shortcuts
- Progress bars
- Tooltips and help text
- Undo/redo functionality
- Preset profiles (Document, Receipt, Whiteboard, etc.)

### **Performance Optimization**
- Web Workers for image processing
- Image downsampling for preview
- Memory usage optimization
- Progressive rendering for large images
- Cache processed results
- Image quality selector (fast/balanced/quality)

### **Advanced Features**
- Save/load settings presets
- Export as PNG/JPEG in addition to PDF
- OCR integration (Tesseract.js) for searchable PDFs
- Batch import from camera roll
- PWA support (offline capability, install prompt)
- Local storage for draft documents
- Color mode options (B&W, Grayscale, Color)

---

## Implementation Notes

1. **Adaptive Thresholding:** This is the most critical component. The mean adaptive threshold with integral image approach provides excellent results with good performance.

2. **Integral Image Optimization:** For adaptive thresholding, build an integral image once to calculate any rectangular region sum in O(1) time instead of O(blockSize²).

3. **Perspective Transform:** This is the most complex custom algorithm. Plenty of reference implementations available online. Use inverse mapping with bilinear interpolation for best quality.

4. **Performance:** Large images (4K+ from modern phones) can be memory-intensive. Process at reduced resolution (e.g., 2000px max dimension) for MVP. Can add quality options later.

5. **Mobile First:** Most users will scan from phones, so ensure camera access and touch interactions work properly. Test extensively on real devices.

6. **Progressive Enhancement:** Build the pipeline step-by-step: load → manual crop → perspective correct → grayscale → threshold → PDF. Each step should be testable independently.

7. **Algorithm References:**
   - Perspective transform: Search for "homography matrix from 4 points"
   - Integral image: Classic algorithm for fast region sums
   - Adaptive threshold: Well-documented algorithm with many implementations

## Current Status

**Phase:** Workflow Enhancement Complete ✓ - MVP COMPLETE!
**Last Updated:** 2025-12-17

### Completed Phases:
- **Phase 0: Project Setup & Foundation** - Vite dev environment working with basic file upload UI
- **Phase 1: Image Loading & Display** - EXIF orientation handling and file size validation implemented
- **Phase 2 & 3 Combined: Manual Cropping with Optional Perspective Correction** - Draggable corner UI, simple crop, perspective transform using Homography.js library, side-by-side preview comparison
- **Phase 4: Grayscale Conversion** - RGB to grayscale conversion using standard luminance formula (0.299R + 0.587G + 0.114B) with preview display
- **Phase 5: Adaptive Thresholding** - Mean adaptive thresholding with integral image optimization, adjustable parameters (block size, constant C), pure B&W output that handles uneven lighting
- **Phase 6: PDF Generation & Download** - jsPDF integration with page size selector (US Letter / A4), auto-generated timestamped filenames, JPEG compression (95% quality), image scaling and centering on page
- **Workflow Enhancement: Separated Perspective Correction from Rectangular Crop** - Renamed corner identification UI for clarity, made perspective correction optional with "Skip to Crop" button, added dedicated rectangular crop step with draggable rectangle interface (8 resize handles)

### Updated Workflow:
1. **Upload Image** - File picker with EXIF orientation handling
2. **Identify Corners (Optional)** - User can identify document corners for perspective correction OR skip directly to rectangular crop
   - If identifying corners: Shows 4 draggable corner points
   - User previews side-by-side comparison (cropped only vs perspective corrected)
   - User selects which result to use
3. **Rectangular Crop** - Draggable rectangle interface with 8 handles (4 corners + 4 edges)
   - User can confirm crop or use full image
4. **Grayscale Conversion** - Standard luminance formula
5. **Adaptive Thresholding** - Adjustable parameters for optimal B&W conversion
6. **PDF Generation** - Download with selected page size (US Letter or A4)
