import { BaseTool } from './BaseTool';
import { Annotation } from '../Store';
import { v4 as uuidv4 } from 'uuid';
import opentype from 'opentype.js';

export class TextTool extends BaseTool {
    private activeInput: HTMLTextAreaElement | null = null;
    private isEditing = false;
    private isDragging = false;
    private startPoint: { x: number; y: number } | null = null;
    private currentPoint: { x: number; y: number } | null = null;
    private finishEditing: (() => Promise<void>) | null = null;
    private font: opentype.Font | null = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(annotator: any) {
        super(annotator);
        this.loadFont();
    }

    private async loadFont() {
        try {
            // Fetch as ArrayBuffer to avoid signature errors with opentype.load URL handling
            const response = await fetch('fonts/Roboto-Regular.ttf');
            if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
            const buffer = await response.arrayBuffer();

            this.font = opentype.parse(buffer);
            console.log('[TextTool] Font loaded successfully');
        } catch (e) {
            console.warn('[TextTool] Font load error', e);
        }
    }

    onMouseDown(x: number, y: number, _e: MouseEvent | PointerEvent) {
        // If already editing, finish that first
        if (this.isEditing && this.finishEditing) {
            this.finishEditing();
            return;
        }

        // 1. Hit Test for Edit Mode
        const hitId = this.hitTestText(x, y);
        if (hitId) {
            this.startEditing(hitId);
            return;
        }

        // 2. Start Drag for New Box
        this.isDragging = true;
        this.startPoint = { x, y };
        this.currentPoint = { x, y };

        // Initial feedback
        this.createTempBox(x, y, x, y);
    }

    onMouseMove(x: number, y: number, _e: MouseEvent | PointerEvent) {
        if (!this.isDragging || !this.startPoint) return;
        this.currentPoint = { x, y };
        this.createTempBox(this.startPoint.x, this.startPoint.y, x, y);
    }

    onMouseUp(x: number, y: number, _e: MouseEvent | PointerEvent) {
        if (!this.isDragging || !this.startPoint) return;
        this.isDragging = false;

        // Finalize Box
        const p1 = this.startPoint;
        const p2 = { x, y };

        // If drag is too small, default to a standard box size
        const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        if (dist < 0.01) {
            // Click-like behavior: default box
            p2.x = p1.x + 0.2; // 20% width
            p2.y = p1.y + 0.1; // 10% height
        }

        this.store.deleteAnnotation('temp_text_box');
        this.openInput(p1, p2);
    }

    private createTempBox(x1: number, y1: number, x2: number, y2: number) {
        const state = this.store.getState();
        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);
        const maxX = Math.max(x1, x2);
        const maxY = Math.max(y1, y2);

        // Visualize with a square annotation
        this.store.updateAnnotation('temp_text_box', {
            id: 'temp_text_box',
            frame: state.currentFrame,
            type: 'square',
            points: [{ x: minX, y: minY }, { x: maxX, y: maxY }],
            style: {
                color: state.activeColor,
                width: 1,
            }
        }, false);

        const exists = state.annotations.some(a => a.id === 'temp_text_box');
        if (!exists) {
            this.store.addAnnotation({
                id: 'temp_text_box',
                frame: state.currentFrame,
                type: 'square',
                points: [{ x: minX, y: minY }, { x: maxX, y: maxY }],
                style: { color: state.activeColor, width: 1 }
            });
        }
    }

    private openInput(p1: { x: number, y: number }, p2: { x: number, y: number }, existingId?: string, initialText: string = '') {
        this.isEditing = true;
        const container = (this.annotator as unknown as { container: HTMLElement }).container;
        const state = this.store.getState();
        const canvas = (this.annotator as unknown as { renderer: { canvas: HTMLCanvasElement } }).renderer.canvas; // Access internal canvas

        // 1. Project Image Coords (0..1) -> Canvas Pixels -> Screen Pixels relative to Container
        const canvasRect = canvas.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();

        const imgX = Math.min(p1.x, p2.x);
        const imgY = Math.min(p1.y, p2.y);
        const imgW = Math.abs(p2.x - p1.x);
        const imgH = Math.abs(p2.y - p1.y);

        // Visual position relative to Container
        const x = (canvasRect.left + imgX * canvasRect.width) - contRect.left;
        const y = (canvasRect.top + imgY * canvasRect.height) - contRect.top;
        const w = imgW * canvasRect.width;
        const h = imgH * canvasRect.height;

        const input = document.createElement('textarea');
        input.style.position = 'absolute';
        input.style.left = `${x}px`;
        input.style.top = `${y}px`;
        input.style.width = `${w}px`;
        input.style.height = `${h}px`;
        input.style.background = 'rgba(0, 0, 0, 0.2)'; // Slight bg to see box
        input.style.color = state.activeColor;
        input.style.border = '1px dashed rgba(255,255,255,0.5)';

        // Calculate font size relative to height or fixed?
        const fontSize = 24;
        input.style.fontSize = `${fontSize}px`;
        input.style.fontFamily = 'Arial, sans-serif';
        input.style.zIndex = '100';
        input.style.padding = '0px';
        input.style.lineHeight = '1.2'; // Match likely renderer line-height
        input.style.outline = 'none';
        input.style.resize = 'both'; // Allow resizing the box

        input.value = initialText || '';
        input.placeholder = 'Type text...';

        container.appendChild(input);
        setTimeout(() => input.focus(), 0);
        this.activeInput = input;

        // Hide the underlying annotation while editing
        if (existingId) {
            this.annotator.renderer.render(existingId);
        }

        this.finishEditing = async () => {
            if (!this.activeInput) return;
            const text = this.activeInput.value;
            const canvas = (this.annotator as unknown as { renderer: { canvas: HTMLCanvasElement } }).renderer.canvas; // Re-access

            // Capture final geometry (in case user resized)
            const inputRect = this.activeInput.getBoundingClientRect();
            // We need updated canvas rect in case viewport changed (unlikely during edit but possible)
            const currentCanvasRect = canvas.getBoundingClientRect();

            console.log(`[TextTool] Finalize Box: InputRect: ${inputRect.left},${inputRect.top} wh:${inputRect.width}x${inputRect.height}`);
            console.log(`[TextTool] CanvasRect: ${currentCanvasRect.left},${currentCanvasRect.top} wh:${currentCanvasRect.width}x${currentCanvasRect.height}`);

            // Unproject Screen Pixels back to Image Coordinates (0..1)
            const finalX = (inputRect.left - currentCanvasRect.left) / currentCanvasRect.width;
            const finalY = (inputRect.top - currentCanvasRect.top) / currentCanvasRect.height;
            const finalW = inputRect.width / currentCanvasRect.width;
            const finalH = inputRect.height / currentCanvasRect.height;

            // Normalize font size relative to canvas height (same reference as coordinates)
            // This ensures font scales consistently regardless of viewport zoom
            const normalizedFontSize = fontSize / currentCanvasRect.height;
            console.log(`[TextTool] Normalized: ${finalX},${finalY} ${finalW}x${finalH}`);
            console.log(`[TextTool] NormalizedFontSize: ${normalizedFontSize} (ratio to height)`);

            if (text.trim()) {
                const id = existingId || uuidv4();

                // Generate Vectors
                let fallbackPaths = undefined;
                if (this.font) {
                    try {
                        // const words = text.split(' '); // Unused
                        const path = this.font.getPath(text, 0, fontSize, fontSize);
                        // Store the command list directly or simplified
                        fallbackPaths = path.commands;
                    } catch (err) {
                        console.warn('Vector gen failed', err);
                    }
                }

                const newAnnotation: Annotation = {
                    id: id,
                    frame: state.currentFrame,
                    duration: state.defaultDuration,
                    type: 'text',
                    points: [
                        { x: finalX, y: finalY },
                        { x: finalX + finalW, y: finalY + finalH }
                    ],
                    text: text,
                    fallbackPaths: fallbackPaths,
                    style: {
                        color: state.activeColor,
                        width: 1, // Stroke width
                        fontSize: normalizedFontSize // Store normalized (ratio to height)
                    }
                };

                if (existingId) {
                    this.store.updateAnnotation(existingId, newAnnotation);
                } else {
                    this.store.addAnnotation(newAnnotation);
                }
                this.store.captureSnapshot();
            } else {
                // Empty text, delete if existing
                if (existingId) {
                    this.store.deleteAnnotation(existingId);
                }
            }

            if (input.parentNode) {
                input.parentNode.removeChild(input);
            }
            this.activeInput = null;
            this.isEditing = false;
            this.finishEditing = null;
            this.store.deleteAnnotation('temp_text_box');

            // Restore visibility (re-render all)
            this.annotator.renderer.render();
        };

        // Commit handlers
        input.addEventListener('blur', () => {
            // Delay to allow other clicks
            setTimeout(() => {
                if (this.activeInput === input && this.finishEditing) {
                    this.finishEditing();
                }
            }, 200);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) { // Ctrl+Enter to submit
                e.preventDefault();
                input.blur();
            }
            e.stopPropagation();
        });
    }

    private hitTestText(x: number, y: number): string | null {
        const frame = this.store.getState().currentFrame;
        const annotations = this.store.getAnnotationsForFrame(frame);

        // Check text annotations
        for (let i = annotations.length - 1; i >= 0; i--) {
            const ann = annotations[i];
            if (ann.type === 'text' && ann.points && ann.points.length >= 2) {
                const p1 = ann.points[0];
                const p2 = ann.points[1];
                const minX = Math.min(p1.x, p2.x);
                const maxX = Math.max(p1.x, p2.x);
                const minY = Math.min(p1.y, p2.y);
                const maxY = Math.max(p1.y, p2.y);

                if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                    return ann.id;
                }
            }
        }
        return null;
    }

    private startEditing(id: string) {
        const ann = this.store.getState().annotations.find(a => a.id === id);
        if (!ann || ann.type !== 'text' || !ann.points) return;

        this.openInput(ann.points[0], ann.points[1], id, ann.text);
    }
}
