window.addEventListener('load', () => {
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');

    const colorPicker = document.getElementById('color-picker');
    const brushSizeSlider = document.getElementById('brush-size');
    const clearButton = document.getElementById('clear-canvas');

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

    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
    });

    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('mouseout', () => isDrawing = false);


    colorPicker.addEventListener('change', (e) => {
        currentColor = e.target.value;
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
});