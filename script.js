window.addEventListener('load', () => {
    const canvas = document.getElementById('drawing-canvas');
    // The '2d' context is the object we use to draw on the canvas
    const ctx = canvas.getContext('2d');

    // Set canvas dimensions to fill the window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // --- STATE ---
    // This variable will track whether we are currently drawing
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    // --- DRAWING LOGIC ---
    function draw(e) {
        // Stop the function if we are not in "drawing" mode
        if (!isDrawing) return;

        // Set the visual properties of the line
        ctx.strokeStyle = '#000000'; // Black color for now
        ctx.lineWidth = 5;
        ctx.lineCap = 'round'; // Makes the line ends smoother
        ctx.lineJoin = 'round'; // Makes the line corners smoother

        // Start a new path and draw the line
        ctx.beginPath();
        ctx.moveTo(lastX, lastY); // Start from the last point
        ctx.lineTo(e.offsetX, e.offsetY); // Draw to the new point
        ctx.stroke();

        // Update the last coordinates
        [lastX, lastY] = [e.offsetX, e.offsetY];
    }

    // --- EVENT LISTENERS ---
    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        // Set the starting point for the line
        [lastX, lastY] = [e.offsetX, e.offsetY];
    });

    canvas.addEventListener('mousemove', draw);

    // Stop drawing when the mouse button is released or leaves the canvas
    canvas.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('mouseout', () => isDrawing = false);

    // --- RESIZE LOGIC ---
    // A simple function to handle window resizing
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
});