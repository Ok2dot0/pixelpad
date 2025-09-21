# PixelPad

A fast, lightweight drawing app built with HTML5 Canvas and vanilla JavaScript. Create sketches with multiple brushes, shapes, symmetry, and a custom color system—all right in your browser.

Built as a Hack Club Summer of Making project. Project page: https://summer.hackclub.com/projects/13473


## Features

- Canvas drawing with HiDPI support (sharp on Retina/4K displays)
- Tools
  - Brush
  - Calligraphy brush (angled elliptical nib)
  - Spray brush (strength + opacity)
  - Eraser
  - Rectangle and Circle (stroke or fill)
- Options & modifiers
  - Symmetry (horizontal mirror painting)
  - Rounded corners toggle for rectangles
  - Brush size and primary slider (opacity/strength by tool)
  - Fill shape toggle
- Colors
  - Custom color picker (HSV/HEX)
  - Harmony palettes: Complementary, Analogous, Triadic
  - Clickable swatches to quickly set colors
- History & export
  - Undo / Redo
  - Clear canvas
  - Save dialog with filename, format (PNG/JPEG), quality (for JPEG), scale, and background options
- Helpful UI
  - Cursor previews for brush size and calligraphy angle
  - Keyboard shortcuts for rapid switching


## Keyboard shortcuts

- Tools: 
  - Brush: B
  - Calligraphy Brush: N
  - Spray Brush: V
  - Eraser: E
  - Rectangle: R
  - Circle: O
- Toggles:
  - Fill Shape: F
  - Symmetry: M
- Actions:
  - Undo: Ctrl+Z
  - Redo: Ctrl+Y
  - Save: Ctrl+S
  - Help overlay: ?


## Getting started

PixelPad is a static site—no build step or dependencies required.

Option A: Open directly
- Open `index.html` in a modern browser.
- Note: Some browsers restrict ES module imports over `file://`. If anything doesn’t load, use Option B.

Option B: Serve locally (recommended)
- Use any static server to host the folder, then visit it in your browser. For example:
  - Python: `python -m http.server 8000` (then open http://localhost:8000/)
  - Node: `npx serve` (or any equivalent static server)


## Tests

A tiny test page validates the color utilities (HSV/HSL conversions, hue rotation):

- Open `tests/color-utils.test.html` directly, or at `/tests/color-utils.test.html` if you’re serving locally.
- The page prints simple PASS/FAIL lines in the document.


## Project structure

```
.
├─ index.html         # App shell, toolbar, modals
├─ style.css          # App styles and layout
├─ script.js          # Main app logic (tools, drawing, UI)
├─ color-utils.js     # Reusable color conversions + helpers (ES module)
└─ tests/
   └─ color-utils.test.html  # Quick browser tests for color utilities
```


## Tech stack

- HTML5 Canvas
- Vanilla JavaScript (ES modules)
- CSS (no frameworks)
- Icon set: Tabler Icons


## Credits

- Icons by Tabler Icons: https://github.com/tabler/tabler-icons (MIT License)
- Built for Hack Club’s Summer of Making: https://summer.hackclub.com/projects/13473


## Notes

- No external build tools or package manager are required.
- Works best in the latest versions of Chrome, Firefox, Edge, and Safari.
- Contributions and suggestions are welcome—feel free to open an issue or PR.
