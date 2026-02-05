/*
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Store } from './Store';

/**
 * Normalized pointer event with coordinates in 0-1 space relative to the canvas.
 */
export interface NormalizedPointerEvent {
    /** X coordinate normalized to 0-1 range */
    x: number;
    /** Y coordinate normalized to 0-1 range */
    y: number;
    /** Pressure from 0-1, defaults to 0.5 for mouse */
    pressure: number;
    /** Unique pointer ID for multi-touch */
    pointerId: number;
    /** Mouse button (0=left, 1=middle, 2=right) */
    button: number;
    /** Original browser event */
    originalEvent: PointerEvent;
}

export interface InputManagerCallbacks {
    /** Called when a pointer goes down (drawing start) */
    onInteractionStart: (e: NormalizedPointerEvent) => void;
    /** Called during pointer movement */
    onInteractionMove: (e: NormalizedPointerEvent) => void;
    /** Called when pointer is released (drawing end) */
    onInteractionEnd: (e: NormalizedPointerEvent) => void;
    /** Called during pinch gesture with scale factor */
    onPinchZoom: (scale: number) => void;
    /** Called on wheel scroll with delta and position */
    onWheelZoom: (delta: number, x: number, y: number) => void;
    /** Called when middle-mouse pan starts */
    onMiddleMouseDown?: (e: NormalizedPointerEvent) => void;
    /** Called when middle-mouse pan ends */
    onMiddleMouseUp?: (e: NormalizedPointerEvent) => void;
}

export interface InputManagerOptions {
    canvas: HTMLCanvasElement;
    store: Store;
    callbacks: InputManagerCallbacks;
}

/**
 * InputManager handles all pointer, touch, and wheel input for the annotation canvas.
 * It normalizes events and dispatches them through callbacks for tool handling.
 */
export class InputManager {
    private canvas: HTMLCanvasElement;
    private store: Store;
    private callbacks: InputManagerCallbacks;

    // Multi-touch state
    private activePointers = new Map<number, PointerEvent>();
    private initialPinchDist: number | null = null;
    private initialScale = 1;

    // Bound handlers for cleanup
    private boundPointerDown: (e: PointerEvent) => void;
    private boundPointerMove: (e: PointerEvent) => void;
    private boundPointerUp: (e: PointerEvent) => void;
    private boundWheel: (e: WheelEvent) => void;

    constructor(options: InputManagerOptions) {
        this.canvas = options.canvas;
        this.store = options.store;
        this.callbacks = options.callbacks;

        // Bind handlers
        this.boundPointerDown = this.handlePointerDown.bind(this);
        this.boundPointerMove = this.handlePointerMove.bind(this);
        this.boundPointerUp = this.handlePointerUp.bind(this);
        this.boundWheel = this.handleWheel.bind(this);

        // Attach listeners
        this.canvas.addEventListener('pointerdown', this.boundPointerDown);
        window.addEventListener('pointermove', this.boundPointerMove);
        window.addEventListener('pointerup', this.boundPointerUp);
        this.canvas.addEventListener('wheel', this.boundWheel, { passive: false });
    }

    /**
     * Clean up all event listeners.
     */
    destroy(): void {
        this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
        window.removeEventListener('pointermove', this.boundPointerMove);
        window.removeEventListener('pointerup', this.boundPointerUp);
        this.canvas.removeEventListener('wheel', this.boundWheel);
        this.activePointers.clear();
    }

    /**
     * Calculate distance between two pointer events (for pinch detection).
     */
    private getDistance(p1: PointerEvent, p2: PointerEvent): number {
        return Math.sqrt(
            Math.pow(p1.clientX - p2.clientX, 2) +
            Math.pow(p1.clientY - p2.clientY, 2)
        );
    }

    /**
     * Normalize a pointer event to 0-1 canvas coordinates.
     */
    private normalizeEvent(e: PointerEvent): NormalizedPointerEvent {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height,
            pressure: e.pressure > 0 ? e.pressure : 0.5,
            pointerId: e.pointerId,
            button: e.button,
            originalEvent: e
        };
    }

    private handlePointerDown(e: PointerEvent): void {
        this.activePointers.set(e.pointerId, e);
        this.canvas.setPointerCapture(e.pointerId);

        // Two-finger pinch start
        if (this.activePointers.size === 2) {
            const points = Array.from(this.activePointers.values());
            this.initialPinchDist = this.getDistance(points[0], points[1]);
            this.initialScale = this.store.getState().viewport.scale;
            return;
        }

        const normalized = this.normalizeEvent(e);

        // Middle mouse button -> temporary pan
        if (e.button === 1) {
            e.preventDefault();
            this.callbacks.onMiddleMouseDown?.(normalized);
            return;
        }

        // Single pointer down
        if (this.activePointers.size === 1) {
            this.callbacks.onInteractionStart(normalized);
        }
    }

    private handlePointerMove(e: PointerEvent): void {
        // Update pointer record if tracking
        if (this.activePointers.has(e.pointerId)) {
            this.activePointers.set(e.pointerId, e);
        }

        // Pinch zoom logic
        if (this.activePointers.size === 2 && this.initialPinchDist) {
            const points = Array.from(this.activePointers.values());
            const dist = this.getDistance(points[0], points[1]);
            const scaleFactor = dist / this.initialPinchDist;
            const newScale = Math.min(Math.max(0.1, this.initialScale * scaleFactor), 5);
            this.callbacks.onPinchZoom(newScale);
            return;
        }

        // Standard move
        const normalized = this.normalizeEvent(e);
        this.callbacks.onInteractionMove(normalized);
    }

    private handlePointerUp(e: PointerEvent): void {
        this.activePointers.delete(e.pointerId);
        this.canvas.releasePointerCapture(e.pointerId);

        if (this.activePointers.size < 2) {
            this.initialPinchDist = null;
        }

        const normalized = this.normalizeEvent(e);

        // Middle mouse up
        if (e.button === 1) {
            this.callbacks.onMiddleMouseUp?.(normalized);
            return;
        }

        this.callbacks.onInteractionEnd(normalized);
    }

    private handleWheel(e: WheelEvent): void {
        if (e.ctrlKey) {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            this.callbacks.onWheelZoom(e.deltaY, x, y);
        }
    }
}
