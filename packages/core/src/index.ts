import { Store, AppState, Annotation } from './Store';
import { Player } from './Player';
import { LinkSync } from './LinkSync';
import { Renderer } from './Renderer';
import { PluginManager } from './PluginManager';
import { BaseTool } from './tools/BaseTool';
import { FreehandTool } from './tools/FreehandTool';
import { ShapeTool } from './tools/ShapeTool';
import { SelectTool } from './tools/SelectTool';
import { TextTool } from './tools/TextTool';
import { EraserTool } from './tools/EraserTool';
import { EyeDropperTool } from './tools/EyeDropperTool';
import { PanTool } from './tools/PanTool';

export class WebMediaAnnotator {
    public store: Store;
    public player: Player;
    public sync: LinkSync;
    public renderer: Renderer;
    public plugins: PluginManager;

    // Tools
    private tools: Map<string, BaseTool> = new Map();
    private canvasElement: HTMLCanvasElement;

    // DOM
    private container: HTMLElement;
    private videoElement: HTMLVideoElement;

    // State for temporary tool switching
    private previousTool: string | null = null;
    private isRemotePlayback = false; // Mutex for playback sync
    private isRemoteSessionUpdate = false; // Mutex for session params sync
    private clipboard: Annotation[] = [];

    constructor(container: HTMLElement, options: {
        videoSrc?: string;
        fps?: number;
        startFrame?: number
    } = {}) {
        this.container = container;
        this.container.style.position = 'relative'; // Ensure positioning context

        // 1. Video Layer
        this.videoElement = document.createElement('video');
        this.videoElement.style.width = '100%';
        this.videoElement.style.height = '100%';
        this.videoElement.style.display = 'block';

        // Critical: Disable native controls and PiP to prevent browser interference
        this.videoElement.controls = false;
        // @ts-ignore - disablePictureInPicture is standard but strict TS might miss it on HTMLVideoElement
        this.videoElement.disablePictureInPicture = true;
        this.videoElement.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
        this.videoElement.setAttribute('playsinline', 'true');

        if (options.videoSrc) this.videoElement.src = options.videoSrc;
        this.container.appendChild(this.videoElement);

        // 2. Canvas Layer
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.style.position = 'absolute';
        this.canvasElement.style.top = '0';
        this.canvasElement.style.left = '0';
        this.canvasElement.style.pointerEvents = 'auto'; // allow interaction
        this.canvasElement.style.touchAction = 'none'; // Critical for Pointer Events handling
        this.container.appendChild(this.canvasElement);

        // 3. Initialize Core
        this.store = new Store({
            fps: options.fps || 24,
            startFrame: options.startFrame || 0
        });

        this.player = new Player(this.store, this.videoElement);
        this.sync = new LinkSync();
        this.renderer = new Renderer(this.store, this.canvasElement, this.videoElement);
        this.plugins = new PluginManager(this);


        // 4. Initialize Tools
        this.tools.set('select', new SelectTool(this));
        this.tools.set('freehand', new FreehandTool(this));
        this.tools.set('square', new ShapeTool(this, 'square'));
        this.tools.set('circle', new ShapeTool(this, 'circle'));
        this.tools.set('arrow', new ShapeTool(this, 'arrow'));
        this.tools.set('text', new TextTool(this));
        this.tools.set('eraser', new EraserTool(this));
        this.tools.set('pan', new PanTool(this));

        this.tools.set('eyedropper', new EyeDropperTool(this, (x: number, y: number) => {
            // Pick color logic
            const rect = this.videoElement.getBoundingClientRect();

            // Draw video frame to offscreen canvas
            const offscreen = document.createElement('canvas');
            offscreen.width = this.videoElement.videoWidth;
            offscreen.height = this.videoElement.videoHeight;
            const ctx = offscreen.getContext('2d');
            if (ctx) {
                ctx.drawImage(this.videoElement, 0, 0);
                const pxX = Math.floor(x * offscreen.width);
                const pxY = Math.floor(y * offscreen.height);
                const pixel = ctx.getImageData(pxX, pxY, 1, 1).data;
                const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);

                this.store.setState({ activeColor: hex, activeTool: 'freehand' }); // Auto switch back to brush
            }
        }));

        this.initInteraction();
        this.initShortcuts();
        this.initResizeObserver();
        this.initSyncBinding();

        // 5. Global Deselection (Click on background bars)
        this.container.addEventListener('pointerdown', (e) => {
            if (e.target === this.container) {
                this.store.setState({ selectedAnnotationIds: [] });
            }
        });
    }

    private initInteraction() {
        // Multi-touch State
        const activePointers = new Map<number, PointerEvent>();
        let initialPinchDist: number | null = null;
        let initialScale = 1;

        const getDist = (p1: PointerEvent, p2: PointerEvent) => {
            return Math.sqrt(Math.pow(p1.clientX - p2.clientX, 2) + Math.pow(p1.clientY - p2.clientY, 2));
        };

        // Simple Interaction Dispatcher
        const getXY = (e: MouseEvent | PointerEvent) => {
            const rect = this.canvasElement.getBoundingClientRect();
            // With CSS Transforms, getBoundingClientRect returns the VISUAL position/size.
            return {
                x: (e.clientX - rect.left) / rect.width,
                y: (e.clientY - rect.top) / rect.height,
                pressure: (e instanceof PointerEvent) ? (e.pressure > 0 ? e.pressure : 0.5) : 0.5
            };
        };

        this.canvasElement.addEventListener('pointerdown', (e) => {
            activePointers.set(e.pointerId, e);
            this.canvasElement.setPointerCapture(e.pointerId);

            if (activePointers.size === 2) {
                // Start Pinch
                const points = Array.from(activePointers.values());
                initialPinchDist = getDist(points[0], points[1]);
                initialScale = this.store.getState().viewport.scale;
                return;
            }

            // Middle Mouse (Button 1) -> Temporary Pan
            if (e.button === 1) {
                e.preventDefault();
                this.previousTool = this.store.getState().activeTool;
                this.store.setState({ activeTool: 'pan' });
                const { x, y } = getXY(e);
                const panTool = this.tools.get('pan');
                if (panTool) panTool.onMouseDown(x, y, e);
                return;
            }

            if (activePointers.size === 1) {
                const { x, y, pressure } = getXY(e);
                const toolName = this.store.getState().activeTool;
                const tool = this.tools.get(toolName);
                if (tool) tool.onMouseDown(x, y, e);
            }
        });

        window.addEventListener('pointermove', (e) => {
            const rect = this.canvasElement.getBoundingClientRect();
            // Update pointer record
            if (activePointers.has(e.pointerId)) {
                activePointers.set(e.pointerId, e);
            }

            // Pinch Zoom Logic
            if (activePointers.size === 2 && initialPinchDist) {
                const points = Array.from(activePointers.values());
                const dist = getDist(points[0], points[1]);
                const scaleFactor = dist / initialPinchDist;

                // Update Scale (clamped)
                const newScale = Math.min(Math.max(0.1, initialScale * scaleFactor), 5);

                const vp = this.store.getState().viewport;
                this.store.setState({
                    viewport: { ...vp, scale: newScale }
                });
                return;
            }

            // Standard Move
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;

            const toolName = this.store.getState().activeTool;
            const tool = this.tools.get(toolName);
            if (tool) tool.onMouseMove(x, y, e);
        });

        window.addEventListener('pointerup', (e) => {
            activePointers.delete(e.pointerId);
            this.canvasElement.releasePointerCapture(e.pointerId);

            if (activePointers.size < 2) {
                initialPinchDist = null;
            }

            // Middle Mouse Up -> Revert Tool
            if (e.button === 1 && this.previousTool) {
                const panTool = this.tools.get('pan');
                const rect = this.canvasElement.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;
                if (panTool) panTool.onMouseUp(x, y, e);

                this.store.setState({ activeTool: this.previousTool as any });
                this.previousTool = null;
                return;
            }

            const rect = this.canvasElement.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            const toolName = this.store.getState().activeTool;
            const tool = this.tools.get(toolName);
            if (tool) tool.onMouseUp(x, y, e);
        });

        // Wheel Zoom
        this.canvasElement.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const zoomSpeed = 0.001;
                const vp = this.store.getState().viewport;
                const newScale = Math.min(Math.max(0.1, vp.scale + (-e.deltaY * zoomSpeed * vp.scale)), 5); // Logarithmic-ish
                this.store.setState({
                    viewport: { ...vp, scale: newScale }
                });
            }
        }, { passive: false });
    }

    private initShortcuts() {
        window.addEventListener('keydown', (e) => {
            // Ignore keystrokes if focused on an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            // Undo/Redo
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    this.store.undo();
                    return;
                }
                if (e.key === 'y') {
                    e.preventDefault();
                    this.store.redo();
                    return;
                }
                if (e.key === 'c') {
                    const state = this.store.getState();
                    const selIds = state.selectedAnnotationIds;

                    if (selIds.length > 0) {
                        // 1. Copy selected
                        const selectedAnns = state.annotations.filter(a => selIds.includes(a.id));
                        if (selectedAnns.length > 0) {
                            this.clipboard = JSON.parse(JSON.stringify(selectedAnns));
                            console.log(`[Clipboard] Copied ${selectedAnns.length} selected annotations.`);
                        }
                    } else {
                        // 2. Copy all anchored on this frame
                        const frameAnns = state.annotations.filter(a => a.frame === state.currentFrame);
                        if (frameAnns.length > 0) {
                            this.clipboard = JSON.parse(JSON.stringify(frameAnns));
                            console.log(`[Clipboard] Copied ${frameAnns.length} annotations from frame ${state.currentFrame}.`);
                        }
                    }
                    return;
                }
                if (e.key === 'v') {
                    if (this.clipboard && this.clipboard.length > 0) {
                        const currentFrame = this.store.getState().currentFrame;
                        const addedIds: string[] = [];

                        this.clipboard.forEach(template => {
                            const newAnn = JSON.parse(JSON.stringify(template));
                            newAnn.id = crypto.randomUUID();
                            newAnn.frame = currentFrame;

                            // Apply offset if pasting on the SAME frame as original source
                            if (template.frame === currentFrame) {
                                if (newAnn.points) {
                                    newAnn.points = newAnn.points.map((p: any) => ({
                                        ...p,
                                        x: p.x + 0.02,
                                        y: p.y + 0.02
                                    }));
                                }
                            }

                            this.store.addAnnotation(newAnn);
                            addedIds.push(newAnn.id);
                        });

                        // Select the newly added ones
                        this.store.setState({ selectedAnnotationIds: addedIds });

                        this.store.captureSnapshot();
                        console.log(`[Clipboard] Pasted ${addedIds.length} annotations.`);
                    }
                    return;
                }
                // Navigation by Annotated Frames
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    this.player.seekToPrevAnnotation();
                    return;
                }
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    this.player.seekToNextAnnotation();
                    return;
                }
            }

            switch (e.key.toLowerCase()) {
                // Toggles & Selection
                case 'escape':
                    this.store.setState({ selectedAnnotationIds: [], activeTool: 'select' });
                    break;

                case 'delete':
                case 'backspace':
                    const selIds = this.store.getState().selectedAnnotationIds;
                    if (selIds.length > 0) {
                        selIds.forEach(id => this.store.deleteAnnotation(id));
                        this.store.setState({ selectedAnnotationIds: [] });
                        this.store.captureSnapshot();
                    }
                    break;

                // Playback
                case ' ': // Spacebar
                    e.preventDefault();
                    if (this.store.getState().isPlaying) {
                        this.player.pause();
                    } else {
                        this.player.play();
                    }
                    break;

                // Navigation (Frame by Frame)
                case 'arrowleft':
                    e.preventDefault();
                    this.player.seekToFrame(this.store.getState().currentFrame - 1);
                    break;
                case 'arrowright':
                    e.preventDefault();
                    this.player.seekToFrame(this.store.getState().currentFrame + 1);
                    break;

                // Tools
                case 's': this.store.setState({ activeTool: 'select' }); break;
                case 'p': this.store.setState({ activeTool: 'freehand', selectedAnnotationIds: [] }); break;
                case 'a': this.store.setState({ activeTool: 'arrow', selectedAnnotationIds: [] }); break;
                case 'c': this.store.setState({ activeTool: 'circle', selectedAnnotationIds: [] }); break;
                case 'q': this.store.setState({ activeTool: 'square', selectedAnnotationIds: [] }); break;
                case 't': this.store.setState({ activeTool: 'text', selectedAnnotationIds: [] }); break;
                case 'e': this.store.setState({ activeTool: 'eraser', selectedAnnotationIds: [] }); break;

                // Toggles
                case 'g':
                    const isCurrentlyEnabled = this.store.getState().isOnionSkinEnabled;

                    if (!isCurrentlyEnabled) {
                        // Turning ON: Enable ghosting, reset duration to 1
                        this.store.setState({ isOnionSkinEnabled: true, holdDuration: 1 });
                    } else {
                        // Turning OFF
                        this.store.setState({ isOnionSkinEnabled: false });
                    }
                    break;

                case 'h':
                    const currentDur = this.store.getState().holdDuration;
                    if (currentDur > 1) {
                        this.store.setState({ holdDuration: 1 });
                    } else {
                        // Default to 24 frames (Standard Hold), turn off ghosting
                        this.store.setState({ holdDuration: 24, isOnionSkinEnabled: false });
                    }
                    break;

                // View
                case 'r':
                    this.store.setState({ viewport: { x: 0, y: 0, scale: 1 } });
                    break;

                // Stroke Width
                case '=': // + without shift
                case '+':
                    const newWidthInc = Math.min(20, this.store.getState().activeStrokeWidth + 1);
                    this.store.setState({ activeStrokeWidth: newWidthInc });
                    break;
                case '-':
                case '_':
                    const newWidthDec = Math.max(1, this.store.getState().activeStrokeWidth - 1);
                    this.store.setState({ activeStrokeWidth: newWidthDec });
                    break;
            }
        });
    }

    private initSyncBinding() {
        // 1. Local (Store) -> Remote (Sync)
        this.store.on('annotation:added', (ann, fromRemote) => {
            if (fromRemote) return;
            if (ann.id.startsWith('temp_')) return; // Filter temp

            console.log(`[LinkSync DEBUG] Sending to Yjs: ${ann.id}, Dur: ${ann.duration}`);
            // Add to Yjs Map
            this.sync.annotationsMap.set(ann.id, ann);
        });

        this.store.on('annotation:updated', (id, updates, fromRemote) => {
            if (fromRemote) return;
            if (id.startsWith('temp_')) return; // Filter temp

            // Update Yjs Map entry
            const existing = this.sync.annotationsMap.get(id);
            if (existing) {
                this.sync.annotationsMap.set(id, { ...existing, ...updates });
            }
        });

        this.store.on('annotation:deleted', (id, fromRemote) => {
            if (fromRemote) return;
            if (id.startsWith('temp_')) return; // Filter temp
            this.sync.annotationsMap.delete(id);
        });

        // Session Params Sync (Onion Skin & Holding)
        this.store.on('state:changed', (newState, oldState) => {
            if (this.isRemoteSessionUpdate) return;

            // Onion Skin
            if (newState.isOnionSkinEnabled !== oldState.isOnionSkinEnabled ||
                newState.onionSkinPrevFrames !== oldState.onionSkinPrevFrames ||
                newState.onionSkinNextFrames !== oldState.onionSkinNextFrames) {

                this.sync.sessionMap.set('onionSkin', {
                    enabled: newState.isOnionSkinEnabled,
                    prev: newState.onionSkinPrevFrames,
                    next: newState.onionSkinNextFrames
                });
            }

            // Holding (View Mode) - Sync only if changed
            if (newState.holdDuration !== oldState.holdDuration) {
                this.sync.sessionMap.set('holdDuration', newState.holdDuration);
            }
        });

        // 2. Remote (Sync) -> Local (Store)
        this.sync.annotationsMap.observe((event) => {
            event.changes.keys.forEach((change, key) => {
                if (change.action === 'add') {
                    const ann = this.sync.annotationsMap.get(key);
                    if (ann && event.transaction.origin === this.sync) {
                        this.store.addAnnotation(ann, true);
                    }
                } else if (change.action === 'update') {
                    const ann = this.sync.annotationsMap.get(key);
                    if (ann && event.transaction.origin === this.sync) {
                        this.store.updateAnnotation(key, ann, true);
                    }
                } else if (change.action === 'delete') {
                    if (event.transaction.origin === this.sync) {
                        this.store.deleteAnnotation(key, true);
                    }
                }
            });
        });

        // Listen for Session Params
        this.sync.sessionMap.observe((event) => {
            if (event.transaction.origin === this.sync) {
                this.isRemoteSessionUpdate = true;

                // Onion Skin
                if (event.keysChanged.has('onionSkin')) {
                    const params = this.sync.sessionMap.get('onionSkin');
                    if (params) {
                        this.store.setState({
                            isOnionSkinEnabled: params.enabled,
                            onionSkinPrevFrames: params.prev,
                            onionSkinNextFrames: params.next
                        });
                    }
                }

                // Holding
                if (event.keysChanged.has('holdDuration')) {
                    const dur = this.sync.sessionMap.get('holdDuration');
                    if (typeof dur === 'number') {
                        this.store.setState({ holdDuration: dur });
                    }
                }

                // Reset mutex
                setTimeout(() => {
                    this.isRemoteSessionUpdate = false;
                }, 0);
            }
        });
        this.initPlaybackSync();
    }

    private initPlaybackSync() {
        this.sync.on('playback:change', (msg: any) => {
            this.isRemotePlayback = true;
            if (msg.action === 'play') {
                this.player.play();
            } else if (msg.action === 'pause') {
                this.player.pause();
                if (typeof msg.frame === 'number') {
                    this.player.seekToFrame(msg.frame);
                }
            } else if (msg.action === 'seek') {
                if (typeof msg.frame === 'number') {
                    this.player.seekToFrame(msg.frame);
                }
            }
            setTimeout(() => {
                this.isRemotePlayback = false;
            }, 50);
        });

        // 1.5 Sync Initial State on Connection (Host only)
        this.sync.on('connection:open', (peerId: string) => {
            if (this.sync.isHostUser) {
                const state = this.store.getState();
                const currentFrame = Math.round(state.currentTime * state.fps); // Use computed frame
                // Send current frame
                this.sync.sendPlaybackToPeer(peerId, 'seek', currentFrame);
                // Send play/pause state
                if (state.isPlaying) {
                    this.sync.sendPlaybackToPeer(peerId, 'play');
                } else {
                    this.sync.sendPlaybackToPeer(peerId, 'pause', currentFrame);
                }
            }
        });

        this.videoElement.addEventListener('play', () => {
            if (!this.isRemotePlayback) {
                this.sync.sendPlayback('play');
            }
        });

        this.videoElement.addEventListener('pause', () => {
            if (!this.isRemotePlayback) {
                const frame = this.store.getState().currentFrame;
                this.sync.sendPlayback('pause', frame);
            }
        });

        this.videoElement.addEventListener('seeked', () => {
            if (!this.isRemotePlayback) {
                const frame = this.store.getState().currentFrame;
                this.sync.sendPlayback('seek', frame);
            }
        });
    }

    private initResizeObserver() {
        // 1. Handle Video Metadata Load (for aspect ratio)
        this.videoElement.addEventListener('loadedmetadata', () => {
            this.fitCanvasToVideo();
        });

        // 2. Handle Container Resize
        const observer = new ResizeObserver(() => {
            this.fitCanvasToVideo();
        });
        observer.observe(this.container); // Observe container, not video element

        // Also observe video element just in case
        observer.observe(this.videoElement);
    }

    private fitCanvasToVideo() {
        if (!this.videoElement.videoWidth || !this.videoElement.videoHeight) return;

        const containerRect = this.container.getBoundingClientRect();
        const videoRatio = this.videoElement.videoWidth / this.videoElement.videoHeight;
        const containerRatio = containerRect.width / containerRect.height;

        let finalW, finalH, finalTop, finalLeft;

        if (containerRatio > videoRatio) {
            // Container is wider than video (Pillarbox)
            finalH = containerRect.height;
            finalW = finalH * videoRatio;
            finalTop = 0;
            finalLeft = (containerRect.width - finalW) / 2;
        } else {
            // Container is taller than video (Letterbox)
            finalW = containerRect.width;
            finalH = finalW / videoRatio;
            finalLeft = 0;
            finalTop = (containerRect.height - finalH) / 2;
        }

        // Apply to Canvas
        this.canvasElement.style.width = `${finalW}px`;
        this.canvasElement.style.height = `${finalH}px`;
        this.canvasElement.style.top = `${finalTop}px`;
        this.canvasElement.style.left = `${finalLeft}px`;

        // Critical: Set transform origin to account for the offset.
        // This ensures that when we scale (from 0,0 of the Container), the Canvas scales in sync.
        // The Canvas Origin (0,0) is at (finalLeft, finalTop) relative to Container.
        // So the Container Origin is at (-finalLeft, -finalTop) relative to Canvas.
        this.canvasElement.style.transformOrigin = `${-finalLeft}px ${-finalTop}px`;

        // Update Renderer Resolution
        // We set the internal canvas buffer size to match the Display size 1:1 for sharpness
        this.renderer.resize(finalW, finalH);
    }

    destroy() {
        // Cleanup...
        this.container.removeChild(this.videoElement);
        this.container.removeChild(this.canvasElement);
    }
}

export * from './Store';
export * from './Player';
export * from './LinkSync';
export * from './Renderer';
export * from './PluginManager';
