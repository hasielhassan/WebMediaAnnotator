import { BaseTool } from './BaseTool';

export class PanTool extends BaseTool {
    private lastX: number = 0;
    private lastY: number = 0;
    private isDragging: boolean = false;

    // We rely on 'e' (screen coordinates) for stable panning
    onMouseDown(x: number, y: number, e: MouseEvent | PointerEvent): void {
        this.isDragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
    }

    onMouseMove(x: number, y: number, e: MouseEvent | PointerEvent): void {
        if (!this.isDragging) return;

        // Calculate delta in SCREEN PIXELS directly
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;

        const currentViewport = this.annotator.store.getState().viewport;

        // CSS Translation is additive in screen pixels
        this.annotator.store.setState({
            viewport: {
                ...currentViewport,
                x: currentViewport.x + dx,
                y: currentViewport.y + dy
            }
        });

        this.lastX = e.clientX;
        this.lastY = e.clientY;
    }

    onMouseUp(_x: number, _y: number, _e: MouseEvent | PointerEvent): void {
        this.isDragging = false;
    }
}
