import { BaseTool } from '../../tools/BaseTool'; // Moved to ../../tools/BaseTool
import { Annotation, Point } from '../../Store'; // Moved to ../../Store

export class PolyLineTool extends BaseTool {
    private points: Point[] = [];
    private isDrawing = false;
    private tempId: string | null = null;
    private lastClickTime = 0;

    onMouseDown(x: number, y: number, e: PointerEvent): void {
        e.preventDefault();
        if (e.button !== 0) return;

        const now = Date.now();
        const isDoubleClick = (now - this.lastClickTime) < 300; // 300ms threshold
        this.lastClickTime = now;

        if (isDoubleClick && this.isDrawing) {
            this.finish();
            return;
        }

        if (!this.isDrawing) {
            // Start
            this.isDrawing = true;
            this.points = [{ x, y }];
            this.tempId = `temp_${Date.now()}`;

            const annotation: Annotation = {
                id: this.tempId,
                type: 'polyline', // Renderer needs to support this!
                frame: this.store.getState().currentFrame,
                points: this.points, // Initially one point
                style: {
                    color: this.store.getState().activeColor,
                    width: 4,
                    fill: 'transparent'
                },
                timestamp: Date.now()
            };
            this.store.addAnnotation(annotation);
        } else {
            // Add point
            this.points.push({ x, y });
            if (this.tempId) {
                // Update with new point added
                this.store.updateAnnotation(this.tempId, { points: [...this.points] });
            }
        }
    }

    onMouseMove(x: number, y: number, _e: PointerEvent): void {
        if (this.isDrawing) {
            // Preview next line segment
            const preview = [...this.points, { x, y }];
            this.store.updateAnnotation(this.tempId!, { points: preview });
        }
    }

    onMouseUp(x: number, y: number, e: PointerEvent): void {
        // No-op
    }

    private finish() {
        if (!this.tempId) return;

        // Finalize: Remove the transient cursor point if needed (handled by logic: points only has committed points)
        // Wait, in onMouseMove we pushed a display-only point.
        // In onMouseDown, we pushed a real point.
        // When finishing, we just ensure the annotation has the real points.

        // Actually, if we DblClick, the last click might add a duplicate point or we might want to just stop.
        // Let's just update with `this.points` which contains only committed points.

        // Remove temp prefix to make it permanent
        const finalId = crypto.randomUUID();
        const ann = this.store.getState().annotations.find(a => a.id === this.tempId);

        if (ann) {
            this.store.deleteAnnotation(this.tempId); // Remove temp
            this.store.addAnnotation({ ...ann, id: finalId, points: this.points }); // Add final
        }

        this.isDrawing = false;
        this.points = [];
        this.tempId = null;
    }
}
