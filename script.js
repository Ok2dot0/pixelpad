window.addEventListener('load', () => {
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const colorPicker = document.getElementById('color-picker');
    const harmonySelector = document.getElementById('harmony-selector');
    const paletteContainer = document.getElementById('palette-container');
    const brushSizeSlider = document.getElementById('brush-size');
    const brushPreview = document.getElementById('brush-preview');
    const brushSizePreview = document.getElementById('brush-size-preview');
    const allToolButtons = document.querySelectorAll('.tool-btn');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const saveBtn = document.getElementById('save-image');
    const downloadLink = document.getElementById('download-link');
    const symmetryToggle = document.getElementById('symmetry-toggle');
    const fillShapeToggle = document.getElementById('fill-shape-toggle');
    const clearButton = document.getElementById('clear-canvas');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let isDrawing = false, activeTool = 'brush-tool', lastX = 0, lastY = 0;
    let currentColor = '#ff9500', currentBrushSize = 5;
    let isSymmetryMode = false, isShapeFilled = false;
    let shapeStartX = 0, shapeStartY = 0, savedCanvasState;
    let history = [], historyStep = -1, sliderTimeout;

    function saveHistory() {
        if (historyStep < history.length - 1) history = history.slice(0, historyStep + 1);
        history.push(canvas.toDataURL());
        historyStep++;
        updateUndoRedoButtons();
    }
    function loadState(stateData) {
        const img = new Image();
        img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
        img.src = stateData;
    }
    function undo() { if (historyStep > 0) { historyStep--; loadState(history[historyStep]); } updateUndoRedoButtons(); }
    function redo() { if (historyStep < history.length - 1) { historyStep++; loadState(history[historyStep]); } updateUndoRedoButtons(); }
    function updateUndoRedoButtons() {
        undoBtn.disabled = historyStep <= 0;
        redoBtn.disabled = historyStep >= history.length - 1;
    }

    function draw(e) {
        if (!isDrawing) return;
        const x = e.offsetX, y = e.offsetY;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';

        if (activeTool === 'brush-tool' || activeTool === 'eraser-tool') {
            ctx.globalCompositeOperation = activeTool === 'eraser-tool' ? 'destination-out' : 'source-over';
            ctx.strokeStyle = currentColor; ctx.lineWidth = currentBrushSize;
            ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke();
            if (isSymmetryMode) {
                const symX = canvas.width - x, symLastX = canvas.width - lastX;
                ctx.beginPath(); ctx.moveTo(symLastX, lastY); ctx.lineTo(symX, y); ctx.stroke();
            }
        } else if (activeTool === 'rect-tool' || activeTool === 'circle-tool') {
            ctx.putImageData(savedCanvasState, 0, 0);
            drawShape(x, y);
        }
        [lastX, lastY] = [x, y];
    }
    function drawShape(endX, endY) {
        ctx.fillStyle = currentColor; ctx.strokeStyle = currentColor; ctx.lineWidth = currentBrushSize;
        ctx.beginPath();
        if (activeTool === 'rect-tool') { ctx.rect(shapeStartX, shapeStartY, endX - shapeStartX, endY - shapeStartY); }
        else if (activeTool === 'circle-tool') { const r = Math.hypot(endX-shapeStartX, endY-shapeStartY); ctx.arc(shapeStartX, shapeStartY, r, 0, 2 * Math.PI); }
        isShapeFilled ? ctx.fill() : ctx.stroke();
    }
    function startDrawing(e) {
        isDrawing = true; [lastX, lastY] = [e.offsetX, e.offsetY];
        if (activeTool === 'rect-tool' || activeTool === 'circle-tool') {
            savedCanvasState = ctx.getImageData(0, 0, canvas.width, canvas.height);
            [shapeStartX, shapeStartY] = [e.offsetX, e.offsetY];
        }
    }
    function stopDrawing(e) { if (!isDrawing) return; if (activeTool.includes('tool')) drawShape(e.offsetX, e.offsetY); isDrawing = false; saveHistory(); }

    function setActiveTool(toolId) { activeTool = toolId; allToolButtons.forEach(b => b.classList.remove('active')); document.getElementById(toolId).classList.add('active'); canvas.className = `cursor-${toolId}`; }
    function updateBrushCursorPreview(e) {
        const show = (activeTool==='brush-tool' || activeTool==='eraser-tool');
        brushPreview.style.display = show ? 'block' : 'none';
        canvas.classList.toggle('hide-cursor', show);
        if (show) {
            brushPreview.style.width = `${currentBrushSize}px`; brushPreview.style.height = `${currentBrushSize}px`;
            if (e) { brushPreview.style.left = `${e.clientX}px`; brushPreview.style.top = `${e.clientY}px`; }
        }
    }
    function showBrushSizePreview() {
        brushSizePreview.style.width = `${currentBrushSize}px`; brushSizePreview.style.height = `${currentBrushSize}px`;
        brushSizePreview.classList.remove('hidden');
        clearTimeout(sliderTimeout);
        sliderTimeout = setTimeout(() => brushSizePreview.classList.add('hidden'), 1000);
    }
    
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', () => { if (isDrawing) stopDrawing({offsetX: lastX, offsetY: lastY}); });
    window.addEventListener('mousemove', updateBrushCursorPreview);

    allToolButtons.forEach(btn => { if(btn.id.includes('-tool')) btn.addEventListener('click', () => setActiveTool(btn.id)); });
    colorPicker.addEventListener('input', (e) => { currentColor = e.target.value; updateHarmonyPalette(); });
    harmonySelector.addEventListener('change', updateHarmonyPalette);
    paletteContainer.addEventListener('click', (e) => { if (e.target.classList.contains('palette-swatch')) { colorPicker.value = e.target.dataset.hex; colorPicker.dispatchEvent(new Event('input')); } });
    brushSizeSlider.addEventListener('input', (e) => { currentBrushSize = e.target.value; showBrushSizePreview(); });
    symmetryToggle.addEventListener('click', () => { isSymmetryMode = !isSymmetryMode; symmetryToggle.classList.toggle('active', isSymmetryMode); });
    fillShapeToggle.addEventListener('click', () => { isShapeFilled = !isShapeFilled; fillShapeToggle.classList.toggle('active', isShapeFilled); });
    saveBtn.addEventListener('click', () => { const f=prompt("png or jpeg?", "png"); if(f){downloadLink.href=canvas.toDataURL(`image/${f}`); downloadLink.download=`drawing.${f}`; downloadLink.click();} });
    clearButton.addEventListener('click', () => { ctx.clearRect(0,0,canvas.width,canvas.height); saveHistory(); });
    undoBtn.addEventListener('click', undo); redoBtn.addEventListener('click', redo);
    
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey) {
            if (e.key === 'z') { e.preventDefault(); undo(); }
            if (e.key === 'y') { e.preventDefault(); redo(); }
            if (e.key === 's') { e.preventDefault(); saveBtn.click(); }
        } else {
            const keyMap = {'b':'brush-tool','e':'eraser-tool','r':'rect-tool','o':'circle-tool','i':'eyedropper-tool','g':'fill-tool'};
            if(keyMap[e.key]) setActiveTool(keyMap[e.key]);
            if (e.key === 'm') symmetryToggle.click();
            if (e.key === 'f') fillShapeToggle.click();
            if (e.key === 'c') colorPicker.click();
        }
    });
    
    saveHistory(); updateUndoRedoButtons(); setActiveTool('brush-tool'); updateHarmonyPalette();
});

function hexToHsl(H) {let r=0,g=0,b=0;if(H.length==4){r="0x"+H[1]+H[1];g="0x"+H[2]+H[2];b="0x"+H[3]+H[3]}else if(H.length==7){r="0x"+H[1]+H[2];g="0x"+H[3]+H[4];b="0x"+H[5]+H[6]}r/=255;g/=255;b/=255;let cmin=Math.min(r,g,b),cmax=Math.max(r,g,b),delta=cmax-cmin,h=0,s=0,l=0;if(delta==0)h=0;else if(cmax==r)h=((g-b)/delta)%6;else if(cmax==g)h=(b-r)/delta+2;else h=(r-g)/delta+4;h=Math.round(h*60);if(h<0)h+=360;l=(cmax+cmin)/2;s=delta==0?0:delta/(1-Math.abs(2*l-1));s=+(s*100).toFixed(1);l=+(l*100).toFixed(1);return {h,s,l}}
function hslToHex(h,s,l){s/=100;l/=100;let c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2,r=0,g=0,b=0;if(0<=h&&h<60){r=c;g=x;b=0}else if(60<=h&&h<120){r=x;g=c;b=0}else if(120<=h&&h<180){r=0;g=c;b=x}else if(180<=h&&h<240){r=0;g=x;b=c}else if(240<=h&&h<300){r=x;g=0;b=c}else if(300<=h&&h<360){r=c;g=0;b=x}r=Math.round((r+m)*255).toString(16);g=Math.round((g+m)*255).toString(16);b=Math.round((b+m)*255).toString(16);if(r.length==1)r="0"+r;if(g.length==1)g="0"+g;if(b.length==1)b="0"+b;return"#"+r+g+b}

function updateHarmonyPalette() {
    const colorPicker = document.getElementById('color-picker');
    const harmonySelector = document.getElementById('harmony-selector');
    const paletteContainer = document.getElementById('palette-container');
    const primaryColorHsl = hexToHsl(colorPicker.value);
    const harmonyMode = harmonySelector.value;
    let harmonyColors = [];

    switch(harmonyMode) {
        case 'complementary': harmonyColors.push(hslToHex((primaryColorHsl.h + 180) % 360, primaryColorHsl.s, primaryColorHsl.l)); break;
        case 'analogous':
            harmonyColors.push(hslToHex((primaryColorHsl.h + 30 + 360) % 360, primaryColorHsl.s, primaryColorHsl.l));
            harmonyColors.push(hslToHex((primaryColorHsl.h - 30 + 360) % 360, primaryColorHsl.s, primaryColorHsl.l)); break;
        case 'triadic':
            harmonyColors.push(hslToHex((primaryColorHsl.h + 120) % 360, primaryColorHsl.s, primaryColorHsl.l));
            harmonyColors.push(hslToHex((primaryColorHsl.h + 240) % 360, primaryColorHsl.s, primaryColorHsl.l)); break;
    }
    
    paletteContainer.innerHTML = '';
    harmonyColors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'palette-swatch';
        swatch.style.backgroundColor = color;
        swatch.dataset.hex = color;
        paletteContainer.appendChild(swatch);
    });
}