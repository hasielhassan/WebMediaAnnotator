import { BaseTool } from './BaseTool';
import { Store, Annotation } from '../Store';

export class SelectTool extends BaseTool {
    private isDragging = false;
    private startDragPoint: { x: number; y: number } | null = null;
    private selectedAnnotationId: string | null = null;
    private initialAnnotationState: Annotation | null = null;

    onMouseDown(x: number, y: number) {
        // 1. Hit Test
        const frame = this.store.getState().currentFrame;
        const annotations = this.store.getAnnotationsForFrame(frame);

        let hitId: string | null = null;

        // Check in reverse order (top to bottom)
        for (let i = annotations.length - 1; i >= 0; i--) {
            const ann = annotations[i];
            if (this.hitTest(ann, x, y)) {
                hitId = ann.id;
                break;
            }
        }

        this.store.setState({ selectedAnnotationId: hitId });
        this.selectedAnnotationId = hitId;

        if (hitId) {
            this.isDragging = true;
            this.startDragPoint = { x, y };
            const ann = annotations.find(a => a.id === hitId);
            if (ann) this.initialAnnotationState = JSON.parse(JSON.stringify(ann));
        }
    }

    onMouseMove(x: number, y: number) {
        if (!this.isDragging || !this.selectedAnnotationId || !this.startDragPoint || !this.initialAnnotationState) return;

        const dx = x - this.startDragPoint.x;
        const dy = y - this.startDragPoint.y;

        // Apply delta to points
        if (this.initialAnnotationState.points) {
            const newPoints = this.initialAnnotationState.points.map(p => ({
                x: p.x + dx,
                y: p.y + dy
            }));
            this.store.updateAnnotation(this.selectedAnnotationId, { points: newPoints });
        }
    }

    onMouseUp(x: number, y: number) {
        if (this.isDragging) {
            this.store.captureSnapshot();
        }
        this.isDragging = false;
        this.startDragPoint = null;
        this.initialAnnotationState = null;
    }

    private hitTest(ann: Annotation, x: number, y: number): boolean {
        // 1. Text Hit Test (Approximation)
        if (ann.type === 'text' && ann.points && ann.text) {
            const p = ann.points[0];
            // Approx width/height based on font size (assuming ~24px at 1080p -> ~0.02 normalized)
            // W = char count * width per char (approx 0.015)
            const W = (ann.text.length * 0.012);
            const H = 0.025;
            // Box usually starts at bottom-left or top-left? Canvas fillText starts at baseline left.
            // Let's assume point is bottom-left.
            // Test range: x to x+W, y-H to y (if baseline). 
            // Or center? Let's try centered box logic or top-left.
            // Standard canvas text is bottom-left aligned by default if not specified.
            // Let's assume standard top-left for simplicity in our tool or check Renderer.
            // Renderer: this.ctx.fillText(annotation.text, x, y); Default is alphabetic baseline.
            // So y is the bottom line.

            return x >= p.x && x <= p.x + W && y >= p.y - H && y <= p.y + (H * 0.2);
        }

        if (!ann.points || ann.points.length === 0) return false;

        const THRESHOLD = 0.02; // Normalized coord threshold ~2%

        // 2. Check Bounding Box optimization
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        ann.points.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });

        // Quick fail if outside expanded bbox
        if (x < minX - THRESHOLD || x > maxX + THRESHOLD || y < minY - THRESHOLD || y > maxY + THRESHOLD) {
            return false;
        }

        // 3. Exact Shape Test
        if (ann.type === 'freehand' || ann.type === 'arrow' || ann.points.length > 2) {
            // Distance to polyline sequences
            for (let i = 0; i < ann.points.length - 1; i++) {
                const p1 = ann.points[i];
                const p2 = ann.points[i + 1];
                const dist = this.distToSegment(x, y, p1.x, p1.y, p2.x, p2.y);
                if (dist <= THRESHOLD) return true;
            }
            return false;
        }

        // Square/Circle (Bounding box check passed, so true)
        return true;
    }

    private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
        const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        if (l2 === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        const x = x1 + t * (x2 - x1);
        const y = y1 + t * (y2 - y1);
        return Math.sqrt((px - x) * (px - x) + (py - y) * (py - y));
    }
}
