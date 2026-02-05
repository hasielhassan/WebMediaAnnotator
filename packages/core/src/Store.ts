import { EventEmitter } from 'eventemitter3';

export interface Annotation {
    id: string;
    frame: number; // Start frame
    duration?: number; // Duration in frames (default 1)
    type: 'freehand' | 'arrow' | 'circle' | 'square' | 'text';
    points?: { x: number; y: number; p?: number }[]; // For freehand/polygons
    text?: string;
    // Fallback vector paths for text (opentype.js JSON format or SVG path commands)
    fallbackPaths?: unknown[];
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
    selectedAnnotationIds: string[];

    // Editor State
    activeTool: 'select' | 'freehand' | 'arrow' | 'circle' | 'square' | 'text' | 'eraser' | 'pan';
    activeColor: string;
    activeStrokeWidth: number;
    defaultDuration: number; // For new annotations (Property)
    holdDuration: number;   // Global View Mode (Override/Extension)
    isOnionSkinEnabled: boolean;
    onionSkinPrevFrames: number;
    onionSkinNextFrames: number;

    // Viewport
    viewport: {
        x: number;
        y: number;
        scale: number;
    };

    // Media Info
    mediaType: 'video' | 'image' | undefined;
    buffered: { start: number; end: number }[]; // In seconds
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
    selectedAnnotationIds: [],
    activeTool: 'select',
    activeColor: '#FF0000',
    activeStrokeWidth: 3,
    defaultDuration: 1, // Default property: 1 frame
    holdDuration: 1,    // Default view: No hold (1 frame)
    isOnionSkinEnabled: false,
    onionSkinPrevFrames: 3,
    onionSkinNextFrames: 3,
    viewport: { x: 0, y: 0, scale: 1 },
    mediaType: 'video',
    buffered: [],
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
    // Selectors
    getAnnotationsForFrame(frame: number): Annotation[] {
        // Global Hold Logic (Opaque Onion Skin)
        // logic: effectiveDuration = Math.max(nativeDuration, holdDuration)
        // If Hold is OFF (holdDuration <= 1), effective = nativeDuration.
        // If Hold is ON (holdDuration > 1), effective = max(native, hold).

        const globalWindow = this.state.holdDuration || 1;

        return this.state.annotations.filter(a => {
            const start = a.frame;
            // Native duration of the annotation
            const nativeDuration = a.duration || 1;

            // Effective duration
            const effectiveDuration = Math.max(nativeDuration, globalWindow);

            const end = start + effectiveDuration - 1;

            return frame >= start && frame <= end;
        });
    }

    addAnnotation(annotation: Annotation, fromRemote = false) {
        if (fromRemote) {
            console.log(`[Store] Received Remote Annotation: ${annotation.id}, Frame: ${annotation.frame}, Duration: ${annotation.duration}`);
            this.injectRemoteAnnotationChange(annotation.id, annotation, 'add');
        }
        this.setState({
            annotations: [...this.state.annotations, annotation]
        });
        this.emit('annotation:added', annotation, fromRemote);
    }

    updateAnnotation(id: string, updates: Partial<Annotation>, fromRemote = false) {
        if (fromRemote) {
            this.injectRemoteAnnotationChange(id, updates, 'update');
        }
        const annotations = this.state.annotations.map(a =>
            a.id === id ? { ...a, ...updates } : a
        );
        this.setState({ annotations });
        this.emit('annotation:updated', id, updates, fromRemote);
    }

    deleteAnnotation(id: string, fromRemote = false) {
        if (fromRemote) {
            this.injectRemoteAnnotationChange(id, null, 'delete');
        }
        this.setState({
            annotations: this.state.annotations.filter(a => a.id !== id)
        });
        this.emit('annotation:deleted', id, fromRemote);
    }

    /**
     * Propagates a remote change into all historical snapshots.
     * This ensures that when we reconcile for undo/redo, remote changes are seen as
     * "already existing" in the past, so they aren't reverted.
     */
    private injectRemoteAnnotationChange(id: string, data: Partial<Annotation> | null, action: 'add' | 'update' | 'delete') {
        const updateStack = (stack: AppState[]) => {
            stack.forEach(snap => {
                if (action === 'add') {
                    // Avoid dups
                    if (!snap.annotations.some(a => a.id === id)) {
                        snap.annotations.push(data as Annotation);
                    }
                } else if (action === 'update') {
                    const idx = snap.annotations.findIndex(a => a.id === id);
                    if (idx !== -1) {
                        snap.annotations[idx] = { ...snap.annotations[idx], ...data };
                    }
                } else if (action === 'delete') {
                    snap.annotations = snap.annotations.filter(a => a.id !== id);
                }
            });
        };

        updateStack(this.historyStack);
        updateStack(this.redoStack);
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

    private applyStateReconciliation(targetState: AppState) {
        const currentState = this.state;

        // 1. Reconcile Annotations via Diffs
        // We look at the list of annotations in currentState vs targetState
        // and apply granular actions (add/update/delete) so they emit events for LinkSync.

        const currentAnns = currentState.annotations;
        const targetAnns = targetState.annotations;

        // Maps for easy lookup
        const currentMap = new Map(currentAnns.map(a => [a.id, a]));
        const targetMap = new Map(targetAnns.map(a => [a.id, a]));

        // Deletions: In current but NOT in target
        currentAnns.forEach(ann => {
            if (!targetMap.has(ann.id)) {
                this.deleteAnnotation(ann.id);
            }
        });

        // Additions & Updates: In target
        targetAnns.forEach(targetAnn => {
            const currentAnn = currentMap.get(targetAnn.id);
            if (!currentAnn) {
                // New locally (restored from undo)
                this.addAnnotation(targetAnn);
            } else {
                // Existing - check for updates (deep equal check ideally, but JSON stringify is a quick proxy)
                if (JSON.stringify(currentAnn) !== JSON.stringify(targetAnn)) {
                    this.updateAnnotation(targetAnn.id, targetAnn);
                }
            }
        });

        // 2. Apply non-annotation state (viewport, tool etc) directly
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { annotations: _unused, ...rest } = targetState;
        this.setState(rest);
    }

    undo() {
        if (this.historyStack.length <= 1) return;

        this.isUndoing = true;
        const currentStateSnapshot = this.historyStack.pop();
        if (currentStateSnapshot) {
            this.redoStack.push(currentStateSnapshot);
        }

        const previousState = this.historyStack[this.historyStack.length - 1];
        if (previousState) {
            this.applyStateReconciliation(previousState);
        }
        this.isUndoing = false;
    }

    redo() {
        if (this.redoStack.length === 0) return;

        this.isUndoing = true;
        const nextState = this.redoStack.pop();
        if (nextState) {
            this.historyStack.push(nextState);
            this.applyStateReconciliation(nextState);
        }
        this.isUndoing = false;
    }
}
