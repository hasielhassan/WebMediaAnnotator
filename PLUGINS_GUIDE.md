# Plugin System Guide

The `WebMediaAnnotator` is designed with an extensible **Plugin-First Architecture**. This guide explains how the system works and how to create your own plugins.

## Architecture Overview

The core of the application is lightweight and generic. It relies on the **Tool Registry** and **Plugin Manager** to load functionality.

### Key Components

*   **`WebMediaAnnotator` (Core)**: The main controller. It manages the `Store`, `Renderer`, and Registries. It does *not* know about specific tools (like Pencil or Rectangle).
*   **`ToolRegistry`**: A central place where tools are registered.
    *   Stores a **Factory** (function that creates the tool).
    *   Stores **Metadata** (Label, Icon, Shortcut) for the UI.
*   **`PluginManager`**: Handles the lifecycle of plugins. A plugin is simply an object with an `onInit(core)` method.



## API Reference

### BaseTool
Every tool must extend `BaseTool`. This class provides access to the core system and enforces the standard interaction lifecycle.

```typescript
abstract class BaseTool {
    // Properties
    protected annotator: WebMediaAnnotator; // Access to Player, Renderer, Plugins
    protected store: Store;                 // Access to State (Annotations, Frame, Settings)

    // Lifecycle
    constructor(annotator: WebMediaAnnotator);

    // Interaction Methods (Abstract - You MUST implement these)
    abstract onMouseDown(x: number, y: number, e: MouseEvent | PointerEvent): void;
    abstract onMouseMove(x: number, y: number, e: MouseEvent | PointerEvent): void;
    abstract onMouseUp(x: number, y: number, e: MouseEvent | PointerEvent): void;

    // Optional Methods
    onKeyDown?(e: KeyboardEvent): void;
}
```

### Icons
To ensure a consistent look and feel (and to avoid bundling full icon libraries in every plugin), we use a **String Mapping** system.

Your plugin provides a string key (e.g., `'pencil'`), and the UI maps it to the actual UI Component.

The default UI implementation uses [Lucide React](https://lucide.dev/) for icons.

**Some Available Icons:**
*   `select` -> `MousePointer2`
*   `pencil` -> `Pencil`
*   `circle` -> `Circle`
*   `square` -> `Square`
*   `text` -> `Type`
*   `eraser` -> `Eraser`
*   `hand` -> `Hand`
*   `grab` -> `Grab`
*   `waypoints` -> `Waypoints` (Used for PolyLine)
*   `waypoints` -> `Waypoints` (Used for PolyLine)
*   `move-up-right` -> `MoveUpRight` (Used for Arrow)

**Additional Standard Icons:**
*   **Shapes:** `triangle`, `star`, `hexagon`, `diamond`, `cloud`, `comment`, `highlighter`
*   **Media:** `play`, `pause`, `skip-forward`, `skip-back`, `volume`, `mute`
*   **Edit:** `copy`, `paste`, `cut`, `save`, `open`, `settings`, `layers`, `grid`, `ruler`, `zoom-in`, `zoom-out`
*   **Nav:** `up`, `down`, `left`, `right`, `chevron-up`, `chevron-down`, ...

### Option 2: Use a React Component
If you need an icon that isn't in the core set, you can import it directory (e.g., from `lucide-react` or an SVG component) and pass it to the registry.

```typescript
import { Ticket } from 'lucide-react';

// ... in your plugin definition
icon: Ticket 
// ...
```

### Option 3: Fork modify and rebuild

If you need a new icon, add it to `packages/ui/src/Toolbar.tsx`.*

---

## Tutorial: Creating a Custom Tool Plugin

In this tutorial, we will create a **PolyLine Tool** (straight lines).

### Step 1: Create the Tool Class

Create a new class extending `BaseTool`. This handles the mouse/pointer interactions.

**File:** `packages/core/src/plugins/examples/PolyLineTool.ts`

```typescript
import { BaseTool, Annotation } from '@web-media-annotator/core';

export class PolyLineTool extends BaseTool {
    private points = [];
    private isDrawing = false;
    private tempId = null;

    onMouseDown(x, y, e) {
        if (!this.isDrawing) {
            // Start new shape
            this.isDrawing = true;
            this.points = [{ x, y }];
            this.tempId = 'temp_' + Date.now();
            
            // Add initial annotation to store
            this.store.addAnnotation({
                id: this.tempId,
                type: 'polyline',
                frame: this.store.getState().currentFrame,
                points: this.points,
                style: { ...this.store.getState().activeStyle }
            });
        } else {
            // Add point
            this.points.push({ x, y });
            this.store.updateAnnotation(this.tempId, { points: this.points });
        }
    }

    onMouseMove(x, y, e) {
        if (this.isDrawing) {
            // Preview next line segment
            const preview = [...this.points, { x, y }];
            this.store.updateAnnotation(this.tempId, { points: preview });
        }
    }
}
```

### Step 2: Define the Plugin

Wrap the tool registration in a plugin object. This is also where you define the **Metadata** (Label, Icon, Shortcut).

**File:** `packages/core/src/plugins/examples/PolyLinePlugin.ts`

```typescript
import { Plugin } from '@web-media-annotator/core';
import { PolyLineTool } from './PolyLineTool';

export const PolyLinePlugin: Plugin = {
    name: 'plugin-polyline',
    version: '1.0.0',
    onInit: (core) => {
        core.toolRegistry.register('polyline', (c) => new PolyLineTool(c), {
            label: 'Polyline',
            shortcut: 'L',
            icon: 'waypoints' // Maps to the "Waypoints" icon in the UI
        });
    }
};
```

**Common Icons:** `pencil`, `move-up-right`, `circle`, `square`, `type`, `eraser`, `hand`, `waypoints`. (See API Reference above for full list).

### Step 3: Register the Plugin

In your application (e.g., React App), register the plugin when the annotator initializes.

```typescript
<Annotator 
    src="..." 
    onReady={(core) => {
        core.plugins.register(PolyLinePlugin);
    }}
/>
```

The tool will automatically appear in the **Toolbar** and **Keyboard Shortcuts** menu!
