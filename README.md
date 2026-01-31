<h1 align="center">Web Media Annotator</h1>

<p align="center">
    <img src="screenshot.png" width="600"/>
</p>

A powerful, web-based tool for annotating video and image media with frame-accurate precision. Built with a modular architecture that separates core annotation logic from the UI, enabling easy integration into any web application.

## 🎯 Project Goal

The ultimate goal is to create a professional-grade, browser-based media annotation suite capable of:
- **Frame-Accurate Annotation**: Drawing on specific video frames with vector precision.
- **Temporal Annotations**: defining start and end times for annotations (e.g., "follow this object for 5 seconds").
- **Rich Media Support**: Handling video playback, audio scrubbing, and potentially multi-track syncing.
- **Export Flexibility**: Exporting data in standard formats (JSON) or "burning in" annotations for review.
- **Extensibility**: Allowing developers to add custom tools and rendering logic via plugins.

## ✅ Implemented Features

### 🎨 Annotation Tools
- **Vector Shapes**: Draw Squares, Circles, Arrows, and Freehand lines.
- **Text Support**: Add text labels directly onto frames.
- **Selection & Editing**: Select, move, and modify existing annotations.
- **Undo/Redo**: Robust history support for all actions.
- **Color Picking**: EyeDropper tool to sample colors from the video.

### 🎥 Playback & Navigation
- **Frame-Accurate Scrubbing**: Navigate video frame-by-frame.
- **Pan & Zoom**:
    - **Smooth Interaction**: Pan (Hand tool) and Zoom (Scroll wheel) with inertia.
    - **Fit-to-Content**: Canvas automatically aligns to the video content, ignoring letterboxing/black bars.
    - **Pixel-Perfect Sync**: Annotations stay locked to video details at any zoom level using CSS transforms.
- **Ghosting (Onion Skinning)**:
    - View previous (red) and future (green) frames overlaid on the current frame.
    - Configurable range (1-10 frames) and opacity.
### ⌨️ Shortcuts & Interaction
- **Mouse**: Middle-click to Pan (temporary), Scroll to Zoom.
- **Keyboard**:
    - Tools: `S`, `P`, `A`, `C`, `Q`, `T`, `E`.
    - Navigation: `Space` (Play/Pause), Arrows (Frame step), `Ctrl`+Arrows (Jump to annotation).
    - View: `R` (Reset Zoom/Pan).
    - History: `Ctrl+Z` (Undo), `Ctrl+Y` (Redo).
- **UI**: Consolidated "Export" menu for cleaner interface and integrated Shortcuts cheat sheet.

### 💾 Import & Export
- **Export to Image**: Download the current frame with all annotations "burned in" as a high-quality PNG.
- **State Management**: Centralized store with complete state persistence.

## 🚧 Roadmap (Pending)

### ⏳ Annotation Duration (Hold)
- **Goal**: Allow an annotation to persist for a specific duration or range of frames.
- **Planned UI**: "Hold" input field in the toolbar (e.g., "Hold for 5 frames" or "Until Frame X").
- **Logic**: Update Renderer to check frame ranges instead of single-frame strict equality.

### 🖼️ Single Image Preview (Future)
- **Goal**: Support static image annotation without the video player overhead.
- **Utility**: Marking up screenshots, design assets, or photography.

### 🧊 Simple 3D Viewer (Long Term)
- **Goal**: Support basic 3D model annotation (OBJ/GLB).
- **Utility**: Annotating 3D assets for game development or product visualization (drawing on 2D screen space projected onto the model).

### 🎵 Audio Visuals
- **Goal**: Visualize the audio waveform in the timeline.

### 📦 Advanced Export
- **Goal**: Export annotation data as a standardized JSON format.
- **Utility**: Allowing re-importing of samples or integration with backend systems.

### 🛠 Plugins & API
- **Goal**: Finalize the Plugin API.
- **Utility**: Allow third-party developers to create custom tools (e.g., "marching ants" selection, AI-assisted segmentation) without forking the core.

## 🏗 Architecture

The project is structured as a Monorepo:

- **`packages/core`**: The headless library containing the state management (`Store`), rendering engine (`Renderer`), and tool logic (`PanTool`, `FreehandTool`, etc.). It has no UI dependencies other than a container element.
- **`apps/demo`**: A reference implementation using purely Vanilla TypeScript/CSS to demonstrate how to build a UI around the core library.

## 🌟 Versatile Usage Modes

This project is designed to be used in three distinct ways depending on your needs:

1.  **Static Web App (Quick Reviews)**
    -   Use as a standalone tool running completely in the browser.
    -   Upload local video/image files which are processed in-memory (no server upload required).
    -   Ideal for quick, secure reviews of daily work.

2.  **CDN Integration (Static Files)**
    -   Load the library via a `script` tag from a CDN (or locally hosted static files).
    -   Easily embed an annotation widget into legacy apps or static sites using vanilla HTML/JS/CSS.

3.  **NPM Module (Build Integration)**
    -   Import `@web-media-annotator/core` into complex React/Vue/Angular applications.
    -   Leverage the full TypeScript API for deep integration and custom UI development.

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)


### Installation

```bash
npm install @web-media-annotator/react @web-media-annotator/embed
```

## Usage

### 1. Static Web App (Quick Reviews)
**Zero Setup. No Server Required.**
Perfect for quickly reviewing local files. Just open the HTML file in your browser.

-   **Demo**: [quick-review.html](apps/demo/quick-review.html)
    -   *Drag & Drop interface for local video/image files.*
    -   *Runs completely in the browser (using ObjectURLs).*
-   **Static Test**: [static-test.html](apps/demo/static-test.html)
    -   *Simple hardcoded example using a public video URL.*

### 2. React Component
Best for modern React applications.

```tsx
import { Annotator } from '@web-media-annotator/react';
import '@web-media-annotator/react/dist/style.css'; // If applicable

function App() {
  return (
    <div style={{ width: '1000px', height: '600px' }}>
      <Annotator 
        src="video.mp4" 
        fps={24} 
        startFrame={0} 
      />
    </div>
  );
}
```

### 3. Web Component (Drop-in)
Works with **Vue**, **Svelte**, **Angular**, or any HTML page.

**Using npm:**
```javascript
import '@web-media-annotator/embed';
```

**Using HTML:**
```html
<web-media-annotator 
    src="video.mp4" 
    fps="24"
    width="100%"
    height="100%"
></web-media-annotator>
```

### 4. Direct CDN / UMD Usage
For legacy sites or static usage without a bundler.

```html
<!-- Load the UMD script -->
<script src="https://unpkg.com/@web-media-annotator/embed/dist/web-media-annotator.umd.js"></script>

<!-- Use the custom element -->
<web-media-annotator src="video.mp4"></web-media-annotator>
```

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / Pause |
| `←` / `→` | Prev / Next Frame |
| `P` | Pencil Tool |
| `E` | Eraser |
| `S` | Select Tool |
| `G` | Toggle Ghosting (Onion Skin) |
| `H` | Toggle Hold (3 Frames) |
| `+` / `-`| Adjust Stroke Size |
| `Scroll`| Zoom Canvas |
| `Mid-Click` | Pan Canvas |

## Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Demo**
   ```bash
   npm run dev:demo
   ```

3. **Build Packages**
   ```bash
   npm run build
   ```
    Open your browser to the URL shown (usually `http://localhost:5173` or similar).

## 🤝 Contributing

Contributions are welcome! Please focus on the `packages/core` for functional improvements and `apps/demo` for UI enhancements.

## 📄 License

GPL-3.0 license

