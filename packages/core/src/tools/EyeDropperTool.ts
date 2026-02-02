import { BaseTool } from './BaseTool';
import type { WebMediaAnnotator } from '../index';

export class EyeDropperTool extends BaseTool {
    constructor(annotator: WebMediaAnnotator, private onPickColor: (x: number, y: number) => void) {
        super(annotator);
    }

    onMouseDown(x: number, y: number, e: MouseEvent | PointerEvent) {
        this.onPickColor(x, y);
        // Switch back to previous tool?
    }

    onMouseMove(x: number, y: number, e: MouseEvent | PointerEvent) { }
    onMouseUp(x: number, y: number, e: MouseEvent | PointerEvent) { }
}
