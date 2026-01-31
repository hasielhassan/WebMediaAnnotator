import { BaseTool } from './BaseTool';
import { Store } from '../Store';

export class EraserTool extends BaseTool {
    private isErasing = false;

    onMouseDown(x: number, y: number) {
        this.isErasing = true;
        this.eraseAt(x, y);
    }

    onMouseMove(x: number, y: number) {
        if (this.isErasing) {
            this.eraseAt(x, y);
        }
    }

    onMouseUp(x: number, y: number) {
        if (this.isErasing) {
            this.store.captureSnapshot();
        }
        this.isErasing = false;
    }

    private eraseAt(x: number, y: number) {
        const frame = this.store.getState().currentFrame;
        const annotations = this.store.getAnnotationsForFrame(frame);

        // Check collision and delete
        // Similar hit test logic to SelectTool but deletes instead
        for (const ann of annotations) {
            if (this.hitTest(ann, x, y)) {
                this.store.deleteAnnotation(ann.id);
            }
        }
    }

    private hitTest(ann: any, x: number, y: number): boolean {
        // Reuse same logic or import helper
        if (!ann.points || ann.points.length === 0) return false;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        ann.points.forEach((p: any) => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });
        const pad = 0.02; // Larger hit area for eraser
        return x >= minX - pad && x <= maxX + pad && y >= minY - pad && y <= maxY + pad;
    }
}
