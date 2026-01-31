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
            const rect = this.canvasElement.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            const toolName = this.store.getState().activeTool;
            const tool = this.tools.get(toolName);
            if (tool) tool.onMouseUp(x, y, e);
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
