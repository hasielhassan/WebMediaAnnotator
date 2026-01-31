import { Store, AppState } from './Store';
import { Player } from './Player';
import { SyncManager } from './SyncManager';
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
    public sync: SyncManager;
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
        this.container.appendChild(this.canvasElement);

        // 3. Initialize Core
        this.store = new Store({
            fps: options.fps || 24,
            startFrame: options.startFrame || 0
        });

        this.player = new Player(this.store, this.videoElement);
        this.sync = new SyncManager(this.store, this.player);
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
    }

    private initInteraction() {
        // Simple Interaction Dispatcher
        const getXY = (e: MouseEvent) => {
            const rect = this.canvasElement.getBoundingClientRect();
            // With CSS Transforms, getBoundingClientRect returns the VISUAL position/size.
            // e.clientX is also visual.
            // So (x - left) is the pixel offset inside the visual box.
            // Dividing by rect.width gives the 0-1 normalized position relative to the SCALED content.
            // This is exactly what we want for 0-1 storage.
            return {
                x: (e.clientX - rect.left) / rect.width,
                y: (e.clientY - rect.top) / rect.height
            };
        };

        this.canvasElement.addEventListener('mousedown', (e) => {
            // Middle Mouse (Button 1) -> Temporary Pan
            if (e.button === 1) {
                e.preventDefault();
                this.previousTool = this.store.getState().activeTool;
                this.store.setState({ activeTool: 'pan' });
                // We also trigger onMouseDown for the Pan tool immediately so it starts dragging
                const { x, y } = getXY(e);
                const panTool = this.tools.get('pan');
                if (panTool) panTool.onMouseDown(x, y, e);
                return;
            }

            const { x, y } = getXY(e);
            const toolName = this.store.getState().activeTool;
            const tool = this.tools.get(toolName);
            if (tool) tool.onMouseDown(x, y, e);
        });

        window.addEventListener('mousemove', (e) => {
            // Window listener for drag outside
            const rect = this.canvasElement.getBoundingClientRect();
            // Recalculate x/y for the window event
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;

            const toolName = this.store.getState().activeTool;
            const tool = this.tools.get(toolName);
            if (tool) tool.onMouseMove(x, y, e);
        });

        window.addEventListener('mouseup', (e) => {
            // Middle Mouse Up -> Revert Tool
            if (e.button === 1 && this.previousTool) {
                const panTool = this.tools.get('pan');
                // Finish pan drag
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
                case 'p': this.store.setState({ activeTool: 'freehand' }); break;
                case 'a': this.store.setState({ activeTool: 'arrow' }); break;
                case 'c': this.store.setState({ activeTool: 'circle' }); break;
                case 'q': this.store.setState({ activeTool: 'square' }); break;
                case 't': this.store.setState({ activeTool: 'text' }); break;
                case 'e': this.store.setState({ activeTool: 'eraser' }); break;

                // Toggles
                case 'g':
                    const isCurrentlyEnabled = this.store.getState().isOnionSkinEnabled;

                    if (!isCurrentlyEnabled) {
                        // Turning ON: Enable ghosting, reset duration to 1
                        this.store.setState({ isOnionSkinEnabled: true, activeDuration: 1 });
                    } else {
                        // Turning OFF
                        this.store.setState({ isOnionSkinEnabled: false });
                    }
                    break;

                case 'h':
                    const currentDur = this.store.getState().activeDuration;
                    if (currentDur > 1) {
                        this.store.setState({ activeDuration: 1 });
                    } else {
                        // Default to 3 frames, turn off ghosting
                        this.store.setState({ activeDuration: 3, isOnionSkinEnabled: false });
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
export * from './SyncManager';
export * from './Renderer';
export * from './PluginManager';
