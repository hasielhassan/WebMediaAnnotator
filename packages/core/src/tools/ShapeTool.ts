import { BaseTool } from './BaseTool';
import type { WebMediaAnnotator } from '../index';
import { Annotation } from '../Store';
import { v4 as uuidv4 } from 'uuid';

export class ShapeTool extends BaseTool {
    private isDrawing = false;
    private startPoint: { x: number; y: number } | null = null;
    private type: 'square' | 'circle' | 'arrow';

    constructor(annotator: WebMediaAnnotator, type: 'square' | 'circle' | 'arrow') {
        super(annotator);
        this.type = type;
    }

    onMouseDown(x: number, y: number) {
        this.isDrawing = true;
        this.startPoint = { x, y };

        const state = this.store.getState();
        const tempAnnotation: Annotation = {
            id: 'temp_shape',
            frame: state.currentFrame,
            type: this.type,
            points: [this.startPoint, { x, y }],
            style: {
                color: state.activeColor,
                width: state.activeStrokeWidth
            }
        };
        this.store.addAnnotation(tempAnnotation);
    }

    onMouseMove(x: number, y: number) {
        if (!this.isDrawing || !this.startPoint) return;

        // Update temp annotation end point
        this.store.updateAnnotation('temp_shape', {
            points: [this.startPoint, { x, y }]
        });
    }

    onMouseUp(x: number, y: number) {
        if (!this.isDrawing || !this.startPoint) return;
        this.isDrawing = false;

        this.store.deleteAnnotation('temp_shape');
        const state = this.store.getState();

        // Prevent 0-size shapes
        if (Math.abs(x - this.startPoint.x) > 0.001 || Math.abs(y - this.startPoint.y) > 0.001) {
            const newAnnotation: Annotation = {
                id: uuidv4(),
                frame: state.currentFrame,
                duration: state.activeDuration,
                type: this.type,
                points: [this.startPoint, { x, y }],
                style: {
                    color: state.activeColor,
                    width: state.activeStrokeWidth
                }
            };
            this.store.addAnnotation(newAnnotation);
            this.store.captureSnapshot(); // Commit history
        }
        this.startPoint = null;
    }
}
