# Mobile Usability: Diagnosing and Fixing Android Corner Selection Issues

## Problem Summary
Corner identification works on desktop but has issues on Android Firefox. User testing on GitHub Pages with Firefox Mobile.

**Observed Symptoms**:
1. Corner dots are **too small** - only visible/tappable when page is zoomed in
2. Corners **do respond** to touch when tapped
3. **Drag breaks immediately** - corner moves slightly (a few pixels), then drag stops
4. User must **release and re-touch** to continue moving, creating jerky step-by-step movement
5. Occasionally allows longer drag, but usually stops after short movement

## Root Cause Analysis

**Confirmed Issue #1: Touch targets too small**
- Current size: 8px radius (16px diameter)
- Required: 44-48px diameter minimum for mobile
- **Evidence**: Works when zoomed in, invisible at normal zoom

**Primary Suspect #2: Drag tracking breaks mid-gesture (Firefox Mobile specific)**
Possible causes:
1. **touchmove not firing continuously** - Firefox Mobile may throttle or drop touchmove events
2. **Event listener scope issue** - touchmove listener on `document` may not capture properly in Firefox
3. **this.draggedCorner getting cleared** - drag state reset by something mid-drag
4. **Coordinate calculation changing** - getScale() returning different values during drag causing position jumps
5. **Touch event preventDefault() failing** - Firefox may interpret touch as scroll gesture intermittently

**Secondary causes**:
1. **TouchEnd coordinate bug**: Uses `e.touches` instead of `e.changedTouches` for touchend
2. **Missing passive: false**: May be needed for Firefox Mobile
3. **CSS optimizations needed**: Missing z-index, tap highlight removal, user-select prevention

## Implementation Strategy

### Iteration 1: Critical Fixes (Start Here)

**Goal**: Fix confirmed touch target size issue + diagnose drag stopping
**Success Probability**: ~60% (touch targets fixed, drag issue diagnosed)

#### Step 1: Increase Touch Target Size ⭐ PRIORITY #1

**File: `src/cropping.js`**

The 8px radius corners are too small for mobile. Make them 20px radius (40px diameter) to meet touch guidelines.

In `CropUI.render()` at line 62-75, replace corner circle creation:

```javascript
// OLD CODE (remove):
const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
circle.setAttribute('cx', pos.x)
circle.setAttribute('cy', pos.y)
circle.setAttribute('r', '8')  // TOO SMALL!
circle.setAttribute('fill', '#0078ff')
circle.setAttribute('stroke', 'white')
circle.setAttribute('stroke-width', '2')
circle.setAttribute('class', 'corner-handle')
circle.setAttribute('data-corner', name)
circle.style.cursor = 'move'
this.svg.appendChild(circle)

// NEW CODE (larger visible circle):
const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
circle.setAttribute('cx', pos.x)
circle.setAttribute('cy', pos.y)
circle.setAttribute('r', '20')  // MUCH LARGER - 40px diameter
circle.setAttribute('fill', '#0078ff')
circle.setAttribute('stroke', 'white')
circle.setAttribute('stroke-width', '3')
circle.setAttribute('class', 'corner-handle')
circle.setAttribute('data-corner', name)
circle.style.cursor = 'move'
this.svg.appendChild(circle)
```

Apply same change to `RectangularCropUI.drawHandle()` at line 257 (increase r from "8" to "16").

**Why this size**: 40px diameter is easily tappable on mobile, and will be clearly visible without zoom.

#### Step 2: Add Detailed Debug Logging for Drag Tracking

**File: `src/cropping.js`**

Add logging to understand why drag stops mid-gesture:

```javascript
// In CropUI.onDragStart() at line 98:
onDragStart(e) {
  console.log('[onDragStart] FIRED', {
    type: e.type,
    target: e.target.tagName,
    corner: e.target.getAttribute('data-corner'),
    touches: e.touches?.length,
    cancelable: e.cancelable,
    timeStamp: e.timeStamp
  });

  // ... existing code ...

  if (target.classList.contains('corner-handle')) {
    e.preventDefault()
    this.draggedCorner = target.getAttribute('data-corner')
    console.log('[onDragStart] Set draggedCorner to:', this.draggedCorner)
  }
}

// In CropUI.onDrag() at line 106:
onDrag(e) {
  console.log('[onDrag] FIRED', {
    type: e.type,
    draggedCorner: this.draggedCorner,  // Check if still set
    touches: e.touches?.length,
    timeStamp: e.timeStamp
  });

  if (!this.draggedCorner) {
    console.warn('[onDrag] draggedCorner is NULL - drag stopped!')
    return
  }

  // ... rest of method
}

// In CropUI.onDragEnd() at line 142:
onDragEnd(e) {
  console.log('[onDragEnd] FIRED', {
    type: e.type,
    draggedCorner: this.draggedCorner,
    timeStamp: e.timeStamp
  });

  this.draggedCorner = null
}
```

Apply same logging to `RectangularCropUI` class.

**Testing**: Deploy and check console on Firefox Mobile. Key questions:
- Does onDrag fire continuously or just once?
- Does draggedCorner become null unexpectedly?
- Do touchmove events fire at regular intervals?

#### Step 3: Fix Passive Event Listeners + Improve Event Capturing

**File: `src/cropping.js`**

Firefox Mobile may need `{ passive: false }` and better event capturing. Update event listeners:

In `CropUI.setupEventListeners()` at line 86:
```javascript
setupEventListeners() {
  // Mouse events (unchanged)
  this.svg.addEventListener('mousedown', this.onDragStart.bind(this))
  document.addEventListener('mousemove', this.onDrag.bind(this))
  document.addEventListener('mouseup', this.onDragEnd.bind(this))

  // Touch events - ADD { passive: false }
  this.svg.addEventListener('touchstart', this.onDragStart.bind(this), { passive: false })
  document.addEventListener('touchmove', this.onDrag.bind(this), { passive: false })
  document.addEventListener('touchend', this.onDragEnd.bind(this), { passive: false })
  document.addEventListener('touchcancel', this.onDragEnd.bind(this), { passive: false })
}
```

In `RectangularCropUI.setupEventListeners()` at line 307:
```javascript
setupEventListeners() {
  this.svg.addEventListener('mousedown', this.onDragStart.bind(this))
  document.addEventListener('mousemove', this.onDrag.bind(this))
  document.addEventListener('mouseup', this.onDragEnd.bind(this))

  // Touch events - ADD { passive: false }
  this.svg.addEventListener('touchstart', this.onDragStart.bind(this), { passive: false })
  document.addEventListener('touchmove', this.onDrag.bind(this), { passive: false })
  document.addEventListener('touchend', this.onDragEnd.bind(this), { passive: false })
  document.addEventListener('touchcancel', this.onDragEnd.bind(this), { passive: false })
}
```

**Key changes**:
- `{ passive: false }` allows preventDefault() to work
- Added `touchcancel` listener (Firefox may fire this when gesture is interrupted)
- `{ passive: false }` on touchend/touchcancel too

**Testing**: Deploy and test drag on Firefox Mobile.

#### Step 4: Add Early preventDefault() to Block Firefox Scroll Gestures

**File: `src/cropping.js`**

The "moves slightly then stops" symptom suggests Firefox is detecting a scroll gesture and taking over from the touch handler. Call preventDefault() earlier:

In `CropUI.onDragStart()` at line 98:
```javascript
onDragStart(e) {
  // CRITICAL: Prevent scroll BEFORE any other logic
  if (e.type.startsWith('touch')) {
    e.preventDefault()
  }

  const target = e.target

  console.log('[onDragStart] FIRED', {
    type: e.type,
    target: e.target.tagName,
    corner: e.target.getAttribute('data-corner'),
    touches: e.touches?.length,
    cancelable: e.cancelable,
    defaultPrevented: e.defaultPrevented,  // Should be true after preventDefault
    timeStamp: e.timeStamp
  });

  if (target.classList.contains('corner-handle')) {
    // Already called preventDefault above
    this.draggedCorner = target.getAttribute('data-corner')
    console.log('[onDragStart] Set draggedCorner to:', this.draggedCorner)
  }
}
```

In `CropUI.onDrag()` at line 106:
```javascript
onDrag(e) {
  // CRITICAL: Prevent scroll on every move event
  if (e.type.startsWith('touch')) {
    e.preventDefault()
  }

  console.log('[onDrag] FIRED', {
    type: e.type,
    draggedCorner: this.draggedCorner,
    touches: e.touches?.length,
    defaultPrevented: e.defaultPrevented,
    timeStamp: e.timeStamp
  });

  if (!this.draggedCorner) {
    console.warn('[onDrag] draggedCorner is NULL - drag stopped!')
    return
  }

  e.preventDefault()  // Already called above, but keep for clarity

  // ... rest of existing code ...
}
```

Apply same changes to `RectangularCropUI` methods.

**Why this matters**: Firefox Mobile may interrupt touch dragging if it detects a scroll gesture. Calling preventDefault() immediately stops this.

**Testing**: This should fix the "drag stops after a few pixels" issue.

---

### Iteration 2: Additional Fixes (If Issue Still Persists)

**Goal**: Improve touch targets and fix coordinate bugs
**Success Probability**: ~95% cumulative

#### Step 5: Fix TouchEnd Coordinate Extraction

**File: `src/cropping.js`**

In `CropUI.onDrag()` at line 117:
```javascript
// Current buggy code:
if (e.type.startsWith('touch')) {
  if (e.touches.length === 0) return  // Bug: touchend has no touches!
  clientX = e.touches[0].clientX
  clientY = e.touches[0].clientY
}

// Fixed code:
if (e.type.startsWith('touch')) {
  const touchList = e.touches.length > 0 ? e.touches : e.changedTouches
  if (!touchList || touchList.length === 0) return
  clientX = touchList[0].clientX
  clientY = touchList[0].clientY
}
```

Apply same fix to `RectangularCropUI.onDrag()` at line 349.

**Why this matters**: TouchEnd events have empty `touches` array but populated `changedTouches`. Current code fails to capture final position.

#### Step 6: Add CSS Touch Optimizations

**File: `src/styles.css`**

Update `#corner-overlay` at line 147:
```css
#corner-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: all;
  touch-action: none;
  z-index: 10;  /* Ensure above canvas */
  -webkit-tap-highlight-color: transparent;  /* Remove tap flash */
  user-select: none;  /* Prevent selection */
  -webkit-user-select: none;
  -webkit-touch-callout: none;  /* Disable iOS callout */
}
```

Apply same changes to `#rectangle-overlay` at line 163.

**Testing**: Should now work reliably on all Android devices.

---

### Iteration 3: Alternative Approach (If All Else Fails)

**Goal**: Switch to Pointer Events API for better cross-browser support
**Implementation**: Refactor event handlers to use `pointerdown`/`pointermove`/`pointerup` instead of separate mouse/touch handlers

This would be a larger refactor but provides better unified handling. Only pursue if Iterations 1-2 fail.

---

## Testing Strategy

### Local Testing
```bash
npm run build
npm run preview
# Test locally before deploying
```

### Firefox Mobile Remote Debugging

1. **On Android device**:
   - Open Firefox
   - Type `about:config` in address bar
   - Search for `devtools.debugger.remote-enabled` and set to `true`
   - Go to Settings → Advanced → Remote debugging via USB (enable)

2. **On desktop**:
   - Open Firefox
   - Type `about:debugging` in address bar
   - Enable USB debugging
   - Connect device and select it
   - Find your page and click "Inspect"

3. **Test and monitor**:
   - Console logs will appear in desktop Firefox DevTools
   - Test corner dragging on device
   - Watch console for event firing patterns

### Test Cases

- [ ] Tap directly on corner circle
- [ ] Tap near corner (within 24px)
- [ ] Drag corner to new position
- [ ] Verify corner snaps to final position on release
- [ ] Test all 4 corners
- [ ] Test rectangular crop handles
- [ ] Verify no unwanted page scrolling during drag

---

## Expected Outcomes

**After Iteration 1 - Step 1** (Touch Target Size):
- Corners clearly visible at normal zoom
- Easy to tap without zooming in
- Immediate UX improvement

**After Iteration 1 - Steps 2-4** (Debug + Firefox Fixes):
- Debug logs reveal if touchmove events are being dropped
- `passive: false` allows preventDefault() to work
- Early preventDefault() blocks Firefox scroll gesture detection
- Should fix "drag stops after a few pixels" issue
- **Success Probability**: ~75-85%

**After Iteration 2** (If still needed):
- TouchEnd coordinate bug fixed
- CSS touch optimizations added
- Even more reliable drag tracking
- **Cumulative Success**: ~95%

---

## Critical Files to Modify

1. **`src/cropping.js`** (Primary changes)
   - Lines 86-96: `CropUI.setupEventListeners()`
   - Lines 98-104: `CropUI.onDragStart()`
   - Lines 106-140: `CropUI.onDrag()`
   - Lines 62-75: `CropUI.render()` - corner creation
   - Lines 307-315: `RectangularCropUI.setupEventListeners()`
   - Lines 317-341: `RectangularCropUI.onDragStart()`
   - Lines 343-370: `RectangularCropUI.onDrag()`
   - Lines 257-269: `RectangularCropUI.drawHandle()`

2. **`src/styles.css`** (CSS enhancements)
   - Lines 142-147: `#corner-overlay` styles
   - Lines 164-169: `#rectangle-overlay` styles

No changes needed to `index.html`, `src/main.js`, or `package.json`.
