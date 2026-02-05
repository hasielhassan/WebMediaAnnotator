import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { WebMediaAnnotator, MediaRegistry } from '@web-media-annotator/core';
import type { AppState } from '@web-media-annotator/core';
import { Popover, ExportProgress } from '@web-media-annotator/ui';
import { Undo2, Redo2, Download, Trash2, Eraser, FileJson, Image as ImageIcon, Upload, Info, FolderDown, Files } from 'lucide-react';
import { SyncPanel } from './SyncPanel';
import { AnnotatorToolbar } from './components/AnnotatorToolbar';
import { AnnotatorControls } from './components/AnnotatorControls';
import { AnnotatorCanvas } from './components/AnnotatorCanvas';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useHotkeys } from './hooks/useHotkeys';
import { useMediaIO } from './hooks/useMediaIO';
import { useAnnotator } from './hooks/useAnnotator';

export interface AnnotatorProps {
    src: string;
    fps?: number;
    startFrame?: number;
    width?: string | number;
    height?: string | number;
    className?: string;
    preload?: 'auto' | 'metadata' | 'force-download';
}

export interface AnnotatorRef {
    getInstance: () => WebMediaAnnotator | null;
}

export const Annotator = forwardRef<AnnotatorRef, AnnotatorProps>(({
    src, fps = 24, startFrame = 0, width = '100%', height = '100%', className, preload
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Core Annotator Lifecycle Hook
    const { instance, state } = useAnnotator({
        containerRef,
        src,
        fps,
        startFrame,
        preload
    });

    // Derived States for UI
    // Remove max-height check so high-res landscape phones (Pixel 7, iPhone Max) use Desktop layout (saving vertical space)
    const isMobile = useMediaQuery('(max-width: 768px)');
    const isTouch = useMediaQuery('(pointer: coarse)');

    // IO Hook
    const {
        exportProgress,
        isLoading,
        loadingProgress,
        handleExport,
        handleBulkExport,
        handleSave,
        handleLoad
    } = useMediaIO(instance, state);

    useImperativeHandle(ref, () => ({
        getInstance: () => instance
    }));

    // Enable hotkeys: Disable if touch/mobile to prevent virtual keyboard interference? 
    // Actually user said remove Info button. Hotkeys might still be useful if they use a bluetooth keyboard on iPad.
    // So keep hotkeys enabled, just hide the visual Info helper.
    useHotkeys(instance, true);

    // Handlers
    const handleUndo = () => instance?.store.undo();
    const handleRedo = () => instance?.store.redo();

    // Fix aspect ratio on load
    const handleMediaLoad = () => {
        if (!instance) return;
        // Use exposed getter which casts, OR use internal mediaElement if we exposed it.
        // The getter videoElement returns HTMLVideoElement, but at runtime it might be IG.
        // Let's rely on renderer resize or custom logic.
        // Actually, WebMediaAnnotator handles fitCanvasToVideo internaly on 'loadedmetadata'.
        // We just need to update Container Aspect Ratio.

        const media = instance['mediaElement'] as HTMLVideoElement | HTMLImageElement;
        if (media && containerRef.current) {
            let w, h;
            if (media instanceof HTMLVideoElement) {
                w = media.videoWidth;
                h = media.videoHeight;
            } else {
                w = media.naturalWidth;
                h = media.naturalHeight;
            }

            if (w && h) {
                const ratio = w / h;
                containerRef.current.style.aspectRatio = `${ratio}`;
                instance.renderer.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
            }
        }
    };

    // --- Zoom Logic --- // Moved to AnnotatorCanvas
    // const handleWheel = (e: React.WheelEvent) => {
    //     if (!state) return;

    //     const scaleFactor = 1.1;
    //     const direction = e.deltaY > 0 ? -1 : 1;
    //     let newScale = state.viewport.scale * (direction > 0 ? scaleFactor : 1 / scaleFactor);
    //     newScale = Math.max(0.1, Math.min(newScale, 10)); // Clamp

    //     const rect = containerRef.current?.getBoundingClientRect();
    //     if (!rect) return;
    //     const mouseX = e.clientX - rect.left;
    //     const mouseY = e.clientY - rect.top;

    //     // Zoom towards mouse pointer
    //     const newX = mouseX - (mouseX - state.viewport.x) / state.viewport.scale * newScale;
    //     const newY = mouseY - (mouseY - state.viewport.y) / state.viewport.scale * newScale;

    //     instance?.store.setState({
    //         viewport: { x: newX, y: newY, scale: newScale }
    //     });
    // };
    useEffect(() => {
        if (instance) {
            // We can't easily add listener to 'videoElement' if it changes via loadMedia.
            // Better to rely on store state or internal events.
            // The WebMediaAnnotator internal resize observer handles the Canvas/Renderer sync.
            // We just need to sync Container aspect ratio.
            // Let's poll or hook into 'loadedmetadata' on init.

            const media = instance['mediaElement'] as Element;
            if (media) {
                const handler = () => handleMediaLoad();
                // Video uses loadedmetadata, Image uses load
                media.addEventListener('loadedmetadata', handler);
                media.addEventListener('load', handler);
                return () => {
                    media.removeEventListener('loadedmetadata', handler);
                    media.removeEventListener('load', handler);
                };
            }
        }
    }, [instance, state?.mediaType]); // Re-run if media type changes (implies new element)

    return (
        <div className={`flex flex-col h-full bg-black text-white ${className || ''}`} style={{ width, height, overflow: 'hidden' }}>
            <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
            {/* Top Toolbar Area */}
            <div className={`flex flex-row flex-wrap items-center bg-gray-900 border-b border-gray-800 shrink-0 gap-x-2 gap-y-2 px-2 py-2 min-h-[56px] h-auto justify-start`}>

                <AnnotatorToolbar
                    annotator={instance}
                    state={state}
                    className="border-0 bg-transparent flex-1 justify-center min-w-0"
                    orientation="horizontal"
                    isMobile={isMobile}
                    prefix={
                        !isMobile && !isTouch ? (
                            <Popover
                                side="bottom"
                                align="start"
                                trigger={
                                    <button title="Shortcuts Info" className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-blue-400 transition-colors">
                                        <Info size={24} />
                                    </button>
                                }
                                content={
                                    <div className="w-64 p-2 text-xs">
                                        <h3 className="font-bold text-white mb-2 pb-1 border-b border-gray-700">Keyboard Shortcuts</h3>
                                        <div className="grid grid-cols-[1fr_auto] gap-y-1 gap-x-4 text-gray-300">
                                            <span>Play / Pause</span> <span className="font-mono text-gray-500">Space</span>
                                            <span>Prev / Next Frame</span> <span className="font-mono text-gray-500">← / →</span>
                                            <span>Prev / Next Annotation</span> <span className="font-mono text-gray-500">Ctrl + ← / →</span>
                                            <span>Undo / Redo</span> <span className="font-mono text-gray-500">Ctrl + Z / Y</span>
                                            <span>Copy Selected / Frame</span> <span className="font-mono text-gray-500">Ctrl + C</span>
                                            <span>Paste</span> <span className="font-mono text-gray-500">Ctrl + V</span>
                                            <span>Delete Selected</span> <span className="font-mono text-gray-500">Del / Backspace</span>

                                            <h3 className="font-bold text-white mt-2 mb-1 pb-1 border-b border-gray-700 col-span-2">Tools</h3>
                                            <span>Select</span> <span className="font-mono text-gray-500">S</span>
                                            <span>Pencil</span> <span className="font-mono text-gray-500">P</span>
                                            <span>Arrow</span> <span className="font-mono text-gray-500">A</span>
                                            <span>Circle</span> <span className="font-mono text-gray-500">C</span>
                                            <span>Square</span> <span className="font-mono text-gray-500">Q</span>
                                            <span>Text</span> <span className="font-mono text-gray-500">T</span>
                                            <span>Eraser</span> <span className="font-mono text-gray-500">E</span>
                                            <span>Toggle Ghosting</span> <span className="font-mono text-gray-500">G</span>
                                            <span>Toggle Hold (3fr)</span> <span className="font-mono text-gray-500">H</span>

                                            <h3 className="font-bold text-white mt-2 mb-1 pb-1 border-b border-gray-700 col-span-2">Mouse</h3>
                                            <span>Pan Canvas</span> <span className="font-mono text-gray-500">Middle Click (Hold)</span>
                                            <span>Zoom</span> <span className="font-mono text-gray-500">Scroll Wheel</span>
                                            <span>Reset View</span> <span className="font-mono text-gray-500">R</span>
                                            <span>Stroke Size</span> <span className="font-mono text-gray-500">+ / -</span>
                                        </div>
                                    </div>
                                }
                            />
                        ) : undefined
                    }
                >

                    {/* Injected System Tools */}
                    <button title="Undo" onClick={handleUndo} className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"><Undo2 size={24} /></button>
                    <button title="Redo" onClick={handleRedo} className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"><Redo2 size={24} /></button>

                    <div className="flex items-center">
                        <SyncPanel annotator={instance} />
                    </div>

                    <Popover
                        side="bottom"
                        align="end"
                        trigger={
                            <button
                                title="Import / Export"
                                className="h-11 px-3 flex items-center gap-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                            >
                                <Download size={18} />
                                <span className="hidden sm:inline">Export</span>
                            </button>
                        }
                        content={
                            <div className="w-56 p-1 flex flex-col gap-1">
                                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Annotations Data
                                </div>
                                <button
                                    onClick={handleSave}
                                    className="flex items-center gap-2 px-2 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded transition-colors w-full text-left"
                                >
                                    <FileJson size={16} className="text-yellow-400" />
                                    Download JSON
                                </button>
                                <label className="flex items-center gap-2 px-2 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded transition-colors w-full text-left cursor-pointer">
                                    <Upload size={16} className="text-yellow-400" />
                                    Open File (Media / JSON)
                                    <input type="file" accept={`.json,${new MediaRegistry().getAcceptAttribute()}`} onChange={handleLoad} className="hidden" />
                                </label>

                                <div className="h-px bg-gray-700 my-1" />

                                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Image Export
                                </div>
                                <button
                                    onClick={() => handleExport(false)}
                                    className="flex items-center gap-2 px-2 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded transition-colors w-full text-left"
                                >
                                    <ImageIcon size={16} className="text-blue-400" />
                                    Current Frame (Clean)
                                </button>
                                <button
                                    onClick={() => handleExport(true)}
                                    className="flex items-center gap-2 px-2 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded transition-colors w-full text-left"
                                >
                                    <ImageIcon size={16} className="text-green-400" />
                                    Current Frame (Burned In)
                                </button>

                                <div className="h-px bg-gray-700 my-1" />

                                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Bulk Export (ZIP)
                                </div>
                                <button
                                    onClick={() => handleBulkExport(false)}
                                    className="flex items-center gap-2 px-2 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded transition-colors w-full text-left"
                                >
                                    <Files size={16} className="text-blue-400" />
                                    All Annotated (Clean)
                                </button>
                                <button
                                    onClick={() => handleBulkExport(true)}
                                    className="flex items-center gap-2 px-2 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded transition-colors w-full text-left"
                                >
                                    <FolderDown size={16} className="text-green-400" />
                                    All Annotated (Burned In)
                                </button>
                            </div>
                        }
                    />

                    <button
                        title="Clear Current Frame"
                        onClick={() => {
                            const current = state?.currentFrame || 0;
                            const keep = state?.annotations.filter(a => a.frame !== current) || [];
                            instance?.store.setState({ annotations: keep });
                        }}
                        className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-red-900/30 text-red-300 transition-colors"
                    >
                        <Eraser size={24} />
                    </button>

                    <button
                        title="Clear All Annotations"
                        onClick={() => {
                            if (confirm('Clear all annotations?')) {
                                instance?.store.setState({ annotations: [] });
                            }
                        }}
                        className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-red-900/50 text-red-500 transition-colors"
                    >
                        <Trash2 size={24} />
                    </button>
                </AnnotatorToolbar>
            </div>

            <AnnotatorCanvas
                ref={containerRef}
                annotator={instance}
                state={state}
            />

            <AnnotatorControls
                annotator={instance}
                state={state}
                isMobile={isMobile}
            />

            {/* Export Progress Overlay */}
            {exportProgress && (
                <ExportProgress
                    current={exportProgress.current}
                    total={exportProgress.total}
                    title="Exporting Annotated Frames"
                />
            )}

            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <div className="text-white font-medium">Processing Media...</div>
                        {loadingProgress !== null && (
                            <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden mt-2">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-300 ease-out"
                                    style={{ width: `${Math.min(100, Math.max(0, loadingProgress * 100))}%` }}
                                />
                            </div>
                        )}
                        {loadingProgress !== null && (
                            <div className="text-xs text-gray-400 font-mono">
                                {Math.round(loadingProgress * 100)}%
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

Annotator.displayName = 'Annotator';
