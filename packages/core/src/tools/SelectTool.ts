import { BaseTool } from './BaseTool';
import { Store, Annotation } from '../Store';

export class SelectTool extends BaseTool {
    private isDragging = false;
    private startDragPoint: { x: number; y: number } | null = null;
    private initialAnnotations: Map<string, Annotation> = new Map();

    onMouseDown(x: number, y: number, e: MouseEvent | PointerEvent) {
        const frame = this.store.getState().currentFrame;
        const annotations = this.store.getAnnotationsForFrame(frame);
        const state = this.store.getState();
        const isMultiSelect = e.ctrlKey || e.metaKey;

        let hitId: string | null = null;

        // Check in reverse order (top to bottom)
        for (let i = annotations.length - 1; i >= 0; i--) {
            const ann = annotations[i];
            if (this.hitTest(ann, x, y)) {
                hitId = ann.id;
                break;
            }
        }

        console.log(`[SelectTool] HitTest: ${hitId ? hitId : 'None'}`);

        let nextSelectedIds = [...state.selectedAnnotationIds];

        if (hitId) {
            if (isMultiSelect) {
                // Toggle selection
                if (nextSelectedIds.includes(hitId)) {
                    nextSelectedIds = nextSelectedIds.filter(id => id !== hitId);
                } else {
                    nextSelectedIds.push(hitId);
                }
            } else {
                // If the hitId is part of current selection, keep it (to allow dragging group)
                // Otherwise, switch selection to just this one.
                if (!nextSelectedIds.includes(hitId)) {
                    nextSelectedIds = [hitId];
                }
            }
        } else {
            // Clicked empty space
            if (!isMultiSelect) {
                nextSelectedIds = [];
            }
        }

        this.store.setState({ selectedAnnotationIds: nextSelectedIds });

        // Start Drag if we hit something that is now selected
        const isDraggingSelection = hitId && nextSelectedIds.includes(hitId);
        if (isDraggingSelection) {
            this.isDragging = true;
            this.startDragPoint = { x, y };
            this.initialAnnotations.clear();

            // Snapshot initial state for all currently selected annotations on this frame
            nextSelectedIds.forEach(id => {
                const ann = annotations.find(a => a.id === id);
                if (ann) {
                    this.initialAnnotations.set(id, JSON.parse(JSON.stringify(ann)));
                }
            });
        }
    }

    onMouseMove(x: number, y: number, e: MouseEvent | PointerEvent) {
        if (!this.isDragging || !this.startDragPoint || this.initialAnnotations.size === 0) return;

        const dx = x - this.startDragPoint.x;
        const dy = y - this.startDragPoint.y;

        // Apply delta to all dragged annotations
        this.initialAnnotations.forEach((initialAnn, id) => {
            if (initialAnn.points) {
                const newPoints = initialAnn.points.map(p => ({
                    ...p,
                    x: p.x + dx,
                    y: p.y + dy
                }));
                this.store.updateAnnotation(id, { points: newPoints });
            }
        });
    }

    onMouseUp(x: number, y: number, e: MouseEvent | PointerEvent) {
        if (this.isDragging) {
            this.store.captureSnapshot();
        }
        this.isDragging = false;
        this.startDragPoint = null;
        this.initialAnnotations.clear();
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
        if (ann.type === 'freehand' || ann.points.length > 2) {
            // Distance to polyline sequences
            for (let i = 0; i < ann.points.length - 1; i++) {
                const p1 = ann.points[i];
                const p2 = ann.points[i + 1];
                const dist = this.distToSegment(x, y, p1.x, p1.y, p2.x, p2.y);
                if (dist <= THRESHOLD) return true;
            }
            return false;
        }

        if (ann.type === 'arrow' && ann.points.length === 2) {
            const p1 = ann.points[0];
            const p2 = ann.points[1];
            return this.distToSegment(x, y, p1.x, p1.y, p2.x, p2.y) <= THRESHOLD;
        }

        if (ann.type === 'circle' && ann.points.length === 2) {
            const p1 = ann.points[0];
            const p2 = ann.points[1];
            const cx = (p1.x + p2.x) / 2;
            const cy = (p1.y + p2.y) / 2;
            const rx = Math.abs(p2.x - p1.x) / 2;
            const ry = Math.abs(p2.y - p1.y) / 2;

            // Normalized distance (Ellipse equation: (x-cx)^2/rx^2 + (y-cy)^2/ry^2 <= 1)
            const dx = (x - cx) / (rx + THRESHOLD);
            const dy = (y - cy) / (ry + THRESHOLD);
            return (dx * dx + dy * dy) <= 1;
        }

        // Square/Standard (Bounding box check passed, so true)
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
