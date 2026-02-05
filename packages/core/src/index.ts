/*
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { Store, Annotation } from './Store';
// import { AppState } from './Store';
import { Player } from './Player';
import { LinkSync, Message } from './LinkSync';
import { Renderer } from './Renderer';
import { PluginManager } from './PluginManager';
import { InputManager, NormalizedPointerEvent } from './InputManager';
import { ToolRegistry } from './ToolRegistry';
import { CoreToolsPlugin } from './plugins/CoreToolsPlugin';
import { BaseTool } from './tools/BaseTool';
import JSZip from 'jszip';
import { MediaRegistry } from './MediaRegistry';
// import { MediaAdapter } from './adapters/MediaAdapter';

export class WebMediaAnnotator {
    public store: Store;
    public player: Player;
    public sync: LinkSync;
    public renderer: Renderer;
    public plugins: PluginManager;
    public registry: MediaRegistry;
    public toolRegistry: ToolRegistry; // [NEW] Registry
    public inputManager: InputManager | null = null;

    private canvasElement: HTMLCanvasElement;

    // DOM
    private container: HTMLElement;
    private mediaElement: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
    // Legacy support (getter)
    public get videoElement(): HTMLVideoElement {
        if (this.mediaElement instanceof HTMLVideoElement) return this.mediaElement;
        // Fallback or throw? For strict compat, maybe return a dummy or cast. 
        // But better to let it fail if used incorrectly in Image mode.
        return this.mediaElement as unknown as HTMLVideoElement;
    }

    // [NEW] Public Accessor for Plugins (e.g. EyeDropper)
    public get media(): HTMLVideoElement | HTMLImageElement | HTMLCanvasElement {
        return this.mediaElement;
    }

    // State for temporary tool switching
    private previousTool: string | null = null;
    private isRemotePlayback = false; // Mutex for playback sync
    private isRemoteSessionUpdate = false; // Mutex for session params sync
    private clipboard: Annotation[] = [];

    constructor(container: HTMLElement, options: {
        videoSrc?: string;
        fps?: number;
        startFrame?: number;
        preload?: 'auto' | 'metadata' | 'force-download'; // New Option
    } = {}) {
        this.container = container;
        this.container.style.position = 'relative'; // Ensure positioning context

        // 1. Initialize Registry
        this.registry = new MediaRegistry();
        this.toolRegistry = new ToolRegistry(this);

        // 2. Handle Initial Option
        if (options.videoSrc) {
            const src = options.videoSrc;
            const ext = src.split('.').pop()?.toLowerCase() || '';
            const complexFormats = ['mov', 'mkv', 'avi', 'wmv', 'flv', 'ts', 'mts', 'heic', 'psd'];

            const shouldForceDownload = options.preload === 'force-download' || complexFormats.includes(ext);

            if (shouldForceDownload) {
                // Create a placeholder
                this.mediaElement = document.createElement('video');
                this.mediaElement.style.display = 'none';
                this.container.appendChild(this.mediaElement);

                // Fetch and load
                console.log(`[Core] Loading media from URL (${src}). Mode: ${shouldForceDownload ? 'Force Download' : 'Native'}`);

                // Helper to fetch with progress (basic)
                const load = async () => {
                    try {
                        const response = await fetch(src);
                        if (!response.ok) throw new Error(`Failed to fetch ${src}: ${response.statusText}`);

                        // const contentLength = response.headers.get('content-length');
                        // const total = contentLength ? parseInt(contentLength, 10) : 0;
                        // let loaded = 0;

                        const reader = response.body?.getReader();
                        const chunks: Uint8Array[] = [];

                        if (reader) {
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                if (value) {
                                    chunks.push(value);
                                    // loaded += value.length;
                                    // Optional: Dispatch event for UI
                                    // if (total) console.log(`Loading: ${Math.round(loaded/total*100)}%`);
                                }
                            }
                        }

                        const blob = new Blob(chunks as unknown as BlobPart[], { type: response.headers.get('content-type') || 'video/mp4' });
                        const filename = src.split('/').pop() || `file.${ext}`;
                        const file = new File([blob], filename, { type: blob.type });
                        console.log(`[Core] Download complete (${file.size} bytes). Loading into pipeline...`);
                        await this.loadMedia(file);

                    } catch (err) {
                        console.error("[Core] Failed to load media from URL:", err);
                    }
                };
                load();

            } else {
                // Simple format: Use native video element
                this.mediaElement = document.createElement('video');
                const v = this.mediaElement as HTMLVideoElement;
                v.style.width = '100%';
                v.style.height = '100%';
                v.style.display = 'block';
                v.controls = false;
                v.disablePictureInPicture = true;
                v.crossOrigin = 'anonymous'; // Important for canvas capture
                v.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
                v.setAttribute('playsinline', 'true');
                v.src = src;
                this.container.appendChild(v);
            }
        } else {
            // Placeholder for now, or just don't attach. 
            // But Core needs element. 
            // Let's create a dummy video element to allow 'empty' init without crashing Player/Renderer
            this.mediaElement = document.createElement('video');
            this.mediaElement.style.display = 'none';
            this.container.appendChild(this.mediaElement);
        }

        // 2. Canvas Layer
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.style.position = 'absolute';
        this.canvasElement.style.top = '0';
        this.canvasElement.style.left = '0';
        this.canvasElement.style.width = '100%';
        this.canvasElement.style.height = '100%';
        this.canvasElement.style.pointerEvents = 'auto'; // allow interaction
        this.canvasElement.style.touchAction = 'none'; // CRITICAL: Prevent scrolling while drawing // Critical for Pointer Events handling
        this.container.appendChild(this.canvasElement);

        // 3. Initialize Core
        this.store = new Store({
            fps: options.fps || 24,
            startFrame: options.startFrame || 0
        });

        this.player = new Player(this.store, this.mediaElement);
        this.sync = new LinkSync();
        this.renderer = new Renderer(this.store, this.canvasElement, this.mediaElement);
        this.plugins = new PluginManager(this);



        // 4. Initialize Tools (Plugin Driven)
        this.plugins.register(CoreToolsPlugin);

        this.initInputManager();
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

    private initInputManager() {
        this.inputManager = new InputManager({
            canvas: this.canvasElement,
            store: this.store,
            callbacks: {
                onInteractionStart: (e: NormalizedPointerEvent) => {
                    const toolName = this.store.getState().activeTool;
                    const tool = this.toolRegistry.get(toolName);
                    if (tool) tool.onMouseDown(e.x, e.y, e.originalEvent);
                },
                onInteractionMove: (e: NormalizedPointerEvent) => {
                    const toolName = this.store.getState().activeTool;
                    const tool = this.toolRegistry.get(toolName);
                    if (tool) tool.onMouseMove(e.x, e.y, e.originalEvent);
                },
                onInteractionEnd: (e: NormalizedPointerEvent) => {
                    const toolName = this.store.getState().activeTool;
                    const tool = this.toolRegistry.get(toolName);
                    if (tool) tool.onMouseUp(e.x, e.y, e.originalEvent);
                },
                onPinchZoom: (scale: number) => {
                    const vp = this.store.getState().viewport;
                    this.store.setState({
                        viewport: { ...vp, scale }
                    });
                },
                onWheelZoom: (delta: number) => {
                    const zoomSpeed = 0.001;
                    const vp = this.store.getState().viewport;
                    const newScale = Math.min(Math.max(0.1, vp.scale + (-delta * zoomSpeed * vp.scale)), 5);
                    this.store.setState({
                        viewport: { ...vp, scale: newScale }
                    });
                },
                onMiddleMouseDown: (e: NormalizedPointerEvent) => {
                    this.previousTool = this.store.getState().activeTool;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    this.store.setState({ activeTool: 'pan' as any });
                    const panTool = this.toolRegistry.get('pan');
                    if (panTool) panTool.onMouseDown(e.x, e.y, e.originalEvent);
                },
                onMiddleMouseUp: (e: NormalizedPointerEvent) => {
                    const panTool = this.toolRegistry.get('pan');
                    if (panTool) panTool.onMouseUp(e.x, e.y, e.originalEvent);

                    if (this.previousTool) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        this.store.setState({ activeTool: this.previousTool as any });
                        this.previousTool = null;
                    }
                }
            }
        });
    }

    private initShortcuts() {
        // Shortcuts are now handled by the React layer (useHotkeys hook) or external consumers.
        // This method is deprecated and empty to prevent double-binding.
    }

    private initSyncBinding() {
        // 1. Local (Store) -> Remote (Sync)
        this.store.on('annotation:added', (ann, fromRemote) => {
            if (fromRemote) return;
            if (ann.id.startsWith('temp_')) return; // Filter temp

            console.log(`[LinkSync DEBUG] Sending to Yjs: ${ann.id}, Dur: ${ann.duration}`);
            // Strip fallbackPaths before sync (contains complex opentype.js objects that cause serialization issues)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { fallbackPaths, ...syncableAnn } = ann;
            this.sync.annotationsMap.set(ann.id, syncableAnn);
        });

        this.store.on('annotation:updated', (id, updates, fromRemote) => {
            if (fromRemote) return;
            if (id.startsWith('temp_')) return; // Filter temp

            // Update Yjs Map entry
            const existing = this.sync.annotationsMap.get(id);
            if (existing) {
                // Strip fallbackPaths before sync
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { fallbackPaths, ...syncableUpdates } = updates;
                this.sync.annotationsMap.set(id, { ...existing, ...syncableUpdates });
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
                        this.store.addAnnotation(ann as Annotation, true);
                    }
                } else if (change.action === 'update') {
                    const ann = this.sync.annotationsMap.get(key);
                    if (ann && event.transaction.origin === this.sync) {
                        this.store.updateAnnotation(key, ann as Annotation, true);
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
                    const params = this.sync.sessionMap.get('onionSkin') as { enabled: boolean, prev: number, next: number };
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
        this.sync.on('playback:change', (msg: Message) => {
            if (msg.type !== 'playback') return; // Type guard check
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

    private resizeObserver: ResizeObserver | null = null;

    private initResizeObserver() {
        // 2. Handle Container Resize
        this.resizeObserver = new ResizeObserver(() => {
            this.fitCanvasToVideo();
        });
        this.resizeObserver.observe(this.container);

        // Initial binding
        this.bindMediaListeners();
    }

    private bindMediaListeners() {
        if (!this.mediaElement) return;

        // 1. Handle Media Load (for aspect ratio)
        const onMediaLoad = () => {
            this.fitCanvasToVideo();
        };

        if (this.mediaElement instanceof HTMLVideoElement || this.mediaElement instanceof HTMLCanvasElement) {
            this.mediaElement.addEventListener('loadedmetadata', onMediaLoad);
            // Also check if already ready (for GifAdapter immediate load)
            const playable = this.mediaElement as unknown as { videoWidth: number, videoHeight: number };
            if (playable.videoWidth && playable.videoHeight) {
                onMediaLoad();
            }
        } else {
            this.mediaElement.addEventListener('load', onMediaLoad);
            // If already loaded
            if ((this.mediaElement as HTMLImageElement).complete) onMediaLoad();
        }

        // Observe media element
        if (this.resizeObserver) {
            this.resizeObserver.observe(this.mediaElement);
            // Verify: We don't necessarily need to unobserve the old one explicitly if it's garbage collected, 
            // but for correctness, strict cleanup would be better. 
            // However, ResizeObserver maps exact Element references.
        }
    }

    private fitCanvasToVideo() {
        let mediaW = 0;
        let mediaH = 0;

        if (this.mediaElement instanceof HTMLVideoElement) {
            mediaW = this.mediaElement.videoWidth;
            mediaH = this.mediaElement.videoHeight;
        } else if (this.mediaElement instanceof HTMLImageElement) {
            mediaW = this.mediaElement.naturalWidth;
            mediaH = this.mediaElement.naturalHeight;
        } else if (this.mediaElement instanceof HTMLCanvasElement) {
            // Check for video-like props (GifAdapter) or fall back to canvas dims
            mediaW = (this.mediaElement as unknown as { videoWidth: number }).videoWidth || this.mediaElement.width;
            mediaH = (this.mediaElement as unknown as { videoHeight: number }).videoHeight || this.mediaElement.height;
        }

        if (!mediaW || !mediaH) return;

        const containerRect = this.container.getBoundingClientRect();
        const videoRatio = mediaW / mediaH;
        const containerRatio = containerRect.width / containerRect.height;

        let finalW, finalH, finalTop, finalLeft;

        if (containerRatio > videoRatio) {
            // Container is wider than media (Pillarbox)
            finalH = containerRect.height;
            finalW = finalH * videoRatio;
            finalTop = 0;
            finalLeft = (containerRect.width - finalW) / 2;
        } else {
            // Container is taller than media (Letterbox)
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

    async exportAnnotatedFrames(composite: boolean, onProgress: (current: number, total: number) => void): Promise<Blob> {
        const state = this.store.getState();
        const annotatedFrames = Array.from(new Set(state.annotations.map(a => a.frame))).sort((a, b) => a - b);
        const total = annotatedFrames.length;

        if (total === 0) throw new Error("No annotations found to export");

        const zip = new JSZip();

        for (let i = 0; i < total; i++) {
            const frame = annotatedFrames[i];

            if (composite) {
                // Seek to frame
                const fps = state.fps;
                const time = frame / fps;

                await new Promise<void>((resolve) => {
                    const onSeeked = () => {
                        this.videoElement.removeEventListener('seeked', onSeeked);
                        resolve();
                    };
                    this.videoElement.addEventListener('seeked', onSeeked);
                    this.videoElement.currentTime = time;
                });
            }

            const dataUrl = await this.renderer.captureFrame({
                composite,
                frame,
                type: 'image/png'
            });

            // Strip header: data:image/png;base64,
            const base64Data = dataUrl.split(',')[1];
            zip.file(`frame_${frame.toString().padStart(5, '0')}.png`, base64Data, { base64: true });

            onProgress(i + 1, total);
        }

        // Generate final zip blob
        return await zip.generateAsync({ type: 'blob' });
    }

    async loadMedia(file: File, onProgress?: (progress: number) => void) {
        // 1. Get Adapter
        const adapter = await this.registry.getAdapter(file);

        // 2. Load Element
        const element = await adapter.load(file, onProgress);

        // 3. Update DOM
        if (this.mediaElement && this.mediaElement.parentNode) {
            this.mediaElement.parentNode.removeChild(this.mediaElement);
        }

        this.mediaElement = element;
        this.mediaElement.style.width = '100%';
        this.mediaElement.style.height = '100%';
        this.mediaElement.style.objectFit = 'contain'; // Maintain aspect ratio
        this.mediaElement.style.display = 'block';
        this.mediaElement.style.pointerEvents = 'none'; // Allow clicks to pass through to canvas
        this.mediaElement.style.userSelect = 'none';
        this.mediaElement.setAttribute('draggable', 'false');

        if (element instanceof HTMLVideoElement) {
            element.controls = false;
            element.disablePictureInPicture = true;
            element.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
            element.setAttribute('playsinline', 'true');
        }

        // Insert before canvas
        this.container.insertBefore(this.mediaElement, this.canvasElement);

        // 4. Update Core
        this.store.setState({ mediaType: adapter.type });
        this.player.setMediaElement(element);
        this.renderer.setMediaElement(element);

        // 5. Re-bind Listeners
        this.bindMediaListeners();
    }

    destroy() {
        // Cleanup InputManager
        if (this.inputManager) {
            this.inputManager.destroy();
            this.inputManager = null;
        }
        // Cleanup DOM
        if (this.mediaElement && this.mediaElement.parentNode) {
            this.mediaElement.parentNode.removeChild(this.mediaElement);
        }
        if (this.canvasElement && this.canvasElement.parentNode) {
            this.canvasElement.parentNode.removeChild(this.canvasElement);
        }
    }
}

export * from './Store';
export * from './Player';
export * from './LinkSync';
export * from './Renderer';
export * from './PluginManager';
export * from './MediaRegistry';
export * from './InputManager';
export * from './plugins/examples/PolyLinePlugin';
export * from './plugins/examples/PolyLineTool';
