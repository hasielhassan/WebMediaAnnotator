import { BaseTool } from './BaseTool';
import { Store, Annotation } from '../Store';
import { v4 as uuidv4 } from 'uuid';

export class FreehandTool extends BaseTool {
    private isDrawing = false;
    private currentPoints: { x: number; y: number; p?: number }[] = [];

    onMouseDown(x: number, y: number, e: MouseEvent | PointerEvent) {
        this.isDrawing = true;
        const p = (e instanceof PointerEvent && e.pressure > 0) ? e.pressure : 0.5;
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
        const p = (e instanceof PointerEvent && e.pressure > 0) ? e.pressure : 0.5;
        this.currentPoints.push({ x, y, p });
        // Update temp annotation
        this.store.updateAnnotation('temp_drawing', { points: this.currentPoints });
    }

    onMouseUp(x: number, y: number, e: MouseEvent | PointerEvent) {
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
