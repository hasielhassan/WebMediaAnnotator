import { BaseTool } from './BaseTool';
import { Annotation } from '../Store';
import { v4 as uuidv4 } from 'uuid';

export class FreehandTool extends BaseTool {
    private isDrawing = false;
    private currentPoints: { x: number; y: number; p?: number }[] = [];

    onMouseDown(x: number, y: number, e: MouseEvent | PointerEvent) {
        this.isDrawing = true;
        this.isDrawing = true;
        let p = 0.5;

        if (e instanceof PointerEvent) {
            if (e.pressure > 0 && e.pressure !== 0.5) {
                // Native pressure (Pen/Tablet)
                p = e.pressure;
            } else if (e.pointerType === 'touch' && (e.width > 1 || e.height > 1)) {
                // Simulated pressure from Touch Area
                // Typical touch contact is 10-40px. We map 10px -> 0.2, 40px -> 1.0
                // Using max(width, height) to catch the largest dimension
                const size = Math.max(e.width, e.height);
                p = Math.min(1, Math.max(0.2, size / 30));
            }
        }

        this.currentPoints = [{ x, y, p }];

        // Create a temporary annotation to visualize drawing
        const state = this.store.getState();
        const tempAnnotation: Annotation = {
            id: 'temp_drawing',
            frame: state.currentFrame,
            type: 'freehand',
            points: this.currentPoints,
            style: {
                color: state.activeColor,
                width: state.activeStrokeWidth
            }
        };
        this.store.addAnnotation(tempAnnotation);
    }

    onMouseMove(x: number, y: number, e: MouseEvent | PointerEvent) {
        if (!this.isDrawing) return;
        let p = 0.5;

        if (e instanceof PointerEvent) {
            if (e.pressure > 0 && e.pressure !== 0.5) {
                p = e.pressure;
            } else if (e.pointerType === 'touch' && (e.width > 1 || e.height > 1)) {
                const size = Math.max(e.width, e.height);
                p = Math.min(1, Math.max(0.2, size / 30));
            }
        }

        this.currentPoints.push({ x, y, p });
        // Update temp annotation
        this.store.updateAnnotation('temp_drawing', { points: this.currentPoints });
    }

    onMouseUp(_x: number, _y: number, _e: MouseEvent | PointerEvent) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        // Finalize
        this.store.deleteAnnotation('temp_drawing');
        const state = this.store.getState();

        if (this.currentPoints.length > 1) {
            const currentDur = state.defaultDuration || 1;
            console.log(`[FreehandTool] Creating annotation. Frame: ${state.currentFrame}, Duration: ${currentDur}, Onion: ${state.isOnionSkinEnabled}`);

            const newAnnotation: Annotation = {
                id: uuidv4(),
                frame: state.currentFrame,
                duration: currentDur, // Use global duration setting
                type: 'freehand',
                points: [...this.currentPoints], // Helper to clone
                style: {
                    color: state.activeColor,
                    width: state.activeStrokeWidth
                }
            };
            this.store.addAnnotation(newAnnotation);
            this.store.captureSnapshot(); // Commit history
        }
        this.currentPoints = [];
    }
}
