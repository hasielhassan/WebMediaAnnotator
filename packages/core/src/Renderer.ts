import { Store, Annotation } from './Store';

export class Renderer {
    public canvas: HTMLCanvasElement;
    public ctx: CanvasRenderingContext2D;
    private store: Store;
    private mediaElement?: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

    constructor(store: Store, canvas: HTMLCanvasElement, mediaElement?: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) {
        this.store = store;
        this.canvas = canvas;
        this.mediaElement = mediaElement;
        const context = this.canvas.getContext('2d');
        if (!context) throw new Error('Could not get 2d context');
        this.ctx = context;

        this.initListeners();
    }

    setMediaElement(newElement: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) {
        this.mediaElement = newElement;
    }

    private initListeners() {
        this.store.on('state:changed', (newState, oldState) => {
            // Re-render if frame changed, annotations changed, or onion skin toggled
            if (
                newState.currentFrame !== oldState.currentFrame ||
                newState.annotations !== oldState.annotations ||
                newState.selectedAnnotationIds !== oldState.selectedAnnotationIds ||
                newState.isOnionSkinEnabled !== oldState.isOnionSkinEnabled ||
                newState.onionSkinPrevFrames !== oldState.onionSkinPrevFrames ||
                newState.holdDuration !== oldState.holdDuration ||
                newState.viewport !== oldState.viewport
            ) {
                this.render();
            }
        });
    }

    resize(width: number, height: number) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.render();
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    render() {
        this.clear();
        const state = this.store.getState();

        // 1. Sync Video Element Transform (CSS)
        const transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.scale})`;
        if (this.mediaElement) {
            this.mediaElement.style.transformOrigin = '0 0';
            this.mediaElement.style.transform = transform;
        }

        // 2. Sync Canvas Element Transform (CSS)
        // We transform the canvas DOM element itself, ensuring it aligns perfectly with the video.
        // NOTE: transformOrigin is managed by index.ts (fitCanvasToVideo) to match container offset.
        this.canvas.style.transform = transform;

        this.ctx.save();

        // NO context transform. We draw 0-1 mapped to canvas size.
        // This ensures the drawing is crisp and the CSS handles the scaling.

        // Onion Skin
        if (state.isOnionSkinEnabled) {
            const currentAnnotations = this.store.getAnnotationsForFrame(state.currentFrame);
            const currentIds = new Set(currentAnnotations.map(a => a.id));

            // PAST Frames (Red)
            for (let i = state.onionSkinPrevFrames; i > 0; i--) {
                const targetFrame = state.currentFrame - i;
                if (targetFrame >= 0) {
                    const prevAnnotations = this.store.getAnnotationsForFrame(targetFrame);
                    // Filter out annotations that are ALSO active on the current frame (held static)
                    const ghosts = prevAnnotations.filter(a => !currentIds.has(a.id));

                    if (ghosts.length > 0) {
                        // Opacity fades with distance
                        const opacity = 0.3 * (1 - (i / (state.onionSkinPrevFrames + 1)));
                        this.renderAnnotationsToContext(this.ctx, ghosts, this.canvas.width, this.canvas.height, {
                            globalAlpha: opacity,
                            colorOverride: '#ff0000'
                        });
                    }
                }
            }

            // FUTURE Frames (Green)
            const nextFrames = state.onionSkinNextFrames || 0;
            for (let i = nextFrames; i > 0; i--) {
                const targetFrame = state.currentFrame + i;
                const nextAnnotations = this.store.getAnnotationsForFrame(targetFrame);
                // Filter out annotations that are ALSO active on the current frame
                const ghosts = nextAnnotations.filter(a => !currentIds.has(a.id));

                if (ghosts.length > 0) {
                    const opacity = 0.3 * (1 - (i / (nextFrames + 1)));
                    this.renderAnnotationsToContext(this.ctx, ghosts, this.canvas.width, this.canvas.height, {
                        globalAlpha: opacity,
                        colorOverride: '#00ff00'
                    });
                }
            }
        }

        const annotations = this.store.getAnnotationsForFrame(state.currentFrame);
        this.renderAnnotationsToContext(this.ctx, annotations, this.canvas.width, this.canvas.height);

        // Render Selection
        if (state.selectedAnnotationIds.length > 0) {
            state.selectedAnnotationIds.forEach(id => {
                const selected = annotations.find(a => a.id === id);
                if (selected) this.renderSelection(selected, this.canvas.width, this.canvas.height);
            });
        }

        this.ctx.restore();
    }

    async captureFrame(options: {
        type?: 'image/png' | 'image/jpeg',
        quality?: number,
        composite?: boolean,
        mediaElement?: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
        frame?: number // Optional specific frame to capture
    } = {}): Promise<string> {
        const type = options.type || 'image/png';
        const quality = options.quality || 1.0;

        // Get Dimensions (prefer video intrinsic)
        const media = options.mediaElement || this.mediaElement;

        let width = this.canvas.width;
        let height = this.canvas.height;

        if (media) {
            if (media instanceof HTMLVideoElement) {
                width = media.videoWidth;
                height = media.videoHeight;
            } else if (media instanceof HTMLImageElement) {
                width = media.naturalWidth;
                height = media.naturalHeight;
            } else if (media instanceof HTMLCanvasElement) {
                // If it's a GifAdapter canvas, it might have videoWidth
                width = (media as any).videoWidth || media.width;
                height = (media as any).videoHeight || media.height;
            }
        }

        if (width === 0 || height === 0) {
            // Fallback or early exit during loading
            // If canvas is also 0, this is an error
            if (this.canvas.width === 0) throw new Error("Invalid output dimensions (0x0)");
            // otherwise stick to canvas dims if media isn't ready
        }

        // Create offscreen canvas at full resolution
        const offscreen = document.createElement('canvas');
        offscreen.width = width;
        offscreen.height = height;
        const ctx = offscreen.getContext('2d');
        if (!ctx) throw new Error('Could not create offscreen context');

        // Draw Video/Image if composite
        if (options.composite && media) {
            ctx.drawImage(media, 0, 0, width, height);
        }

        // Render Annotations to this new context
        const state = this.store.getState();
        const targetFrame = options.frame !== undefined ? options.frame : state.currentFrame;
        const currentAnnotations = this.store.getAnnotationsForFrame(targetFrame);

        this.renderAnnotationsToContext(ctx, currentAnnotations, width, height);

        return offscreen.toDataURL(type, quality);
    }

    // New Helper: Render to specific context (allows reusing for Export)
    private renderAnnotationsToContext(
        ctx: CanvasRenderingContext2D,
        annotations: Annotation[],
        width: number,
        height: number,
        options: { globalAlpha?: number; colorOverride?: string } = {}
    ) {
        ctx.save();
        if (options.globalAlpha) ctx.globalAlpha = options.globalAlpha;

        annotations.forEach(annotation => {
            ctx.strokeStyle = options.colorOverride || annotation.style.color;
            // Adaptive line width: Scale if output is much larger than standard
            // Standardizing roughly to 1080p reference? 
            // Or just trust annotation.style.width is relative? No it's pixels.
            const scaleFactor = width / this.canvas.width;
            ctx.lineWidth = Math.max(1, annotation.style.width * scaleFactor);

            ctx.fillStyle = options.colorOverride || annotation.style.fill || 'transparent';
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();

            if (annotation.type === 'freehand' && annotation.points) {
                if (annotation.points.length > 0) {
                    // Variable width rendering for freehand
                    // We draw segment by segment to adjust lineWidth
                    const points = annotation.points;

                    // First point
                    let p1 = points[0];
                    let radius1 = (annotation.style.width / 2) * scaleFactor * (p1.p !== undefined ? p1.p * 2 : 1);

                    for (let i = 1; i < points.length; i++) {
                        const p2 = points[i];
                        const radius2 = (annotation.style.width / 2) * scaleFactor * (p2.p !== undefined ? p2.p * 2 : 1);

                        const cx = (p1.x + p2.x) / 2 * width;
                        const cy = (p1.y + p2.y) / 2 * height;

                        // We use the average pressure for the segment or interpolation?
                        // Simple approach: each segment has its own width. 
                        // Better: trapezoids or many small lines.
                        // Standard canvas approach for variable width lines is complex.
                        // "Poor man's" variable width: draw lots of circles or short thick lines.

                        // Let's try drawing a line segment with the average width
                        ctx.beginPath();
                        ctx.lineWidth = (radius1 + radius2); // diameter approx
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.moveTo(p1.x * width, p1.y * height);
                        ctx.lineTo(p2.x * width, p2.y * height);
                        ctx.stroke();

                        // Advance
                        p1 = p2;
                        radius1 = radius2;
                    }
                }
            } else if (annotation.type === 'square' && annotation.points && annotation.points.length >= 2) {
                const p1 = annotation.points[0];
                const p2 = annotation.points[1];
                const x = Math.min(p1.x, p2.x) * width;
                const y = Math.min(p1.y, p2.y) * height;
                const w = Math.abs(p2.x - p1.x) * width;
                const h = Math.abs(p2.y - p1.y) * height;
                ctx.strokeRect(x, y, w, h);
            } else if (annotation.type === 'circle' && annotation.points && annotation.points.length >= 2) {
                const p1 = annotation.points[0];
                const p2 = annotation.points[1];
                const x = Math.min(p1.x, p2.x) * width;
                const y = Math.min(p1.y, p2.y) * height;
                const w = Math.abs(p2.x - p1.x) * width;
                const h = Math.abs(p2.y - p1.y) * height;
                ctx.beginPath();
                ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
            } else if (annotation.type === 'arrow' && annotation.points && annotation.points.length >= 2) {
                const x1 = annotation.points[0].x * width;
                const y1 = annotation.points[0].y * height;
                const x2 = annotation.points[1].x * width;
                const y2 = annotation.points[1].y * height;
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                // Head
                const angle = Math.atan2(y2 - y1, x2 - x1);
                const headLen = 15 * scaleFactor;
                ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(x2, y2);
                ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
            } else if (annotation.type === 'text' && annotation.points && annotation.text) {
                const fontSize = (annotation.style.fontSize || 24) * scaleFactor;
                ctx.font = `${fontSize}px Arial`;
                ctx.fillStyle = ctx.strokeStyle;
                ctx.fillText(annotation.text, annotation.points[0].x * width, annotation.points[0].y * height);
            }

            ctx.stroke();
        });
        ctx.restore();
    }

    private renderSelection(ann: Annotation, width: number, height: number) {
        if (!ann.points) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        ann.points.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });

        const PADDING = 10 / width;
        minX -= PADDING; minY -= PADDING; maxX += PADDING; maxY += PADDING;

        this.ctx.save();
        this.ctx.strokeStyle = '#00AAFF';
        this.ctx.lineWidth = 2; // Fixed Selection width
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(minX * width, minY * height, (maxX - minX) * width, (maxY - minY) * height);
        this.ctx.restore();
    }
}
