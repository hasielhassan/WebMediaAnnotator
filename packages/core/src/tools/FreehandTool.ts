import { BaseTool } from './BaseTool';
import { Store, Annotation } from '../Store';
import { v4 as uuidv4 } from 'uuid';

export class FreehandTool extends BaseTool {
    private isDrawing = false;
    private currentPoints: { x: number; y: number }[] = [];

    onMouseDown(x: number, y: number) {
        this.isDrawing = true;
        this.currentPoints = [{ x, y }];

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

    onMouseMove(x: number, y: number) {
        if (!this.isDrawing) return;
        this.currentPoints.push({ x, y });
        // Update temp annotation
        this.store.updateAnnotation('temp_drawing', { points: this.currentPoints });
    }

    onMouseUp(x: number, y: number) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        // Finalize
        this.store.deleteAnnotation('temp_drawing');
        const state = this.store.getState();

        if (this.currentPoints.length > 1) {
            const newAnnotation: Annotation = {
                id: uuidv4(),
                frame: state.currentFrame,
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
