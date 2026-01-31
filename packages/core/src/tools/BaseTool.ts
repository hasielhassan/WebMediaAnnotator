import type { WebMediaAnnotator } from '../index';
import type { Store } from '../Store';

export abstract class BaseTool {
    protected annotator: WebMediaAnnotator;
    protected store: Store;

    constructor(annotator: WebMediaAnnotator) {
        this.annotator = annotator;
        this.store = annotator.store;
    }

    abstract onMouseDown(x: number, y: number, e: MouseEvent): void;
    abstract onMouseMove(x: number, y: number, e: MouseEvent): void;
    abstract onMouseUp(x: number, y: number, e: MouseEvent): void;

    // Optional
    onKeyDown?(e: KeyboardEvent): void;
}
