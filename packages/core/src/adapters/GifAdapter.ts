import { MediaAdapter } from './MediaAdapter';
import { parseGIF, decompressFrames } from 'gifuct-js';

// Extend HTMLCanvasElement interface to include video-like properties
export interface GifCanvasElement extends HTMLCanvasElement {
    play(): void;
    pause(): void;
    currentTime: number;
    duration: number;
    videoWidth: number;
    videoHeight: number;
    paused: boolean;
    volume: number;
    muted: boolean;
}

export class GifAdapter implements MediaAdapter {
    id = 'gif';
    type: 'video' | 'image' = 'video'; // GIFs are treated as video for annotation

    async canHandle(file: File): Promise<boolean> {
        const ext = file.name.split('.').pop()?.toLowerCase();
        return file.type === 'image/gif' || ext === 'gif';
    }

    async load(file: File, onProgress?: (progress: number) => void): Promise<GifCanvasElement> {
        // 1. Load ArrayBuffer
        const buffer = await file.arrayBuffer();

        // 2. Parse GIF
        // @ts-ignore
        const gif = parseGIF(buffer);
        // @ts-ignore
        const frames = decompressFrames(gif, true); // buildImagePatches = true

        if (!frames || frames.length === 0) {
            throw new Error("Failed to parse GIF frames");
        }

        // 3. Create Canvas
        const canvas = document.createElement('canvas') as unknown as GifCanvasElement;
        const width = frames[0].dims.width;
        const height = frames[0].dims.height;

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) throw new Error("Failed to create canvas context");

        // 4. Setup Playback State
        let currentFrameIndex = 0;
        let isPlaying = false;
        let startTime = 0;
        let lastFrameTime = 0;
        let animationFrameId: number | null = null;

        // Calculate total duration (in seconds)
        const totalDurationMs = frames.reduce((acc: number, frame: any) => acc + (frame.delay || 100), 0);
        const duration = totalDurationMs / 1000;

        // Pre-render frames to ImageBitmaps for performance? 
        // Or just draw ImageData. drawImage with ImageData is slow.
        // Let's create an offscreen canvas for each frame or use createImageBitmap.

        const frameBitmaps: ImageBitmap[] = [];

        // Create temp canvas for converting ImageData to ImageBitmap
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

        // Generate patches
        // gifuct-js returns patches. We need to composite them if they are partial.
        // But we passed buildImagePatches=true. 
        // Wait, decompressFrames returns "ParsedFrame[]".
        // Each frame has `patch` properties. 
        // If disposalType is 2 (restore to background) or 3 (restore to previous), we need to handle that.
        // For simplicity, let's assume full frames or basic composition. 
        // Actually, strictly rendering GIFs correctly is hard.
        // Providing a basic frame-by-frame view is the goal.

        // Let's implement basic full-frame rendering.
        // We'll iterate and apply patches to a "canvas buffer" and save snapshots.

        if (tempCtx) {
            let frameCanvas = document.createElement('canvas');
            frameCanvas.width = width;
            frameCanvas.height = height;
            let frameCtx = frameCanvas.getContext('2d');

            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                if (!frameCtx) break;

                // Draw patch
                const dims = frame.dims;
                const patch = new ImageData(
                    new Uint8ClampedArray(frame.patch),
                    dims.width,
                    dims.height
                );

                tempCanvas.width = dims.width;
                tempCanvas.height = dims.height;
                tempCtx!.putImageData(patch, 0, 0);

                // Draw to composition canvas
                frameCtx.drawImage(tempCanvas, dims.left, dims.top);

                // Save Snapshot
                // We use createImageBitmap for efficiency
                // clone the current state of frameCanvas
                const bitmap = await createImageBitmap(frameCanvas);
                frameBitmaps.push(bitmap);

                // Disposal handling (simplistic)
                // 2 = Restore to background (clear)
                if (frame.disposalType === 2) {
                    frameCtx.clearRect(dims.left, dims.top, dims.width, dims.height);
                }
                // 3 = Restore to previous (save-restore state) - ignoring for MVP
            }
        }

        // 5. Implement Video Interface

        // Properties
        Object.defineProperty(canvas, 'videoWidth', { get: () => width });
        Object.defineProperty(canvas, 'videoHeight', { get: () => height });
        Object.defineProperty(canvas, 'duration', { get: () => duration });
        Object.defineProperty(canvas, 'volume', { value: 0, writable: true });
        Object.defineProperty(canvas, 'muted', { value: true, writable: true });

        Object.defineProperty(canvas, 'currentTime', {
            get: () => {
                // Return time based on current frame index
                // Note: Variable frame delays make "time -> frame" mapping complex.
                // We will approximate or calculate exactly.
                let t = 0;
                for (let i = 0; i < currentFrameIndex; i++) {
                    t += (frames[i].delay || 100);
                }
                return t / 1000;
            },
            set: (time: number) => {
                // Seek logic
                let t = 0;
                for (let i = 0; i < frames.length; i++) {
                    const d = (frames[i].delay || 100) / 1000;
                    if (time < t + d) {
                        renderFrame(i);
                        return;
                    }
                    t += d;
                }
                // Cap at end
                renderFrame(frames.length - 1);
            }
        });

        Object.defineProperty(canvas, 'paused', { get: () => !isPlaying });

        const renderFrame = (index: number) => {
            if (index < 0) index = 0;
            if (index >= frameBitmaps.length) index = frameBitmaps.length - 1;

            currentFrameIndex = index;
            if (frameBitmaps[index] && ctx) {
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(frameBitmaps[index], 0, 0);
            }

            // Emit timeupdate
            canvas.dispatchEvent(new Event('timeupdate'));
        };

        const loop = () => {
            if (!isPlaying) return;

            const now = performance.now();
            const elapsed = now - lastFrameTime;
            const currentDelay = frames[currentFrameIndex].delay || 100;

            if (elapsed >= currentDelay) {
                // Next frame
                let next = currentFrameIndex + 1;
                if (next >= frames.length) next = 0; // Loop

                renderFrame(next);
                lastFrameTime = now;
            }

            animationFrameId = requestAnimationFrame(loop);
        };

        // Methods
        canvas.play = () => {
            if (isPlaying) return;
            isPlaying = true;
            lastFrameTime = performance.now();
            loop();
            canvas.dispatchEvent(new Event('play'));
        };

        canvas.pause = () => {
            isPlaying = false;
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            canvas.dispatchEvent(new Event('pause'));
        };

        // Initial Render
        renderFrame(0);

        // Dispatch metadata loaded immediately (next tick)
        setTimeout(() => {
            canvas.dispatchEvent(new Event('loadedmetadata'));
            canvas.dispatchEvent(new Event('canplay'));
        }, 0);

        return canvas;
    }
}
