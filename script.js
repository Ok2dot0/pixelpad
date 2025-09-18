// Wait for the entire page to load before running the script
window.addEventListener('load', () => {

    // =====================================================================
    //  1. ELEMENT SELECTORS
    // =====================================================================
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const toolbar = document.getElementById('toolbar');
    const colorPicker = document.getElementById('color-picker');
    const harmonySelector = document.getElementById('harmony-selector');
    const paletteContainer = document.getElementById('palette-container');
    const brushSizeSlider = document.getElementById('brush-size');
    // *** UPDATED: Renamed for clarity and added new selectors ***
    const primarySlider = document.getElementById('primary-slider');
    const primarySliderLabel = document.getElementById('primary-slider-label');
    const sprayOpacityContainer = document.getElementById('spray-opacity-container');
    const sprayOpacitySlider = document.getElementById('spray-opacity-slider');

    const brushPreview = document.getElementById('brush-preview');
    const brushSizePreview = document.getElementById('brush-size-preview');
    const symmetryToggle = document.getElementById('symmetry-toggle');
    const fillShapeToggle = document.getElementById('fill-shape-toggle');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const saveBtn = document.getElementById('save-image');
    const clearButton = document.getElementById('clear-canvas');
    const downloadLink = document.getElementById('download-link');

    // =====================================================================
    //  2. STATE MANAGEMENT
    // =====================================================================
    let isDrawing = false;
    let activeTool = 'brush-tool';
    let lastX = 0, lastY = 0;

    // Tool-specific states
    let currentColor = '#ff9500';
    let currentBrushSize = 10;
    let currentOpacity = 1; // Opacity for all non-spray tools
    let sprayStrength = 20;
    let sprayOpacity = 1; // *** NEW: Dedicated opacity for the spray tool ***
    let isSymmetryMode = false;
    let isShapeFilled = false;

    // Drawing & History states
    let shapeStartX = 0, shapeStartY = 0;
    let savedCanvasState; 
    let currentPath;
    let symmetryPath;

    let history = [];
    let historyStep = -1;

    // UI states
    let isDraggingToolbar = false;
    let dragOffsetX = 0, dragOffsetY = 0;
    let isMouseOverToolbar = false;
    let sliderTimeout; 

    // Initial Canvas Setup
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // =====================================================================
    //  3. HISTORY (UNDO/REDO)
    // =====================================================================
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

    // =====================================================================
    //  4. DRAWING ENGINE & TOOL IMPLEMENTATIONS
    // =====================================================================
    function draw(e) {
        if (!isDrawing) return;
        const x = e.offsetX, y = e.offsetY;

        if (activeTool === 'spray-brush-tool') {
            sprayBrush(x, y);
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

    function sprayBrush(x, y) {
        // *** FIX: Use the dedicated sprayOpacity state variable ***
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
            ctx.rect(startX, startY, width, height);
        } else if (activeTool === 'circle-tool') {
            const radius = Math.hypot(width, height) / 2;
            ctx.arc(startX + width/2, startY + height/2, radius, 0, 2 * Math.PI);
        }
        isShapeFilled ? ctx.fill() : ctx.stroke();

        if (isSymmetryMode) {
            ctx.beginPath();
            if (activeTool === 'rect-tool') {
                ctx.rect(canvas.width - startX - width, startY, width, height);
            } else if (activeTool === 'circle-tool') {
                const radius = Math.hypot(width, height) / 2;
                ctx.arc(canvas.width - (startX + width/2), startY + height/2, radius, 0, 2 * Math.PI);
            }
            isShapeFilled ? ctx.fill() : ctx.stroke();
        }
    }

    // =====================================================================
    //  5. MOUSE EVENT HANDLERS
    // =====================================================================
    function startDrawing(e) {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];

        ctx.globalCompositeOperation = activeTool === 'eraser-tool' ? 'destination-out' : 'source-over';
        // Spray tool handles opacity per-particle, other tools use globalAlpha
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
            
            if (activeTool.includes('rect') || activeTool.includes('circle')) {
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
    }

    // =====================================================================
    //  6. UI & TOOL MANAGEMENT
    // =====================================================================
    function setActiveTool(toolId) {
        activeTool = toolId;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(toolId).classList.add('active');
        canvas.className = `cursor-${toolId}`;

        // *** FIX: This is the core logic for the dynamic sliders ***
        if (toolId === 'spray-brush-tool') {
            // Configure primary slider for STRENGTH
            primarySliderLabel.textContent = "Strength:";
            primarySlider.min = 5;
            primarySlider.max = 50;
            primarySlider.step = 1;
            primarySlider.value = sprayStrength;
            // Show the dedicated opacity slider for the spray tool
            sprayOpacityContainer.style.display = 'flex';
        } else {
            // Configure primary slider for OPACITY for all other tools
            primarySliderLabel.textContent = "Opacity:";
            primarySlider.min = 0.1;
            primarySlider.max = 1;
            primarySlider.step = 0.1;
            primarySlider.value = currentOpacity;
            // Hide the dedicated spray opacity slider
            sprayOpacityContainer.style.display = 'none';
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
            brushPreview.style.width = `${currentBrushSize}px`;
            brushPreview.style.height = `${currentBrushSize}px`;
            brushPreview.style.left = `${e.clientX}px`;
            brushPreview.style.top = `${e.clientY}px`;
            brushPreview.style.borderRadius = '50%';
            brushPreview.style.transform = 'translate(-50%, -50%)';
        }
    }
    
    function showBrushSizePreview() {
        brushPreview.style.display = 'none';
        brushSizePreview.style.width = `${currentBrushSize}px`;
        brushSizePreview.style.height = `${currentBrushSize}px`;
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

    // =====================================================================
    //  7. EVENT LISTENERS
    // =====================================================================
    canvas.addEventListener('mousedown', (e) => { if (!isMouseOverToolbar) startDrawing(e); });
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', () => { if (isDrawing) stopDrawing({offsetX: lastX, offsetY: lastY}); });
    
    window.addEventListener('mousemove', updateBrushCursorPreview);
    
    toolbar.addEventListener('mouseenter', () => { isMouseOverToolbar = true; updateBrushCursorPreview(); });
    toolbar.addEventListener('mouseleave', () => { isMouseOverToolbar = false; updateBrushCursorPreview(); });
    toolbar.addEventListener('mousedown', (e) => {
        if (e.target.closest('button, input, select, .palette-swatch')) return;
        isDraggingToolbar = true;
        const rect = toolbar.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        window.addEventListener('mousemove', dragToolbar);
        window.addEventListener('mouseup', stopDragToolbar);
    });

    document.querySelectorAll('.tool-btn[id$="-tool"]').forEach(btn => btn.addEventListener('click', () => setActiveTool(btn.id)));

    colorPicker.addEventListener('input', (e) => { currentColor = e.target.value; updateHarmonyPalette(); });
    harmonySelector.addEventListener('change', updateHarmonyPalette);
    paletteContainer.addEventListener('click', (e) => { if (e.target.classList.contains('palette-swatch')) { colorPicker.value = e.target.dataset.hex; colorPicker.dispatchEvent(new Event('input')); } });

    brushSizeSlider.addEventListener('input', (e) => { currentBrushSize = e.target.value; showBrushSizePreview(); });
    
    // *** UPDATED: Event listener for the primary slider ***
    primarySlider.addEventListener('input', (e) => {
        if (activeTool === 'spray-brush-tool') {
            sprayStrength = e.target.value;
        } else {
            currentOpacity = e.target.value;
        }
    });

    // *** NEW: Event listener for the dedicated spray opacity slider ***
    sprayOpacitySlider.addEventListener('input', (e) => {
        sprayOpacity = e.target.value;
    });

    symmetryToggle.addEventListener('click', () => { isSymmetryMode = !isSymmetryMode; symmetryToggle.classList.toggle('active', isSymmetryMode); });
    fillShapeToggle.addEventListener('click', () => { isShapeFilled = !isShapeFilled; fillShapeToggle.classList.toggle('active', isShapeFilled); });
    saveBtn.addEventListener('click', () => { const f=prompt("png or jpeg?","png"); if(f && (f === 'png' || f === 'jpeg')){downloadLink.href=canvas.toDataURL(`image/${f}`); downloadLink.download=`drawing.${f}`; downloadLink.click();} else if(f) { alert("Invalid format. Please enter 'png' or 'jpeg'.")} });
    clearButton.addEventListener('click', () => { if (confirm('Are you sure you want to clear the canvas?')) { ctx.clearRect(0,0,canvas.width,canvas.height); saveHistory(); } });
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
            if (e.key === 'c') colorPicker.click();
        }
    });
    
    // =====================================================================
    //  8. INITIALIZATION
    // =====================================================================
    saveHistory(); 
    updateUndoRedoButtons();
    setActiveTool('brush-tool');
    updateHarmonyPalette();
});

// =====================================================================
//  9. UTILITY & COLOR FUNCTIONS
// =====================================================================
function hexToRgba(hex, alpha) { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return `rgba(${r}, ${g}, ${b}, ${alpha})`; }
function hexToHsl(H){let r=0,g=0,b=0;if(H.length==4){r="0x"+H[1]+H[1];g="0x"+H[2]+H[2];b="0x"+H[3]+H[3]}else if(H.length==7){r="0x"+H[1]+H[2];g="0x"+H[3]+H[4];b="0x"+H[5]+H[6]}r/=255;g/=255;b/=255;let cmin=Math.min(r,g,b),cmax=Math.max(r,g,b),delta=cmax-cmin,h=0,s=0,l=0;if(delta==0)h=0;else if(cmax==r)h=((g-b)/delta)%6;else if(cmax==g)h=(b-r)/delta+2;else h=(r-g)/delta+4;h=Math.round(h*60);if(h<0)h+=360;l=(cmax+cmin)/2;s=delta==0?0:delta/(1-Math.abs(2*l-1));s=+(s*100).toFixed(1);l=+(l*100).toFixed(1);return {h,s,l}}
function hslToHex(h,s,l){s/=100;l/=100;let c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2,r=0,g=0,b=0;if(0<=h&&h<60){r=c;g=x;b=0}else if(60<=h&&h<120){r=x;g=c;b=0}else if(120<=h&&h<180){r=0;g=c;b=x}else if(180<=h&&h<240){r=0;g=x;b=c}else if(240<=h&&h<300){r=x;g=0;b=c}else if(300<=h&&h<360){r=c;g=0;b=x}r=Math.round((r+m)*255).toString(16);g=Math.round((g+m)*255).toString(16);b=Math.round((b+m)*255).toString(16);if(r.length==1)r="0"+r;if(g.length==1)g="0"+g;if(b.length==1)b="0"+b;return"#"+r+g+b}
function updateHarmonyPalette(){const cP=document.getElementById('color-picker'),hS=document.getElementById('harmony-selector'),pC=document.getElementById('palette-container'),baseColor=cP.value;const baseHsl=hexToHsl(baseColor),hM=hS.value;let harmonyColors=[];switch(hM){case'complementary':harmonyColors.push(hslToHex((baseHsl.h+180)%360,baseHsl.s,baseHsl.l));break;case'analogous':harmonyColors.push(hslToHex((baseHsl.h+30+360)%360,baseHsl.s,baseHsl.l));harmonyColors.push(hslToHex((baseHsl.h-30+360)%360,baseHsl.s,baseHsl.l));break;case'triadic':harmonyColors.push(hslToHex((baseHsl.h+120)%360,baseHsl.s,baseHsl.l));harmonyColors.push(hslToHex((baseHsl.h+240)%360,baseHsl.s,baseHsl.l));break}pC.innerHTML='';const originalSwatch=document.createElement('div');originalSwatch.className='palette-swatch';originalSwatch.style.backgroundColor=baseColor;originalSwatch.dataset.hex=baseColor;originalSwatch.style.border='2px solid #333';pC.appendChild(originalSwatch);harmonyColors.forEach(c=>{const s=document.createElement('div');s.className='palette-swatch';s.style.backgroundColor=c;s.dataset.hex=c;pC.appendChild(s)})}