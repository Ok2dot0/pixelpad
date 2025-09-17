window.addEventListener('load', () => {
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const colorPicker = document.getElementById('color-picker');
    const brushSizeSlider = document.getElementById('brush-size');
    const clearButton = document.getElementById('clear-canvas');
    const harmonySelector = document.getElementById('harmony-selector');
    const paletteContainer = document.getElementById('palette-container');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let currentColor = '#000000';
    let currentBrushSize = 5;

    function draw(e) {
        if (!isDrawing) return;
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentBrushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        [lastX, lastY] = [e.offsetX, e.offsetY];
    }
    

    function hexToHsl(hex) {
        let r = 0, g = 0, b = 0;
        if (hex.length == 4) {
            r = "0x" + hex[1] + hex[1];
            g = "0x" + hex[2] + hex[2];
            b = "0x" + hex[3] + hex[3];
        } else if (hex.length == 7) {
            r = "0x" + hex[1] + hex[2];
            g = "0x" + hex[3] + hex[4];
            b = "0x" + hex[5] + hex[6];
        }
        r /= 255; g /= 255; b /= 255;
        let cmin = Math.min(r,g,b), cmax = Math.max(r,g,b), delta = cmax - cmin, h = 0, s = 0, l = 0;
        if (delta == 0) h = 0;
        else if (cmax == r) h = ((g - b) / delta) % 6;
        else if (cmax == g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        h = Math.round(h * 60);
        if (h < 0) h += 360;
        l = (cmax + cmin) / 2;
        s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
        s = +(s * 100).toFixed(1);
        l = +(l * 100).toFixed(1);
        return { h, s, l };
    }

    function updateHarmonyPalette() {
        const primaryColorHex = colorPicker.value;
        const primaryColorHsl = hexToHsl(primaryColorHex);
        const harmonyMode = harmonySelector.value;
        
        let harmonyColors = [];

        switch (harmonyMode) {
            case 'complementary':
                const compH = (primaryColorHsl.h + 180) % 360;
                harmonyColors.push(`hsl(${compH}, ${primaryColorHsl.s}%, ${primaryColorHsl.l}%)`);
                break;
            case 'analogous':
                const anH1 = (primaryColorHsl.h + 30 + 360) % 360;
                const anH2 = (primaryColorHsl.h - 30 + 360) % 360;
                harmonyColors.push(`hsl(${anH1}, ${primaryColorHsl.s}%, ${primaryColorHsl.l}%)`);
                harmonyColors.push(`hsl(${anH2}, ${primaryColorHsl.s}%, ${primaryColorHsl.l}%)`);
                break;
            case 'triadic':
                const triH1 = (primaryColorHsl.h + 120) % 360;
                const triH2 = (primaryColorHsl.h + 240) % 360;
                harmonyColors.push(`hsl(${triH1}, ${primaryColorHsl.s}%, ${primaryColorHsl.l}%)`);
                harmonyColors.push(`hsl(${triH2}, ${primaryColorHsl.s}%, ${primaryColorHsl.l}%)`);
                break;
        }

        paletteContainer.innerHTML = '';
        harmonyColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.classList.add('palette-swatch');
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            paletteContainer.appendChild(swatch);
        });
    }

    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
    });
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('mouseout', () => isDrawing = false);

    colorPicker.addEventListener('change', () => {
        currentColor = colorPicker.value;
        updateHarmonyPalette();
    });

    harmonySelector.addEventListener('change', updateHarmonyPalette);
    
    paletteContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('palette-swatch')) {
            currentColor = e.target.dataset.color;
        }
    });

    brushSizeSlider.addEventListener('input', (e) => {
        currentBrushSize = e.target.value;
    });

    clearButton.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    updateHarmonyPalette();
});