import { EventEmitter } from 'eventemitter3';

export interface Annotation {
    id: string;
    frame: number; // Start frame
    duration?: number; // Duration in frames (default 1)
    type: 'freehand' | 'arrow' | 'circle' | 'square' | 'text';
    points?: { x: number; y: number }[]; // For freehand/polygons
    text?: string;
    style: {
        color: string;
        width: number;
        fill?: string;
        fontSize?: number;
    };
    transform?: {
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
        rotation: number;
    };
}

export interface AppState {
    isPlaying: boolean;
    currentTime: number; // In seconds
    currentFrame: number;
    duration: number; // In seconds
    fps: number;
    volume: number;
    startFrame: number; // Offset (e.g., 1001)

    // Annotation State
    annotations: Annotation[];
    selectedAnnotationId: string | null;

    // Editor State
    activeTool: 'select' | 'freehand' | 'arrow' | 'circle' | 'square' | 'text' | 'eraser' | 'pan';
    activeColor: string;
    activeStrokeWidth: number;
    isOnionSkinEnabled: boolean;
    onionSkinPrevFrames: number;
    onionSkinNextFrames: number;

    // Viewport
    viewport: {
        x: number;
        y: number;
        scale: number;
    };
}

export const DEFAULT_STATE: AppState = {
    isPlaying: false,
    currentTime: 0,
    currentFrame: 0,
    duration: 0,
    fps: 24,
    volume: 1,
    startFrame: 0,
    annotations: [],
    selectedAnnotationId: null,
    activeTool: 'select',
    activeColor: '#FF0000',
    activeStrokeWidth: 3,
    isOnionSkinEnabled: false,
    onionSkinPrevFrames: 3,
    onionSkinNextFrames: 3,
    viewport: { x: 0, y: 0, scale: 1 },
};

export class Store extends EventEmitter {
    private state: AppState;

    constructor(initialState: Partial<AppState> = {}) {
        super();
        this.state = { ...DEFAULT_STATE, ...initialState };
        // Initial snapshot
        this.historyStack.push({ ...this.state });
    }

    getState(): AppState {
        return { ...this.state };
    }



    // Selectors
    getAnnotationsForFrame(frame: number): Annotation[] {
        return this.state.annotations.filter(a => {
            const start = a.frame;
            const end = start + (a.duration || 1) - 1;
            return frame >= start && frame <= end;
        });
    }

    addAnnotation(annotation: Annotation) {
        this.setState({
            annotations: [...this.state.annotations, annotation]
        });
        this.emit('annotation:added', annotation);
    }

    updateAnnotation(id: string, updates: Partial<Annotation>) {
        const annotations = this.state.annotations.map(a =>
            a.id === id ? { ...a, ...updates } : a
        );
        this.setState({ annotations });
        this.emit('annotation:updated', id, updates);
    }

    deleteAnnotation(id: string) {
        this.setState({
            annotations: this.state.annotations.filter(a => a.id !== id)
        });
        this.emit('annotation:deleted', id);
    }

    // History //
    private historyStack: AppState[] = [];
    private redoStack: AppState[] = [];
    private isUndoing = false;

    // Override setState to capture history
    setState(partial: Partial<AppState>) {
        const prevState = { ...this.state };
        this.state = { ...this.state, ...partial };
        this.emit('state:changed', this.state, prevState);
    }

    /**
     * Call this when a discrete user action is completed (e.g., mouse up)
     */
    captureSnapshot() {
        if (this.isUndoing) return;

        // Push current state to history
        this.historyStack.push({ ...this.state });
        this.redoStack = []; // Clear redo

        // Limit stack size (optional, e.g. 50)
        if (this.historyStack.length > 50) {
            this.historyStack.shift();
        }
    }

    undo() {
        if (this.historyStack.length <= 1) return; // Need at least one state to remain

        this.isUndoing = true;
        const currentState = this.historyStack.pop(); // Pop current state
        if (currentState) {
            this.redoStack.push(currentState);
        }

        const previousState = this.historyStack[this.historyStack.length - 1]; // Peek
        if (previousState) {
            this.state = { ...previousState }; // Restore
            // We need to emit change so UI updates
            this.emit('state:changed', this.state, currentState || this.state);
        }
        this.isUndoing = false;
    }

    redo() {
        if (this.redoStack.length === 0) return;

        this.isUndoing = true;
        const nextState = this.redoStack.pop();
        if (nextState) {
            this.historyStack.push(nextState);
            const prevState = this.state;
            this.state = { ...nextState };
            this.emit('state:changed', this.state, prevState);
        }
        this.isUndoing = false;
    }
}
