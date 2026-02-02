import type { WebMediaAnnotator } from '../index';
import type { Store } from '../Store';

export abstract class BaseTool {
    protected annotator: WebMediaAnnotator;
    protected store: Store;

    constructor(annotator: WebMediaAnnotator) {
        this.annotator = annotator;
        this.store = annotator.store;
    }

    abstract onMouseDown(x: number, y: number, e: MouseEvent | PointerEvent): void;
    abstract onMouseMove(x: number, y: number, e: MouseEvent | PointerEvent): void;
    abstract onMouseUp(x: number, y: number, e: MouseEvent | PointerEvent): void;

    // Optional
    onKeyDown?(e: KeyboardEvent): void;
}
