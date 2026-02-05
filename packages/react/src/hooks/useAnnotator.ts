/*
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { useEffect, useState, useRef, RefObject } from 'react';
import { WebMediaAnnotator } from '@web-media-annotator/core';
import type { AppState } from '@web-media-annotator/core';

export interface UseAnnotatorOptions {
    containerRef: RefObject<HTMLDivElement | null>;
    src: string;
    fps?: number;
    startFrame?: number;
    preload?: 'auto' | 'metadata' | 'force-download';
}

export interface UseAnnotatorResult {
    instance: WebMediaAnnotator | null;
    state: AppState | null;
    ready: boolean;
    error: Error | null;
}

/**
 * Hook to manage the lifecycle of a WebMediaAnnotator instance.
 * Creates the instance when the container is ready, subscribes to state changes,
 * and cleans up on unmount.
 */
export function useAnnotator({
    containerRef,
    src,
    fps = 24,
    startFrame = 0,
    preload
}: UseAnnotatorOptions): UseAnnotatorResult {
    const instanceRef = useRef<WebMediaAnnotator | null>(null);
    const [state, setState] = useState<AppState | null>(null);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        try {
            const annotator = new WebMediaAnnotator(containerRef.current, {
                videoSrc: src,
                fps,
                startFrame,
                preload
            });
            instanceRef.current = annotator;

            // Initialize state
            setState(annotator.store.getState());

            // Subscribe to state changes
            const onStateChange = (newState: AppState) => {
                setState({ ...newState });
            };
            annotator.store.on('state:changed', onStateChange);

            return () => {
                annotator.store.off('state:changed', onStateChange);
                annotator.destroy();
                instanceRef.current = null;
            };
        } catch (e) {
            setError(e instanceof Error ? e : new Error(String(e)));
        }
    }, [containerRef, src, fps, startFrame, preload]);

    return {
        instance: instanceRef.current,
        state,
        ready: instanceRef.current !== null && state !== null,
        error
    };
}
