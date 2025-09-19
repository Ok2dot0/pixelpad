window.addEventListener('load', () => {

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

    let isDrawing = false;
    let activeTool = 'brush-tool';
    let lastX = 0, lastY = 0;

    let currentColor = '#ff9500';
    let currentBrushSize = 10;
    let currentOpacity = 1;
    let sprayStrength = 20;
    let sprayOpacity = 1;
    let isSymmetryMode = false;
    let isShapeFilled = false;
    let isRoundedRect = true;

    let nibAngleDeg = -35;
    let nibAngle = (nibAngleDeg * Math.PI) / 180;
    let nibAspect = 0.35;
    let calligraphyPoints = [];
    let calligraphyOffscreenCanvas = null;
    let calligraphyOffCtx = null;
    let strokeOpacity = 1;

    let shapeStartX = 0, shapeStartY = 0;
    let savedCanvasState; 
    let currentPath;
    let symmetryPath;

    let history = [];
    let historyStep = -1;

    let isDraggingToolbar = false;
    let dragOffsetX = 0, dragOffsetY = 0;
    let isMouseOverToolbar = false;
    let sliderTimeout; 
    let hue = 30/360;
    let sat = 1;
    let val = 1;
    let isDraggingSV = false;
    let isDraggingH = false;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    function saveHistory() {
        if (historyStep < history.length - 1) {
            history = history.slice(0, historyStep + 1);
        }
        history.push(canvas.toDataURL());
        historyStep++;
        updateUndoRedoButtons();
    }

    function loadState(stateData) {
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = stateData;
    }

    function undo() {
        if (historyStep > 0) {
            historyStep--;
            loadState(history[historyStep]);
            updateUndoRedoButtons();
        }
    }

    function redo() {
        if (historyStep < history.length - 1) {
            historyStep++;
            loadState(history[historyStep]);
            updateUndoRedoButtons();
        }
    }

    function updateUndoRedoButtons() {
        undoBtn.disabled = historyStep <= 0;
        redoBtn.disabled = historyStep >= history.length - 1;
    }

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
    
    function renderStandardStroke(x, y) {
        currentPath.lineTo(x, y);
        ctx.stroke(currentPath);

        if (isSymmetryMode && symmetryPath) {
            symmetryPath.lineTo(canvas.width - x, y);
            ctx.stroke(symmetryPath);
        }
    }

    function stampCalligraphyNib(targetCtx, x, y, angleRad) {
        targetCtx.save();
        targetCtx.translate(x, y);
        targetCtx.rotate(angleRad);
        targetCtx.beginPath();
        targetCtx.ellipse(0, 0, currentBrushSize / 2, (currentBrushSize * nibAspect) / 2, 0, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.restore();
    }

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
                stampCalligraphyNib(targetCtx, canvas.width - px, py, -nibAngle);
            }
        }
    }

    function sprayBrush(x, y) {
        ctx.fillStyle = hexToRgba(currentColor, sprayOpacity); 
        for (let i = 0; i < sprayStrength; i++) {
            const offsetX = (Math.random() - 0.5) * currentBrushSize * 2;
            const offsetY = (Math.random() - 0.5) * currentBrushSize * 2;
            if (Math.hypot(offsetX, offsetY) < currentBrushSize) {
                ctx.fillRect(x + offsetX, y + offsetY, 1, 1);
                if (isSymmetryMode) {
                    ctx.fillRect(canvas.width - x - offsetX, y + offsetY, 1, 1);
                }
            }
        }
    }

    function drawShape(endX, endY) {
        const startX = Math.min(shapeStartX, endX);
        const startY = Math.min(shapeStartY, endY);
        const width = Math.abs(endX - shapeStartX);
        const height = Math.abs(endY - shapeStartY);

        ctx.beginPath();
        if (activeTool === 'rect-tool') {
            if (!isShapeFilled && isRoundedRect) {
                const path = roundedRectPath(startX, startY, width, height, Math.min(20, Math.min(width, height) * 0.2));
                isShapeFilled ? ctx.fill(path) : ctx.stroke(path);
            } else {
                ctx.rect(startX, startY, width, height);
                isShapeFilled ? ctx.fill() : ctx.stroke();
            }
        } else if (activeTool === 'circle-tool') {
            const radius = Math.hypot(width, height) / 2;
            ctx.arc(startX + width/2, startY + height/2, radius, 0, 2 * Math.PI);
            isShapeFilled ? ctx.fill() : ctx.stroke();
        }

        if (isSymmetryMode) {
            ctx.beginPath();
            if (activeTool === 'rect-tool') {
                if (!isShapeFilled && isRoundedRect) {
                    const path = roundedRectPath(canvas.width - startX - width, startY, width, height, Math.min(20, Math.min(width, height) * 0.2));
                    isShapeFilled ? ctx.fill(path) : ctx.stroke(path);
                } else {
                    ctx.rect(canvas.width - startX - width, startY, width, height);
                    isShapeFilled ? ctx.fill() : ctx.stroke();
                }
            } else if (activeTool === 'circle-tool') {
                const radius = Math.hypot(width, height) / 2;
                ctx.arc(canvas.width - (startX + width/2), startY + height/2, radius, 0, 2 * Math.PI);
            }
        }
    }

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

    function setActiveTool(toolId) {
        activeTool = toolId;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(toolId).classList.add('active');
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
        }
    }
    
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

       // Random shape generator
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
                   const sides = 4 + Math.floor(Math.random() * 4); // 4-7
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
    
    function dragToolbar(e) {
        if (!isDraggingToolbar) return;
        toolbar.style.transform = 'translateX(0)';
        toolbar.style.left = `${e.clientX - dragOffsetX}px`;
        toolbar.style.top = `${e.clientY - dragOffsetY}px`;
    }

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

    brushSizeSlider.addEventListener('input', (e) => { currentBrushSize = e.target.value; showBrushSizePreview(); });
    
    primarySlider.addEventListener('input', (e) => {
        if (activeTool === 'spray-brush-tool') {
            sprayStrength = e.target.value;
        } else {
            currentOpacity = e.target.value;
        }
    });

    sprayOpacitySlider.addEventListener('input', (e) => {
        sprayOpacity = e.target.value;
    });

    symmetryToggle.addEventListener('click', () => { isSymmetryMode = !isSymmetryMode; symmetryToggle.classList.toggle('active', isSymmetryMode); });
    if (roundedToggle) {
        roundedToggle.addEventListener('click', () => {
            isRoundedRect = !isRoundedRect;
            roundedToggle.classList.toggle('active', isRoundedRect);
        });
    }
    fillShapeToggle.addEventListener('click', () => { isShapeFilled = !isShapeFilled; fillShapeToggle.classList.toggle('active', isShapeFilled); });
    saveBtn.addEventListener('click', () => {
        const f = prompt("png or jpeg?", "png");
        if (f && (f === 'png' || f === 'jpeg')) {
            downloadLink.href = canvas.toDataURL(`image/${f}`);
            downloadLink.download = `drawing.${f}`;
            downloadLink.click();
        } else if (f) {
            alert("Invalid format. Please enter 'png' or 'jpeg'.");
        }
    });
    clearButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the canvas?')) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            saveHistory();
        }
    });
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    
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
                // Toggle custom color picker
                if (customPicker && customSwatch) {
                    const show = customPicker.classList.contains('is-hidden');
                    if (show) positionPickerBelow(customSwatch);
                    togglePicker(show);
                }
            }
        }
    });
    
    saveHistory(); 
    updateUndoRedoButtons();
    setActiveTool('brush-tool');
    updateHarmonyPalette();

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
    function positionPickerBelow(anchorEl) {
        const r = anchorEl.getBoundingClientRect();
        customPicker.style.left = `${r.left + r.width/2}px`;
        customPicker.style.top = `${r.bottom + 8}px`;
        customPicker.style.transform = 'translateX(-50%)';
    }
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
    function setHueFromY(clientY) {
        const r = cpH.getBoundingClientRect();
        const t = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
        hue = t;
        drawHue();
        drawSV();
        commitColor();
    }
    function setSVFromEvent(clientX, clientY) {
        const r = cpSV.getBoundingClientRect();
        const tx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
        const ty = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
        sat = tx; val = 1 - ty;
        drawSV();
        commitColor();
    }
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

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToHsv(hex) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
            case g: h = ((b - r) / d + 2); break;
            case b: h = ((r - g) / d + 4); break;
        }
        h /= 6;
    }
    const s = max === 0 ? 0 : d / max;
    const v = max;
    return {h, s, v};
}
function hsvToHex(h, s, v) {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r=v; g=t; b=p; break;
        case 1: r=q; g=v; b=p; break;
        case 2: r=p; g=v; b=t; break;
        case 3: r=p; g=q; b=v; break;
        case 4: r=t; g=p; b=v; break;
        case 5: r=v; g=p; b=q; break;
    }
    const toHex = (x) => ('0' + Math.round(x * 255).toString(16)).slice(-2);
    return '#' + toHex(r) + toHex(g) + toHex(b);
}
function hexToHsl(hex){
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min=Math.min(r,g,b);
    let h=0, s=0; const l=(max+min)/2;
    if (max!==min){
        const d=max-min;
        s = l>0.5 ? d/(2-max-min) : d/(max+min);
        switch(max){
            case r: h=(g-b)/d + (g<b?6:0); break;
            case g: h=(b-r)/d + 2; break;
            case b: h=(r-g)/d + 4; break;
        }
        h/=6;
    }
    return {h,s,l};
}
function hslToHex(h,s,l){
    const hue2rgb=(p,q,t)=>{ if(t<0) t+=1; if(t>1) t-=1; if(t<1/6) return p+(q-p)*6*t; if(t<1/2) return q; if(t<2/3) return p+(q-p)*(2/3 - t)*6; return p; };
    let r,g,b;
    if (s===0){ r=g=b=l; } else {
        const q = l<0.5 ? l*(1+s) : l+s-l*s;
        const p = 2*l - q;
        r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);
    }
    const toHex=(x)=>('0'+Math.round(x*255).toString(16)).slice(-2);
    return '#'+toHex(r)+toHex(g)+toHex(b);
}
function rotateHue(h, deg){ let nh=(h + deg/360)%1; if(nh<0) nh+=1; return nh; }

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