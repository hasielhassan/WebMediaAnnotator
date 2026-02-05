import { useEffect, useRef } from 'react';
import { WebMediaAnnotator, Annotation } from '@web-media-annotator/core';

export function useHotkeys(annotator: WebMediaAnnotator | null, enabled: boolean = true) {
    const clipboardRef = useRef<Annotation[]>([]);

    useEffect(() => {
        if (!annotator || !enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore keystrokes if focusing on input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const store = annotator.store;
            const player = annotator.player;
            const state = store.getState();

            // Undo/Redo
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    store.undo();
                    return;
                }
                if (e.key === 'y') {
                    e.preventDefault();
                    store.redo();
                    return;
                }
                if (e.key === 'c') {
                    const selIds = state.selectedAnnotationIds;
                    if (selIds.length > 0) {
                        // 1. Copy selected
                        const selectedAnns = state.annotations.filter(a => selIds.includes(a.id));
                        if (selectedAnns.length > 0) {
                            clipboardRef.current = JSON.parse(JSON.stringify(selectedAnns));
                            console.log(`[Clipboard] Copied ${selectedAnns.length} selected annotations.`);
                        }
                    } else {
                        // 2. Copy all anchored on this frame
                        const frameAnns = state.annotations.filter(a => a.frame === state.currentFrame);
                        if (frameAnns.length > 0) {
                            clipboardRef.current = JSON.parse(JSON.stringify(frameAnns));
                            console.log(`[Clipboard] Copied ${frameAnns.length} annotations from frame ${state.currentFrame}.`);
                        }
                    }
                    return;
                }
                if (e.key === 'v') {
                    if (clipboardRef.current && clipboardRef.current.length > 0) {
                        const currentFrame = store.getState().currentFrame;
                        const addedIds: string[] = [];

                        clipboardRef.current.forEach(template => {
                            const newAnn: Annotation = JSON.parse(JSON.stringify(template)); // Use Annotation type
                            newAnn.id = crypto.randomUUID();
                            newAnn.frame = currentFrame;

                            // Apply offset if pasting on the SAME frame as original source
                            if (template.frame === currentFrame) {
                                if (newAnn.points) {
                                    newAnn.points = newAnn.points.map(p => ({ // No 'any' needed here, p is already typed by Annotation['points']
                                        ...p,
                                        x: p.x + 0.02,
                                        y: p.y + 0.02
                                    }));
                                }
                            }

                            store.addAnnotation(newAnn);
                            addedIds.push(newAnn.id);
                        });

                        // Select the newly added ones
                        store.setState({ selectedAnnotationIds: addedIds });
                        store.captureSnapshot();
                        console.log(`[Clipboard] Pasted ${addedIds.length} annotations.`);
                    }
                    return;
                }
                // Navigation by Annotated Frames
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    player.seekToPrevAnnotation();
                    return;
                }
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    player.seekToNextAnnotation();
                    return;
                }
            }

            switch (e.key.toLowerCase()) {
                // Toggles & Selection
                case 'escape':
                    store.setState({ selectedAnnotationIds: [], activeTool: 'select' });
                    break;

                case 'delete':
                case 'backspace': {
                    const selIds = store.getState().selectedAnnotationIds;
                    if (selIds.length > 0) {
                        selIds.forEach(id => store.deleteAnnotation(id));
                        store.setState({ selectedAnnotationIds: [] });
                        store.captureSnapshot();
                    }
                    break;
                }

                // Playback
                case ' ': // Spacebar
                    e.preventDefault();
                    if (store.getState().isPlaying) {
                        player.pause();
                    } else {
                        player.play();
                    }
                    break;

                // Navigation (Frame by Frame)
                case 'arrowleft':
                    e.preventDefault();
                    player.seekToFrame(store.getState().currentFrame - 1);
                    break;
                case 'arrowright':
                    e.preventDefault();
                    player.seekToFrame(store.getState().currentFrame + 1);
                    break;

                // Tools
                case 's': store.setState({ activeTool: 'select' }); break;
                case 'p': store.setState({ activeTool: 'freehand', selectedAnnotationIds: [] }); break;
                case 'a': store.setState({ activeTool: 'arrow', selectedAnnotationIds: [] }); break;
                case 'c': store.setState({ activeTool: 'circle', selectedAnnotationIds: [] }); break;
                case 'q': store.setState({ activeTool: 'square', selectedAnnotationIds: [] }); break;
                case 't': store.setState({ activeTool: 'text', selectedAnnotationIds: [] }); break;
                case 'e': store.setState({ activeTool: 'eraser', selectedAnnotationIds: [] }); break;

                // Toggles
                case 'g': {
                    const isCurrentlyEnabled = store.getState().isOnionSkinEnabled;
                    if (!isCurrentlyEnabled) {
                        store.setState({ isOnionSkinEnabled: true, holdDuration: 1 });
                    } else {
                        store.setState({ isOnionSkinEnabled: false });
                    }
                    break;
                }

                case 'h': {
                    const currentDur = store.getState().holdDuration;
                    if (currentDur > 1) {
                        store.setState({ holdDuration: 1 });
                    } else {
                        store.setState({ holdDuration: 24, isOnionSkinEnabled: false });
                    }
                    break;
                }

                // View
                case 'r':
                    store.setState({ viewport: { x: 0, y: 0, scale: 1 } });
                    break;

                // Stroke Width
                case '=': // + without shift
                case '+': {
                    const newWidthInc = Math.min(20, store.getState().activeStrokeWidth + 1);
                    store.setState({ activeStrokeWidth: newWidthInc });
                    break;
                }
                case '-':
                case '_': {
                    const newWidthDec = Math.max(1, store.getState().activeStrokeWidth - 1);
                    store.setState({ activeStrokeWidth: newWidthDec });
                    break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [annotator, enabled]);
}
