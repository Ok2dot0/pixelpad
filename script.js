// Entry point: initialize the app once the DOM is fully loaded
import { hexToRgba, hexToHsv, hsvToHex, hexToHsl, hslToHex, rotateHue } from './color-utils.js';

window.addEventListener('load', () => {

    // ===== Setup & DOM refs ==================================================

    // --- DOM references ---
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const toolbar = document.getElementById('toolbar');
    const colorPicker = document.getElementById('color-picker');
    const customSwatch = document.getElementById('custom-color-swatch');
    const customPicker = document.getElementById('custom-color-picker');
    const cpSV = document.getElementById('cp-sv');
    const cpH = document.getElementById('cp-h');
    const cpHex = document.getElementById('cp-hex');
    const cpClose = document.getElementById('cp-close');
    const harmonySelector = document.getElementById('harmony-selector');
    const paletteContainer = document.getElementById('palette-container');
    const brushSizeSlider = document.getElementById('brush-size');
    const primarySlider = document.getElementById('primary-slider');
    const primarySliderLabel = document.getElementById('primary-slider-label');
    const sprayOpacityContainer = document.getElementById('spray-opacity-container');
    const sprayOpacitySlider = document.getElementById('spray-opacity-slider');

    const brushPreview = document.getElementById('brush-preview');
    const brushSizePreview = document.getElementById('brush-size-preview');
    const symmetryToggle = document.getElementById('symmetry-toggle');
    const roundedToggle = document.getElementById('rounded-corners-toggle');
    const fillShapeToggle = document.getElementById('fill-shape-toggle');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const saveBtn = document.getElementById('save-image');
    const clearButton = document.getElementById('clear-canvas');
    const downloadLink = document.getElementById('download-link');
    
    const saveModal = document.getElementById('save-modal');
    const saveModalClose = document.getElementById('save-modal-close');
    const saveFilename = document.getElementById('save-filename');
    const saveFormat = document.getElementById('save-format');
    const saveQualityRow = document.getElementById('save-quality-row');
    const saveQuality = document.getElementById('save-quality');
    const saveQualityVal = document.getElementById('save-quality-val');
    const saveScale = document.getElementById('save-scale');
    const saveBg = document.getElementById('save-bg');
    const saveCancel = document.getElementById('save-cancel');
    const saveConfirm = document.getElementById('save-confirm');
    const helpBtn = document.getElementById('help-shortcuts');
    const helpModal = document.getElementById('help-modal');
    const helpModalClose = document.getElementById('help-modal-close');
    const helpOk = document.getElementById('help-ok');

    // --- Drawing state ---
    let isDrawing = false;            // true while mouse is held down on canvas
    let activeTool = 'brush-tool';    // current tool id (matches button id)
    let lastX = 0, lastY = 0;         // last mouse position for freehand strokes

    // --- Brush settings ---
    let currentColor = '#ff9500';     // active color (hex)
    let currentBrushSize = 10;        // stroke width / nib size
    let currentOpacity = 1;           // alpha for most tools
    let sprayStrength = 20;           // particles per tick for spray tool
    let sprayOpacity = 1;             // alpha used for spray particles
    let isSymmetryMode = false;       // mirror painting horizontally
    let isShapeFilled = false;        // fill vs stroke for shape tools
    let isRoundedRect = true;         // rectangle tool corner style

    // --- Calligraphy brush parameters ---
    let nibAngleDeg = -35;                              // visual rotation for nib preview
    let nibAngle = (nibAngleDeg * Math.PI) / 180;       // precomputed radians
    let nibAspect = 0.35;                               // ellipse aspect ratio
    let calligraphyPoints = [];                         // sampled points along the stroke
    let calligraphyOffscreenCanvas = null;              // composited in-memory canvas for live stroke
    let calligraphyOffCtx = null;                       // context for the offscreen canvas
    let strokeOpacity = 1;                              // preserves opacity during commit

    // --- Shape drawing + preview paths ---
    let shapeStartX = 0, shapeStartY = 0;               // drag start for shapes
    let savedCanvasState;                                // snapshot for live preview
    let currentPath;                                     // freehand path being drawn
    let symmetryPath;                                    // mirrored path when symmetry enabled

    // --- Undo/redo history ---
    let history = [];                 // array of data URLs
    let historyStep = -1;             // index of current state

    // --- UI interactions / color picker state ---
    let isDraggingToolbar = false;
    let dragOffsetX = 0, dragOffsetY = 0;
    let isMouseOverToolbar = false;   // suppress canvas cursor preview when over toolbar
    let sliderTimeout;                // timeout for brush size overlay
    let hue = 30/360;                 // HSV hue [0..1]
    let sat = 1;                      // HSV saturation [0..1]
    let val = 1;                      // HSV value [0..1]
    let isDraggingSV = false;         // dragging state for SV canvas
    let isDraggingH = false;          // dragging state for Hue canvas

    // HiDPI canvas sizing
    let cssWidth = 0, cssHeight = 0, dpr = 1;
    function resizeCanvas(preserve = true) {
        const snapshot = preserve ? { url: canvas.toDataURL(), w: cssWidth, h: cssHeight } : null;
        cssWidth = window.innerWidth;
        cssHeight = window.innerHeight;
        dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
        canvas.style.width = cssWidth + 'px';
        canvas.style.height = cssHeight + 'px';
        canvas.width = Math.floor(cssWidth * dpr);
        canvas.height = Math.floor(cssHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (snapshot) {
            const img = new Image();
            img.onload = () => {
                // Draw previous content scaled to new CSS size
                ctx.save();
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1;
                ctx.drawImage(img, 0, 0, snapshot.w, snapshot.h, 0, 0, cssWidth, cssHeight);
                ctx.restore();
            };
            img.src = snapshot.url;
        }
    }
    resizeCanvas(false);
    window.addEventListener('resize', () => resizeCanvas(true));

    /** Push current canvas state into undo history. Truncates future states after undo. */
    function saveHistory() {
        if (historyStep < history.length - 1) {
            history = history.slice(0, historyStep + 1);
        }
        history.push(canvas.toDataURL());
        historyStep++;
        updateUndoRedoButtons();
    }

    /** Restore a canvas state from a data URL. */
    function loadState(stateData) {
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, cssWidth, cssHeight);
            ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
        };
        img.src = stateData;
    }

    /** Step one state back if available. */
    function undo() {
        if (historyStep > 0) {
            historyStep--;
            loadState(history[historyStep]);
            updateUndoRedoButtons();
        }
    }

    /** Step one state forward if available. */
    function redo() {
        if (historyStep < history.length - 1) {
            historyStep++;
            loadState(history[historyStep]);
            updateUndoRedoButtons();
        }
    }

    /** Enable/disable undo/redo buttons based on history position. */
    function updateUndoRedoButtons() {
        const canUndo = historyStep > 0;
        const canRedo = historyStep < history.length - 1;
        undoBtn.disabled = !canUndo;
        redoBtn.disabled = !canRedo;
    }

    /** Main drawing dispatcher for mousemove while drawing. */
    function draw(e) {
        if (!isDrawing) return;
        const x = e.offsetX, y = e.offsetY;

        if (activeTool === 'spray-brush-tool') {
            sprayBrush(x, y);
        } else if (activeTool === 'calligraphy-brush-tool') {
            if (savedCanvasState) ctx.putImageData(savedCanvasState, 0, 0);
            if (calligraphyPoints.length === 0) calligraphyPoints.push({ x: lastX, y: lastY });
            const p0 = calligraphyPoints[calligraphyPoints.length - 1];
            drawCalligraphySegment(calligraphyOffCtx, p0.x, p0.y, x, y);
            calligraphyPoints.push({ x, y });
            ctx.save();
            const prevAlpha = ctx.globalAlpha;
            const prevComp = ctx.globalCompositeOperation;
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = strokeOpacity;
            ctx.drawImage(calligraphyOffscreenCanvas, 0, 0);
            ctx.globalAlpha = prevAlpha;
            ctx.globalCompositeOperation = prevComp;
            [lastX, lastY] = [x, y];
        } else {
            if (savedCanvasState) ctx.putImageData(savedCanvasState, 0, 0);
            
            if (activeTool.includes('brush') || activeTool.includes('eraser')) {
                renderStandardStroke(x, y);
            } else if (activeTool.includes('rect') || activeTool.includes('circle')) {
                drawShape(x, y);
            }
        }
    }
    
    /** Render a typical freehand stroke (brush/eraser), including symmetry if enabled. */
    function renderStandardStroke(x, y) {
        currentPath.lineTo(x, y);
        ctx.stroke(currentPath);

        if (isSymmetryMode && symmetryPath) {
            symmetryPath.lineTo(cssWidth - x, y);
            ctx.stroke(symmetryPath);
        }
    }

    /**
     * Stamp an elliptical nib for the calligraphy brush at the given point.
     * This builds up a stroke by repeated stamps along the path.
     */
    function stampCalligraphyNib(targetCtx, x, y, angleRad) {
        targetCtx.save();
        targetCtx.translate(x, y);
        targetCtx.rotate(angleRad);
        targetCtx.beginPath();
        targetCtx.ellipse(0, 0, currentBrushSize / 2, (currentBrushSize * nibAspect) / 2, 0, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.restore();
    }

    /**
     * Interpolate between two points and stamp nibs along the way to create
     * a smooth calligraphy stroke. Mirrors if symmetry is enabled.
     */
    function drawCalligraphySegment(targetCtx, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) {
            stampCalligraphyNib(targetCtx, x2, y2, nibAngle);
            if (isSymmetryMode) stampCalligraphyNib(targetCtx, canvas.width - x2, y2, -nibAngle);
            return;
        }
        const spacing = Math.max(1, currentBrushSize * 0.3);
        const steps = Math.ceil(dist / spacing);
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = x1 + dx * t;
            const py = y1 + dy * t;
            stampCalligraphyNib(targetCtx, px, py, nibAngle);
            if (isSymmetryMode) {
                stampCalligraphyNib(targetCtx, cssWidth - px, py, -nibAngle);
            }
        }
    }

    // --- Batched spray brush -------------------------------------------------
    const sprayQueue = [];
    let sprayRaf = null;
    function flushSpray() {
        sprayRaf = null;
        if (!sprayQueue.length) return;
        ctx.save();
        ctx.globalCompositeOperation = activeTool === 'eraser-tool' ? 'destination-out' : 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = hexToRgba(currentColor, sprayOpacity);
        const p = new Path2D();
        for (let i = 0; i < sprayQueue.length; i++) {
            const s = sprayQueue[i];
            p.rect(s.x, s.y, 1, 1);
            if (s.mx !== undefined) p.rect(s.mx, s.y, 1, 1);
        }
        ctx.fill(p);
        ctx.restore();
        sprayQueue.length = 0;
    }
    /** Spray paint tool: enqueue tiny squares; flushed in one fill per frame. */
    function sprayBrush(x, y) {
        for (let i = 0; i < sprayStrength; i++) {
            const offsetX = (Math.random() - 0.5) * currentBrushSize * 2;
            const offsetY = (Math.random() - 0.5) * currentBrushSize * 2;
            if (Math.hypot(offsetX, offsetY) < currentBrushSize) {
                const sx = x + offsetX;
                const sy = y + offsetY;
                const sample = { x: sx, y: sy };
                if (isSymmetryMode) sample.mx = cssWidth - x - offsetX;
                sprayQueue.push(sample);
            }
        }
        if (!sprayRaf) sprayRaf = requestAnimationFrame(flushSpray);
    }
 
    /** Draw a rectangle or circle based on drag start and current cursor position. */
    function drawShape(endX, endY) {
        const startX = Math.min(shapeStartX, endX);
        const startY = Math.min(shapeStartY, endY);
        const width = Math.abs(endX - shapeStartX);
        const height = Math.abs(endY - shapeStartY);

        const needsSharpStrokeCorners = (activeTool === 'rect-tool' && !isRoundedRect && !isShapeFilled);
        if (needsSharpStrokeCorners) {
            ctx.save();
            ctx.lineJoin = 'miter';
            ctx.miterLimit = 10;
            ctx.lineCap = 'butt';
        }

        ctx.beginPath();
        if (activeTool === 'rect-tool') {
            if (isRoundedRect) {
                const path = roundedRectPath(startX, startY, width, height, Math.min(20, Math.min(width, height) * 0.2));
                isShapeFilled ? ctx.fill(path) : ctx.stroke(path);
            } else {
                ctx.rect(startX, startY, width, height);
                isShapeFilled ? ctx.fill() : ctx.stroke();
            }
        } else if (activeTool === 'circle-tool') {
            const radius = Math.hypot(width, height) / 2;
            ctx.arc(startX + width/2, startY + height/2, radius, 0, Math.PI * 2);
            isShapeFilled ? ctx.fill() : ctx.stroke();
        }

        if (isSymmetryMode) {
            ctx.beginPath();
            if (activeTool === 'rect-tool') {
                if (isRoundedRect) {
                    const path = roundedRectPath(cssWidth - startX - width, startY, width, height, Math.min(20, Math.min(width, height) * 0.2));
                    isShapeFilled ? ctx.fill(path) : ctx.stroke(path);
                } else {
                    ctx.rect(cssWidth - startX - width, startY, width, height);
                    isShapeFilled ? ctx.fill() : ctx.stroke();
                }
            } else if (activeTool === 'circle-tool') {
                const radius = Math.hypot(width, height) / 2;
                ctx.arc(cssWidth - (startX + width/2), startY + height/2, radius, 0, Math.PI * 2);
                isShapeFilled ? ctx.fill() : ctx.stroke();
            }
        }

        if (needsSharpStrokeCorners) {
            ctx.restore();
        }
    }

    /** Build a rounded-rectangle Path2D with clamped radius. */
    function roundedRectPath(x, y, w, h, r) {
        const path = new Path2D();
        const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        path.moveTo(x + rr, y);
        path.lineTo(x + w - rr, y);
        path.quadraticCurveTo(x + w, y, x + w, y + rr);
        path.lineTo(x + w, y + h - rr);
        path.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
        path.lineTo(x + rr, y + h);
        path.quadraticCurveTo(x, y + h, x, y + h - rr);
        path.lineTo(x, y + rr);
        path.quadraticCurveTo(x, y, x + rr, y);
        path.closePath();
        return path;
    }

    /**
     * Pointer down: initialize tool-specific state and capture a canvas snapshot
     * for live preview (except for spray, which draws directly).
     */
    function startDrawing(e) {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];

        ctx.globalCompositeOperation = activeTool === 'eraser-tool' ? 'destination-out' : 'source-over';
        ctx.globalAlpha = (activeTool === 'spray-brush-tool') ? 1.0 : currentOpacity;
        ctx.strokeStyle = currentColor;
        ctx.fillStyle = currentColor;
        ctx.lineWidth = currentBrushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (activeTool !== 'spray-brush-tool') {
            savedCanvasState = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
        
        if (activeTool.includes('rect') || activeTool.includes('circle')) {
            [shapeStartX, shapeStartY] = [e.offsetX, e.offsetY];
        } else if (activeTool === 'calligraphy-brush-tool') {
            calligraphyOffscreenCanvas = document.createElement('canvas');
            calligraphyOffscreenCanvas.width = canvas.width;
            calligraphyOffscreenCanvas.height = canvas.height;
            calligraphyOffCtx = calligraphyOffscreenCanvas.getContext('2d');
            calligraphyOffCtx.clearRect(0, 0, canvas.width, canvas.height);
            calligraphyOffCtx.globalCompositeOperation = 'source-over';
            calligraphyOffCtx.globalAlpha = 1.0;
            calligraphyOffCtx.fillStyle = currentColor;
            calligraphyPoints = [{ x: lastX, y: lastY }];
            strokeOpacity = currentOpacity;
        } else if (activeTool.includes('brush') || activeTool.includes('eraser')) {
            currentPath = new Path2D();
            currentPath.moveTo(lastX, lastY);
            if (isSymmetryMode) {
                symmetryPath = new Path2D();
                symmetryPath.moveTo(canvas.width - lastX, lastY);
            }
        }
    }

    /** Pointer up/leave: finalize rendering and push to history. */
    function stopDrawing(e) {
        if (!isDrawing) return;
        isDrawing = false;
        
        if (activeTool !== 'spray-brush-tool' && savedCanvasState) {
            ctx.putImageData(savedCanvasState, 0, 0);
            
            if (activeTool === 'calligraphy-brush-tool') {
                ctx.save();
                const prevAlpha = ctx.globalAlpha;
                const prevComp = ctx.globalCompositeOperation;
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = strokeOpacity;
                ctx.drawImage(calligraphyOffscreenCanvas, 0, 0);
                ctx.globalAlpha = prevAlpha;
                ctx.globalCompositeOperation = prevComp;
            } else if (activeTool.includes('rect') || activeTool.includes('circle')) {
                drawShape(e.offsetX, e.offsetY);
            } else if (activeTool.includes('brush') || activeTool.includes('eraser')) {
                if (currentPath) ctx.stroke(currentPath);
                if (symmetryPath) ctx.stroke(symmetryPath);
            }
        }

        saveHistory();
        
        savedCanvasState = null;
        currentPath = null;
        symmetryPath = null;
        calligraphyPoints = [];
        calligraphyOffCtx = null;
        calligraphyOffscreenCanvas = null;
    }

    /** Activate a tool by id and adjust UI + cursor + primary slider semantics. */
    function setActiveTool(toolId) {
        activeTool = toolId;
        document.querySelectorAll('.tool-btn[id$="-tool"]').forEach(btn => {
            btn.classList.toggle('active', btn.id === toolId);
            btn.setAttribute('aria-pressed', String(btn.id === toolId));
        });
        canvas.className = `cursor-${toolId}`;
        if (toolId === 'spray-brush-tool') {
            primarySliderLabel.textContent = "Strength:";
            primarySlider.min = 5;
            primarySlider.max = 50;
            primarySlider.step = 1;
            primarySlider.value = sprayStrength;
            sprayOpacityContainer.style.display = 'flex';
        } else {
            primarySliderLabel.textContent = "Opacity:";
            primarySlider.min = 0.1;
            primarySlider.max = 1;
            primarySlider.step = 0.1;
            primarySlider.value = currentOpacity;
            sprayOpacityContainer.style.display = 'none';
        }
        if (roundedToggle) {
            roundedToggle.style.display = (toolId === 'rect-tool') ? 'grid' : 'none';
            roundedToggle.classList.toggle('active', isRoundedRect);
            roundedToggle.setAttribute('aria-pressed', String(isRoundedRect));
        }
    }
    
    /** Show a live brush-sized overlay following the cursor (for brush/eraser/calligraphy). */
    function updateBrushCursorPreview(e) {
        if (isMouseOverToolbar || isDrawing) {
            brushPreview.style.display = 'none';
            return;
        }
        const showPreview = activeTool.includes('brush') || activeTool === 'eraser-tool';
        brushPreview.style.display = showPreview ? 'block' : 'none';
        canvas.classList.toggle('hide-cursor', showPreview);

        if (showPreview && e) {
            const isCalligraphy = activeTool === 'calligraphy-brush-tool';
            const w = currentBrushSize;
            const h = isCalligraphy ? currentBrushSize * nibAspect : currentBrushSize;
            brushPreview.style.width = `${w}px`;
            brushPreview.style.height = `${h}px`;
            brushPreview.style.left = `${e.clientX}px`;
            brushPreview.style.top = `${e.clientY}px`;
            brushPreview.style.borderRadius = '50%';
            const rot = isCalligraphy ? ` rotate(${nibAngleDeg}deg)` : '';
            brushPreview.style.transform = `translate(-50%, -50%)${rot}`;
            try { brushPreview.style.backgroundColor = hexToRgba(currentColor, 0.2); } catch (_) {}
        }
    }

    // --- Random shape helpers (used by potential future tools/features) ---
    function generateRandomShapePoints(size) {
           const half = size / 2;
           const angleOffset = Math.random() * Math.PI * 2;
           const points = [];
           const shapeType = pickOne(['triangle','polygon','star','blob']);
           switch (shapeType) {
               case 'triangle': {
                   for (let i = 0; i < 3; i++) {
                       const ang = angleOffset + i * (2 * Math.PI / 3);
                       const r = half * (0.8 + Math.random() * 0.4);
                       points.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
                   }
                   break;
               }
               case 'polygon': {
                   const sides = 4 + Math.floor(Math.random() * 4);
                   for (let i = 0; i < sides; i++) {
                       const ang = angleOffset + i * (2 * Math.PI / sides);
                       const r = half * (0.7 + Math.random() * 0.6);
                       points.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
                   }
                   break;
               }
               case 'star': {
                   const spikes = 5 + Math.floor(Math.random() * 3);
                   const inner = half * 0.4;
                   const outer = half;
                   for (let i = 0; i < spikes * 2; i++) {
                       const r = i % 2 === 0 ? outer : inner;
                       const ang = angleOffset + i * (Math.PI / spikes);
                       points.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
                   }
                   break;
               }
               case 'blob':
               default: {
                   const count = 8 + Math.floor(Math.random() * 6);
                   for (let i = 0; i < count; i++) {
                       const ang = angleOffset + i * (2 * Math.PI / count);
                       const r = half * (0.6 + Math.random() * 0.6);
                       const jx = (Math.random() * 2 - 1) * size * 0.05;
                       const jy = (Math.random() * 2 - 1) * size * 0.05;
                       points.push({ x: Math.cos(ang) * r + jx, y: Math.sin(ang) * r + jy });
                   }
                   break;
               }
           }
           return points;
       }

       function paintShape(ctx2, cx, cy, points) {
           if (!points || points.length === 0) return;
           const path = new Path2D();
           path.moveTo(cx + points[0].x, cy + points[0].y);
           for (let i = 1; i < points.length; i++) {
               path.lineTo(cx + points[i].x, cy + points[i].y);
           }
           path.closePath();
           if (isShapeFilled) ctx2.fill(path); else ctx2.stroke(path);
       }

       function drawRandomShape(targetCtx, x, y, size, color, mirror) {
           const points = generateRandomShapePoints(size);
           targetCtx.save();
           targetCtx.fillStyle = color;
           targetCtx.strokeStyle = color;
           targetCtx.lineWidth = Math.max(1, size * 0.1);
           paintShape(targetCtx, x, y, points);
           if (mirror) {
               const mx = canvas.width - x;
               paintShape(targetCtx, mx, y, points);
           }
           targetCtx.restore();
       }

       function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    
    /** Temporarily show a centered overlay matching the current brush size. */
    function showBrushSizePreview() {
        brushPreview.style.display = 'none';
        const isCalligraphy = activeTool === 'calligraphy-brush-tool';
        const w = currentBrushSize;
        const h = isCalligraphy ? currentBrushSize * nibAspect : currentBrushSize;
        brushSizePreview.style.width = `${w}px`;
        brushSizePreview.style.height = `${h}px`;
        const baseTranslate = 'translate(-50%, -50%)';
        brushSizePreview.style.transform = isCalligraphy
            ? `${baseTranslate} rotate(${nibAngleDeg}deg)`
            : baseTranslate;
        try {
            brushSizePreview.style.backgroundColor = hexToRgba(currentColor, 0.3);
        } catch (_) {
        }
        brushSizePreview.classList.remove('hidden');
        clearTimeout(sliderTimeout);
        sliderTimeout = setTimeout(() => brushSizePreview.classList.add('hidden'), 1000);
    }
    
    /** Drag handler to move the floating toolbar around the screen. */
    function dragToolbar(e) {
        if (!isDraggingToolbar) return;
        toolbar.style.transform = 'translateX(0)';
        toolbar.style.left = `${e.clientX - dragOffsetX}px`;
        toolbar.style.top = `${e.clientY - dragOffsetY}px`;
    }

    /** Stop dragging the toolbar and remove listeners. */
    function stopDragToolbar() {
        isDraggingToolbar = false;
        window.removeEventListener('mousemove', dragToolbar);
        window.removeEventListener('mouseup', stopDragToolbar);
    }

    canvas.addEventListener('mousedown', (e) => { if (!isMouseOverToolbar) startDrawing(e); });
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', () => { if (isDrawing) stopDrawing({offsetX: lastX, offsetY: lastY}); });
    
    window.addEventListener('mousemove', updateBrushCursorPreview);
    
    toolbar.addEventListener('mouseenter', () => { isMouseOverToolbar = true; updateBrushCursorPreview(); });
    toolbar.addEventListener('mouseleave', () => { isMouseOverToolbar = false; updateBrushCursorPreview(); });
    toolbar.addEventListener('mousedown', (e) => {
        if (e.target.closest('button, input, select, .palette-swatch, .color-picker-popup, .color-swatch')) return;
        isDraggingToolbar = true;
        const rect = toolbar.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        window.addEventListener('mousemove', dragToolbar);
        window.addEventListener('mouseup', stopDragToolbar);
    });

    document.querySelectorAll('.tool-btn[id$="-tool"]').forEach(btn => btn.addEventListener('click', () => setActiveTool(btn.id)));

    colorPicker.addEventListener('input', (e) => {
        currentColor = e.target.value;
        if (customSwatch) customSwatch.style.background = currentColor;
        if (cpHex && cpHex !== document.activeElement) cpHex.value = currentColor;
        try {
            const hsv = hexToHsv(currentColor);
            hue = hsv.h; sat = hsv.s; val = hsv.v;
            drawHue();
            drawSV();
        } catch(_) {}
        updateHarmonyPalette();
    });
    harmonySelector.addEventListener('change', updateHarmonyPalette);
    paletteContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('palette-swatch')) {
            colorPicker.value = e.target.dataset.hex;
            colorPicker.dispatchEvent(new Event('input'));
        }
    });

    brushSizeSlider.addEventListener('input', (e) => { currentBrushSize = Number(e.target.value); showBrushSizePreview(); });
    
    primarySlider.addEventListener('input', (e) => {
        if (activeTool === 'spray-brush-tool') {
            sprayStrength = Number(e.target.value);
        } else {
            currentOpacity = Number(e.target.value);
        }
    });

    sprayOpacitySlider.addEventListener('input', (e) => { sprayOpacity = Number(e.target.value); });

    symmetryToggle.addEventListener('click', () => {
        isSymmetryMode = !isSymmetryMode;
        symmetryToggle.classList.toggle('active', isSymmetryMode);
        symmetryToggle.setAttribute('aria-pressed', String(isSymmetryMode));
    });
    if (roundedToggle) {
        roundedToggle.addEventListener('click', () => {
            isRoundedRect = !isRoundedRect;
            roundedToggle.classList.toggle('active', isRoundedRect);
            roundedToggle.setAttribute('aria-pressed', String(isRoundedRect));
        });
    }
    fillShapeToggle.addEventListener('click', () => {
        isShapeFilled = !isShapeFilled;
        fillShapeToggle.classList.toggle('active', isShapeFilled);
        fillShapeToggle.setAttribute('aria-pressed', String(isShapeFilled));
    });
    /** Open export modal (or fallback to immediate PNG download if modal missing). */
    function openSaveModal() {
        if (!saveModal) {
            const f = 'png';
            downloadLink.href = canvas.toDataURL(`image/${f}`);
            downloadLink.download = `drawing.${f}`;
            downloadLink.click();
            return;
        }
        if (!saveFilename.value) saveFilename.value = 'drawing';
        if (!saveScale.value || Number(saveScale.value) <= 0) saveScale.value = 1;
        updateQualityVisibility();
        updateQualityLabel();
        saveModal.classList.remove('is-hidden');
    }

    /** Close export modal. */
    function closeSaveModal() {
        if (saveModal) saveModal.classList.add('is-hidden');
    }

    /** Only show quality slider for lossy formats (jpeg/webp). */
    function updateQualityVisibility() {
        if (!saveFormat || !saveQualityRow) return;
        const fmt = saveFormat.value;
        const needsQuality = (fmt === 'jpeg' || fmt === 'webp');
        saveQualityRow.style.display = needsQuality ? '' : 'none';
        if (needsQuality && !saveQuality.value) saveQuality.value = 0.92;
    }

    /** Reflect numeric quality value as percentage label. */
    function updateQualityLabel() {
        if (saveQuality && saveQualityVal) {
            const q = Math.max(0.5, Math.min(1, Number(saveQuality.value) || 0.92));
            saveQualityVal.textContent = `${Math.round(q * 100)}%`;
        }
    }

    /**
     * Render canvas to an offscreen canvas with optional background + scale
     * and trigger a download in the chosen format.
     */
    function performExport() {
        const fmt = (saveFormat?.value || 'png').toLowerCase();
        let filename = (saveFilename?.value || 'drawing').trim();
        if (!filename) filename = 'drawing';
        const scale = Math.max(0.1, Number(saveScale?.value || 1));
        let bg = saveBg?.value || 'transparent';
        if ((fmt === 'jpeg' || fmt === 'webp') && bg === 'transparent') bg = 'white';
        const mime = fmt === 'jpeg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png';
        const quality = (fmt === 'jpeg' || fmt === 'webp') ? Math.max(0.5, Math.min(1, Number(saveQuality?.value || 0.92))) : undefined;

        const outW = Math.max(1, Math.round(canvas.width * scale));
        const outH = Math.max(1, Math.round(canvas.height * scale));
        const off = document.createElement('canvas');
        off.width = outW; off.height = outH;
        const octx = off.getContext('2d');
        if (bg !== 'transparent') {
            octx.save();
            octx.globalCompositeOperation = 'source-over';
            let fill = '#ffffff';
            if (bg === 'white') fill = '#ffffff';
            else if (bg === 'color') fill = currentColor;
            octx.fillStyle = fill;
            octx.fillRect(0, 0, outW, outH);
            octx.restore();
        } else {
            octx.clearRect(0, 0, outW, outH);
        }
        octx.imageSmoothingEnabled = true;
        octx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, outW, outH);

        const dataUrl = quality !== undefined ? off.toDataURL(mime, quality) : off.toDataURL(mime);
        const ext = fmt === 'jpeg' ? 'jpg' : fmt;
        downloadLink.href = dataUrl;
        downloadLink.download = `${filename}.${ext}`;
        downloadLink.click();
        closeSaveModal();
    }

    saveBtn.addEventListener('click', openSaveModal);
    saveModalClose?.addEventListener('click', closeSaveModal);
    saveCancel?.addEventListener('click', closeSaveModal);
    saveConfirm?.addEventListener('click', performExport);
    saveFormat?.addEventListener('change', () => { updateQualityVisibility(); });
    saveQuality?.addEventListener('input', updateQualityLabel);
    saveModal?.addEventListener('click', (e) => {
        if (e.target === saveModal) closeSaveModal();
    });
    // Help modal open/close
    function openHelp() { helpModal?.classList.remove('is-hidden'); }
    function closeHelp() { helpModal?.classList.add('is-hidden'); }
    helpBtn?.addEventListener('click', openHelp);
    helpModalClose?.addEventListener('click', closeHelp);
    helpOk?.addEventListener('click', closeHelp);
    helpModal?.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });
    // Keyboard shortcuts for app-level actions
    window.addEventListener('keydown', (e) => {
        if (!saveModal || saveModal.classList.contains('is-hidden')) return;
        if (e.key === 'Escape') { e.preventDefault(); closeSaveModal(); }
        if (e.key === 'Enter') { e.preventDefault(); performExport(); }
    });
    clearButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the canvas?')) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            saveHistory();
            persistCanvas();
        }
    });
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    
    // Global keyboard shortcuts (tools, symmetry, fill, color picker toggle)
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') { e.preventDefault(); undo(); }
            if (e.key === 'y') { e.preventDefault(); redo(); }
            if (e.key === 's') { e.preventDefault(); saveBtn.click(); }
        } else {
            if (document.activeElement.tagName === 'INPUT') return;
            const keyMap = {'b':'brush-tool','n':'calligraphy-brush-tool','v':'spray-brush-tool','e':'eraser-tool','r':'rect-tool','o':'circle-tool'};
            if (keyMap[e.key]) setActiveTool(keyMap[e.key]);
            if (e.key === 'm') symmetryToggle.click();
            if (e.key === 'f') fillShapeToggle.click();
            if (e.key === 'c') {
                if (customPicker && customSwatch) {
                    const show = customPicker.classList.contains('is-hidden');
                    if (show) positionPickerBelow(customSwatch);
                    togglePicker(show);
                }
            } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
                e.preventDefault();
                openHelp();
            }
        }
    });
    
    // --- Persistence ---------------------------------------------------------
    const LS_KEY_IMG = 'pixelpad:canvas';
    const LS_KEY_SETTINGS = 'pixelpad:settings';
    function persistCanvas() {
        try { localStorage.setItem(LS_KEY_IMG, canvas.toDataURL()); } catch(_) {}
    }
    function persistSettings() {
        const settings = {
            currentColor, currentBrushSize, currentOpacity, sprayStrength, sprayOpacity,
            activeTool, isSymmetryMode, isShapeFilled, isRoundedRect, nibAngleDeg, nibAspect
        };
        try { localStorage.setItem(LS_KEY_SETTINGS, JSON.stringify(settings)); } catch(_) {}
    }
    function restoreFromStorage() {
        try {
            const s = JSON.parse(localStorage.getItem(LS_KEY_SETTINGS) || 'null');
            if (s) {
                currentColor = s.currentColor ?? currentColor;
                currentBrushSize = s.currentBrushSize ?? currentBrushSize;
                currentOpacity = s.currentOpacity ?? currentOpacity;
                sprayStrength = s.sprayStrength ?? sprayStrength;
                sprayOpacity = s.sprayOpacity ?? sprayOpacity;
                isSymmetryMode = !!s.isSymmetryMode;
                isShapeFilled = !!s.isShapeFilled;
                isRoundedRect = s.isRoundedRect ?? isRoundedRect;
                nibAngleDeg = s.nibAngleDeg ?? nibAngleDeg;
                nibAngle = (nibAngleDeg * Math.PI) / 180;
                nibAspect = s.nibAspect ?? nibAspect;
                // Reflect UI
                colorPicker.value = currentColor;
                colorPicker.dispatchEvent(new Event('input'));
                brushSizeSlider.value = String(currentBrushSize);
                primarySlider.value = String(currentOpacity);
                sprayOpacitySlider.value = String(sprayOpacity);
                symmetryToggle.classList.toggle('active', isSymmetryMode);
                symmetryToggle.setAttribute('aria-pressed', String(isSymmetryMode));
                fillShapeToggle.classList.toggle('active', isShapeFilled);
                fillShapeToggle.setAttribute('aria-pressed', String(isShapeFilled));
                roundedToggle?.classList.toggle('active', isRoundedRect);
                if (s.activeTool) setActiveTool(s.activeTool);
            }
            const img = localStorage.getItem(LS_KEY_IMG);
            if (img) {
                const image = new Image();
                image.onload = () => {
                    ctx.drawImage(image, 0, 0, cssWidth, cssHeight);
                    saveHistory();
                };
                image.src = img;
            } else {
                saveHistory();
            }
        } catch(_) {
            saveHistory();
        }
    }
    // Persist on key interactions
    [brushSizeSlider, primarySlider, sprayOpacitySlider, harmonySelector].forEach(el => el?.addEventListener('input', persistSettings));
    [symmetryToggle, fillShapeToggle, roundedToggle].forEach(el => el?.addEventListener('click', persistSettings));
    document.querySelectorAll('.tool-btn[id$="-tool"]').forEach(btn => btn.addEventListener('click', () => { persistSettings(); }));
    // Save canvas after drawing stops and on export
    const origStopDrawing = stopDrawing;
    stopDrawing = function(e) { origStopDrawing(e); persistCanvas(); };
    const origPerformExport = performExport;
    performExport = function() { origPerformExport(); persistCanvas(); };

    // Initialize history and settings
    restoreFromStorage();
    updateUndoRedoButtons();
    setActiveTool(activeTool || 'brush-tool');
    updateHarmonyPalette();

    // --- Custom color picker (SV/H) ---
    /** Show/hide the custom color picker and sync controls with current color. */
    function togglePicker(show) {
        if (!customPicker) return;
        customPicker.classList.toggle('is-hidden', !show);
        if (show) {
            const hsv = hexToHsv(currentColor);
            hue = hsv.h; sat = hsv.s; val = hsv.v;
            drawHue();
            drawSV();
            if (cpHex) cpHex.value = currentColor;
        }
    }
    /** Position the picker centered below a given anchor element. */
    function positionPickerBelow(anchorEl) {
        const r = anchorEl.getBoundingClientRect();
        customPicker.style.left = `${r.left + r.width/2}px`;
        customPicker.style.top = `${r.bottom + 8}px`;
        customPicker.style.transform = 'translateX(-50%)';
    }
    /** Render the vertical hue gradient + indicator. */
    function drawHue() {
        if (!cpH) return;
        const hCtx = cpH.getContext('2d');
        const {width, height} = cpH;
        const grad = hCtx.createLinearGradient(0, 0, 0, height);
        const colors = ['#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#ff0000'];
        for (let i = 0; i < colors.length; i++) grad.addColorStop(i/(colors.length-1), colors[i]);
        hCtx.clearRect(0, 0, width, height);
        hCtx.fillStyle = grad;
        hCtx.fillRect(0, 0, width, height);
        const y = hue * height;
        hCtx.strokeStyle = '#000';
        hCtx.lineWidth = 2;
        hCtx.beginPath();
        hCtx.moveTo(0, y);
        hCtx.lineTo(width, y);
        hCtx.stroke();
    }
    /** Render the saturation/value square for the selected hue. */
    function drawSV() {
        if (!cpSV) return;
        const sCtx = cpSV.getContext('2d');
        const {width, height} = cpSV;
        const hueHex = hsvToHex(hue, 1, 1);
        sCtx.clearRect(0, 0, width, height);
        const gx = sCtx.createLinearGradient(0, 0, width, 0);
        gx.addColorStop(0, '#ffffff');
        gx.addColorStop(1, hueHex);
        sCtx.fillStyle = gx;
        sCtx.fillRect(0, 0, width, height);
        const gy = sCtx.createLinearGradient(0, 0, 0, height);
        gy.addColorStop(0, 'rgba(0,0,0,0)');
        gy.addColorStop(1, 'rgba(0,0,0,1)');
        sCtx.fillStyle = gy;
        sCtx.fillRect(0, 0, width, height);
        const x = sat * width;
        const y = (1 - val) * height;
        sCtx.lineWidth = 2;
        sCtx.strokeStyle = val > 0.5 ? '#000' : '#fff';
        sCtx.beginPath();
        sCtx.arc(x, y, 6, 0, Math.PI*2);
        sCtx.stroke();
    }
    /** Update hue based on mouse/touch Y within hue canvas. */
    function setHueFromY(clientY) {
        const r = cpH.getBoundingClientRect();
        const t = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
        hue = t;
        drawHue();
        drawSV();
        commitColor();
    }
    /** Update saturation/value based on mouse/touch position in SV canvas. */
    function setSVFromEvent(clientX, clientY) {
        const r = cpSV.getBoundingClientRect();
        const tx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
        const ty = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
        sat = tx; val = 1 - ty;
        drawSV();
        commitColor();
    }
    /** Commit current HSV to hex, update inputs, and notify app via input event. */
    function commitColor() {
        const hex = hsvToHex(hue, sat, val);
        if (colorPicker.value.toLowerCase() !== hex) {
            colorPicker.value = hex;
            colorPicker.dispatchEvent(new Event('input', {bubbles:true}));
        } else {
            if (customSwatch) customSwatch.style.background = hex;
            if (cpHex && cpHex !== document.activeElement) cpHex.value = hex;
        }
    }
    if (customSwatch) {
        customSwatch.style.background = currentColor;
        customSwatch.addEventListener('click', (e) => {
            positionPickerBelow(customSwatch);
            togglePicker(true);
            e.stopPropagation();
        });
    }
    if (cpClose) cpClose.addEventListener('click', () => togglePicker(false));
    document.addEventListener('click', (e) => {
        if (!customPicker || customPicker.classList.contains('is-hidden')) return;
        if (!customPicker.contains(e.target) && e.target !== customSwatch) togglePicker(false);
    });
    if (cpH) {
        const stop = (e)=>{e.stopPropagation(); e.preventDefault();};
        cpH.addEventListener('mousedown', (e)=>{isDraggingH=true; setHueFromY(e.clientY); stop(e);});
        window.addEventListener('mousemove', (e)=>{ if (isDraggingH) { setHueFromY(e.clientY); e.preventDefault(); }});
        window.addEventListener('mouseup', ()=>{ isDraggingH=false; });
        cpH.addEventListener('touchstart', (e)=>{isDraggingH=true; setHueFromY(e.touches[0].clientY); stop(e);}, {passive:false});
        window.addEventListener('touchmove', (e)=>{ if (isDraggingH) { setHueFromY(e.touches[0].clientY); e.preventDefault(); }}, {passive:false});
        window.addEventListener('touchend', ()=>{ isDraggingH=false; });
    }
    if (cpSV) {
        const stop = (e)=>{e.stopPropagation(); e.preventDefault();};
        cpSV.addEventListener('mousedown', (e)=>{isDraggingSV=true; setSVFromEvent(e.clientX, e.clientY); stop(e);});
        window.addEventListener('mousemove', (e)=>{ if (isDraggingSV) { setSVFromEvent(e.clientX, e.clientY); e.preventDefault(); }});
        window.addEventListener('mouseup', ()=>{ isDraggingSV=false; });
        cpSV.addEventListener('touchstart', (e)=>{isDraggingSV=true; const t=e.touches[0]; setSVFromEvent(t.clientX, t.clientY); stop(e);}, {passive:false});
        window.addEventListener('touchmove', (e)=>{ if (isDraggingSV) { const t=e.touches[0]; setSVFromEvent(t.clientX, t.clientY); e.preventDefault(); }}, {passive:false});
        window.addEventListener('touchend', ()=>{ isDraggingSV=false; });
    }
});

// Build and display a small palette of harmonious colors beside the picker
function updateHarmonyPalette() {
    try {
        const base = document.getElementById('color-picker').value || '#ff9500';
        const mode = (document.getElementById('harmony-selector')?.value) || 'triadic';
        const pC = document.getElementById('palette-container');
        if (!pC) return;
        pC.innerHTML = '';
        const colors = [];
        const {h,s,l} = hexToHsl(base);
        if (mode === 'complementary') {
            colors.push(base);
            colors.push(hslToHex(rotateHue(h, 180), s, l));
        } else if (mode === 'analogous') {
            colors.push(hslToHex(rotateHue(h, -30), s, l));
            colors.push(base);
            colors.push(hslToHex(rotateHue(h, 30), s, l));
        } else {
            colors.push(base);
            colors.push(hslToHex(rotateHue(h, 120), s, l));
            colors.push(hslToHex(rotateHue(h, -120), s, l));
        }
        colors.forEach((c, idx) => {
            const el = document.createElement('div');
            el.className = 'palette-swatch';
            el.style.backgroundColor = c;
            el.dataset.hex = c;
            if (c.toLowerCase() === base.toLowerCase()) el.style.border = '2px solid #333';
            pC.appendChild(el);
        });
    } catch (_) {}
}