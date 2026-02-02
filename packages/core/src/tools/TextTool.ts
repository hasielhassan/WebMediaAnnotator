import { BaseTool } from './BaseTool';
import { Annotation } from '../Store';
import { v4 as uuidv4 } from 'uuid';

export class TextTool extends BaseTool {
    private activeInput: HTMLTextAreaElement | null = null;
    private isEditing = false;
    private finishEditing: (() => void) | null = null;

    onMouseDown(x: number, y: number, e: MouseEvent | PointerEvent) {
        // If already editing, finish that first
        if (this.isEditing && this.finishEditing) {
            this.finishEditing();
            return;
        }

        this.isEditing = true;

        const container = (this.annotator as any)['container'] as HTMLElement;

        const input = document.createElement('textarea');
        input.style.position = 'absolute';
        input.style.left = `${x * 100}%`;
        input.style.top = `${y * 100}%`;
        input.style.width = '200px';
        input.style.minHeight = '50px';
        input.style.background = 'transparent';
        input.style.color = this.store.getState().activeColor;
        input.style.border = '2px dashed #rgba(255,255,255,0.5)';
        input.style.fontSize = `${this.store.getState().activeStrokeWidth * 5 + 10}px`; // Scale font with stroke width? Or separate setting
        input.style.fontFamily = 'Arial, sans-serif';
        input.style.zIndex = '100';
        input.style.padding = '0';
        input.style.margin = '0';
        input.style.outline = 'none';
        input.style.resize = 'both';
        input.placeholder = 'Type here...';

        container.appendChild(input);

        setTimeout(() => input.focus(), 0);

        this.activeInput = input;

        this.finishEditing = () => {
            if (!this.activeInput) return;
            const text = this.activeInput.value;
            const state = this.store.getState();

            if (text.trim()) {
                const newAnnotation: Annotation = {
                    id: uuidv4(),
                    frame: state.currentFrame,
                    duration: state.defaultDuration,
                    type: 'text',
                    points: [{ x, y }],
                    text: text,
                    style: {
                        color: state.activeColor,
                        width: 1,
                        fontSize: parseInt(input.style.fontSize) || 24
                    }
                };
                this.store.addAnnotation(newAnnotation);
                this.store.captureSnapshot();
            }

            if (input.parentNode) {
                input.parentNode.removeChild(input);
            }
            this.activeInput = null;
            this.isEditing = false;
            this.finishEditing = null;
        };

        // Commit on Blur
        input.addEventListener('blur', () => {
            // Use timeout to allow click events on toolbar to fire if they were the cause of blur
            setTimeout(() => {
                if (this.finishEditing) this.finishEditing();
            }, 200);
        });

        // Commit on Shift+Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                input.blur();
            }
            e.stopPropagation(); // Prevent annotator hotkeys
        });
    }

    onMouseMove(x: number, y: number, e: MouseEvent | PointerEvent) { }
    onMouseUp(x: number, y: number, e: MouseEvent | PointerEvent) { }
}
