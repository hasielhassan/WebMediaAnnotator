import React from 'react';
import { WebMediaAnnotator, AppState } from '@web-media-annotator/core';

export interface AnnotatorCanvasProps {
    annotator: WebMediaAnnotator | null;
    state: AppState | null;
}

export const AnnotatorCanvas = React.forwardRef<HTMLDivElement, AnnotatorCanvasProps>(({ annotator, state }, ref) => {

    const handleWheel = (e: React.WheelEvent) => {
        if (!state || !annotator) return;

        const scaleFactor = 1.1;
        const direction = e.deltaY > 0 ? -1 : 1;
        let newScale = state.viewport.scale * (direction > 0 ? scaleFactor : 1 / scaleFactor);
        newScale = Math.max(0.1, Math.min(newScale, 10)); // Clamp

        // Check if ref is assigned and is an Element
        const container = (ref as React.RefObject<HTMLDivElement>)?.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate new position to keep mouse centered
        // (x - mouseX) * scaleDiff + x
        // Simplified: 
        // 1. Get world coordinate of mouse: (mouseX - vx) / scale
        // 2. Set new scale
        // 3. Set new vx such that world coordinate maps to mouseX again

        const worldX = (mouseX - state.viewport.x) / state.viewport.scale;
        const worldY = (mouseY - state.viewport.y) / state.viewport.scale;

        const newX = mouseX - worldX * newScale;
        const newY = mouseY - worldY * newScale;

        annotator.store.setState({
            viewport: {
                x: newX,
                y: newY,
                scale: newScale
            }
        });
    };

    return (
        <div className="flex-1 flex flex-row overflow-hidden relative">
            <div className="flex-1 relative bg-gray-950 overflow-hidden flex items-center justify-center">
                <div
                    ref={ref}
                    className="relative w-full h-full max-h-full"
                    style={{ aspectRatio: '16/9' }}
                    onWheel={handleWheel}
                />
            </div>
        </div>
    );
});
