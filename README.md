# Document Scanner

A browser-based document scanner that converts photos of documents into clean, black and white PDFs. Perfect for scanning receipts, notes, contracts, or any paper document using just your phone or computer camera.

## Features

- **Browser-Based**: No installation required - runs entirely in your web browser
- **Privacy-First**: All processing happens locally on your device - images never leave your computer
- **Smart Processing**:
  - Automatic EXIF orientation handling
  - Perspective correction for angled photos
  - Adaptive corner detection with manual adjustment
  - Customizable rectangular cropping
  - Adaptive threshold conversion for crisp black and white output
- **Flexible Workflow**: Skip steps you don't need or fine-tune every detail
- **Multiple Page Sizes**: Support for US Letter and A4 formats
- **Mobile-Friendly**: Works on phones, tablets, and desktop computers

## Quick Start

### Online Version
Visit the live demo: [https://nathaniel-sheetz.github.io/image_to_bw_pdf/](https://nathaniel-sheetz.github.io/image_to_bw_pdf/)

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/nathaniel-sheetz/image_to_bw_pdf.git
   cd image_to_bw_pdf
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to the URL shown (typically `http://localhost:5173`)

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## How to Use

### Step-by-Step Workflow

1. **Upload/Capture Image**
   - Click "Choose Image or Take Photo"
   - Select an existing photo or take a new one with your camera
   - Supports JPEG and PNG files up to 10MB

2. **Perspective Correction (Optional)**
   - Click "Identify Corners" to manually adjust the document boundaries
   - Drag the four corner points to match your document's edges
   - Click "Preview Result" to see both cropped and perspective-corrected versions
   - Choose the result that looks best (cropped for curved pages, corrected for flat documents)
   - Or click "Skip to Crop" to skip perspective correction entirely

3. **Final Cropping**
   - Drag the rectangle to select the final area you want to keep
   - Click "Reset Crop" to start over
   - Click "Confirm Crop" to proceed, or "Use Full Image" to skip cropping

4. **Grayscale Preview**
   - Review the grayscale conversion
   - Click "Convert to Black & White" to continue
   - Or "Adjust Crop Again" to go back and refine the crop

5. **Black & White Adjustment**
   - Fine-tune the black and white conversion:
     - **Block Size**: Controls the local area size for adaptive thresholding (5-51)
       - Smaller values: More detail, may show more noise
       - Larger values: Smoother, may lose fine details
     - **Threshold Adjustment**: Fine-tune the black/white cutoff point (-10 to +10)
       - Negative values: More black (good for faint text)
       - Positive values: More white (good for reducing background)
   - Click "Apply Settings" to see changes in real-time

6. **Generate PDF**
   - Select your preferred page size (US Letter or A4)
   - Click "Generate PDF" to download your document
   - The file will be named with a timestamp: `document_YYYY-MM-DD.pdf`

### Tips for Best Results

- **Lighting**: Use even, bright lighting to avoid shadows
- **Background**: Place documents on a contrasting background
- **Angle**: Try to photograph documents as straight-on as possible
- **Curved Pages**: Use the "Cropped Only" option for books or curved pages
- **Flat Documents**: Use "Perspective Corrected" for best results on flat papers
- **Fine Print**: Decrease the block size for documents with small text
- **Faded Text**: Use a negative threshold adjustment to make text darker

## Technical Details

### Built With

- **Vite**: Fast build tool and development server
- **jsPDF**: PDF generation library
- **exifr**: EXIF metadata parsing for proper image orientation
- **homography**: Perspective transformation mathematics

### Browser Compatibility

Works on all modern browsers that support:
- HTML5 Canvas
- ES6 Modules
- File API
- Camera API (for photo capture on mobile)

Tested on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

### File Size Limits

- Maximum image size: 10MB
- Recommended: 2-5MB for best performance
- Images are processed at full resolution for maximum quality

## Project Structure

```
image_to_bw_pdf/
├── src/
│   ├── main.js           # Main application logic and workflow
│   ├── cropping.js       # Corner detection and crop UI components
│   ├── perspective.js    # Perspective transformation algorithms
│   ├── grayscale.js      # Grayscale conversion
│   ├── threshold.js      # Adaptive threshold for B&W conversion
│   └── styles.css        # Application styles
├── index.html            # Main HTML template
├── package.json          # Dependencies and scripts
└── vite.config.js        # Vite configuration (if present)
```

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

### Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests

## Privacy & Security

This application:
- Runs entirely in your browser
- Does not upload images to any server
- Does not track or store any user data
- Does not require internet connection after initial load

Your documents remain completely private on your device.

## License

MIT License - see [LICENSE](LICENSE) file for details

Copyright (c) 2025 Nathaniel Sheetz

## Acknowledgments

- Adaptive threshold algorithm inspired by Bradley and Roth's local thresholding method
- Perspective transformation using homography matrix calculations
- EXIF orientation handling ensures photos display correctly regardless of camera orientation

## Support

For issues, questions, or suggestions:
- Open an issue on [GitHub](https://github.com/nathaniel-sheetz/image_to_bw_pdf/issues)
- Check existing issues for solutions to common problems
