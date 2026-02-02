import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { WebMediaAnnotator, AppState } from '@web-media-annotator/core';
import { Toolbar, Popover } from '@web-media-annotator/ui';
import { Undo2, Redo2, ChevronLeft, ChevronRight, SkipBack, SkipForward, Download, Trash2, Eraser, Play, Pause, Repeat, Volume2, VolumeX, FileJson, Image as ImageIcon, Upload, Info } from 'lucide-react';
import { Player } from '@web-media-annotator/core';
import { SyncPanel } from './SyncPanel';

export interface AnnotatorProps {
    src: string;
    fps?: number;
    startFrame?: number;
    width?: string | number;
    height?: string | number;
    className?: string;
}

export interface AnnotatorRef {
    getInstance: () => WebMediaAnnotator | null;
}

export const Annotator = forwardRef<AnnotatorRef, AnnotatorProps>(({
    src, fps = 24, startFrame = 0, width = '100%', height = '100%', className
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const annotatorRef = useRef<WebMediaAnnotator | null>(null);
    const [state, setState] = useState<AppState | null>(null);
    const [useTimecode, setUseTimecode] = useState(false);

    useImperativeHandle(ref, () => ({
        getInstance: () => annotatorRef.current
    }));

    useEffect(() => {
        if (!containerRef.current) return;

        const annotator = new WebMediaAnnotator(containerRef.current, {
            videoSrc: src,
            fps,
            startFrame
        });
        annotatorRef.current = annotator;

        setState(annotator.store.getState());
        const onStateChange = (newState: AppState) => {
            setState({ ...newState });
        };
        annotator.store.on('state:changed', onStateChange);

        return () => {
            annotator.store.off('state:changed', onStateChange);
            annotator.destroy();
            annotatorRef.current = null;
        };
    }, [src, fps, startFrame]);

    // Handlers
    const handleToolSelect = (tool: string) => annotatorRef.current?.store.setState({ activeTool: tool as any });
    const handleColorChange = (color: string) => annotatorRef.current?.store.setState({ activeColor: color });
    const handleWidthChange = (width: number) => annotatorRef.current?.store.setState({ activeStrokeWidth: width });

    const handlePlayPause = () => state?.isPlaying ? annotatorRef.current?.player.pause() : annotatorRef.current?.player.play();
    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => annotatorRef.current?.player.seekToFrame(parseInt(e.target.value));

    const handleUndo = () => annotatorRef.current?.store.undo();
    const handleRedo = () => annotatorRef.current?.store.redo();

    const handleExport = async (composite: boolean) => {
        if (!annotatorRef.current) return;
        const dataUrl = await annotatorRef.current.renderer.captureFrame({ composite, videoElement: annotatorRef.current['videoElement'] });
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `frame_${state?.currentFrame}_${composite ? 'comp' : 'anno'}.png`;
        a.click();
    };

    const handleSave = () => {
        if (!annotatorRef.current) return;
        const json = JSON.stringify(annotatorRef.current.store.getState().annotations, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'annotations.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!annotatorRef.current || !e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const annotations = JSON.parse(ev.target?.result as string);
                if (Array.isArray(annotations)) {
                    annotatorRef.current?.store.setState({ annotations });
                    annotatorRef.current?.store.captureSnapshot();
                }
            } catch (err) {
                console.error("Invalid JSON", err);
                alert("Failed to load JSON");
            }
        };
        reader.readAsText(file);
    };

    // Calculate markers
    const markers = React.useMemo(() => {
        if (!state || !state.annotations) return [];
        const frames = new Set(state.annotations.map(a => a.frame));
        return Array.from(frames).sort((a, b) => a - b);
    }, [state?.annotations]);

    const totalFrames = state && state.duration ? Math.floor(state.duration * state.fps) : 100;

    // Fix aspect ratio on load
    const handleVideoLoad = () => {
        if (!annotatorRef.current) return;
        const video = annotatorRef.current['videoElement'];
        if (video && containerRef.current) {
            const ratio = video.videoWidth / video.videoHeight;
            containerRef.current.style.aspectRatio = `${ratio}`;
            // Also force resize to ensure renderer matches
            annotatorRef.current.renderer.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        }
    };

    // --- Zoom Logic ---
    const handleWheel = (e: React.WheelEvent) => {
        if (!state) return;

        const scaleFactor = 1.1;
        const direction = e.deltaY > 0 ? -1 : 1;
        let newScale = state.viewport.scale * (direction > 0 ? scaleFactor : 1 / scaleFactor);
        newScale = Math.max(0.1, Math.min(newScale, 10)); // Clamp

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Zoom towards mouse pointer
        const newX = mouseX - (mouseX - state.viewport.x) / state.viewport.scale * newScale;
        const newY = mouseY - (mouseY - state.viewport.y) / state.viewport.scale * newScale;

        annotatorRef.current?.store.setState({
            viewport: { x: newX, y: newY, scale: newScale }
        });
    };
    useEffect(() => {
        if (annotatorRef.current) {
            const video = annotatorRef.current['videoElement'];
            video.addEventListener('loadedmetadata', handleVideoLoad);
            return () => video.removeEventListener('loadedmetadata', handleVideoLoad);
        }
    }, [annotatorRef.current]);

    return (
        <div className={`flex flex-col h-full bg-black text-white ${className || ''}`} style={{ width, height }}>
            {/* Top Toolbar Area */}
            <div className="flex flex-row items-center bg-gray-900 border-b border-gray-800">
                <div className="pl-2">
                    <Popover
                        side="bottom"
                        align="start"
                        trigger={
                            <button title="Shortcuts Info" className="p-2 text-gray-400 hover:text-blue-400 transition-colors">
                                <Info size={20} />
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
                </div>
                <Toolbar
                    orientation="horizontal"
                    className="border-0 bg-transparent flex-1"
                    activeTool={state?.activeTool || 'select'}
                    onToolSelect={handleToolSelect}
                    activeColor={state?.activeColor}
                    onColorChange={handleColorChange}
                    activeStrokeWidth={state?.activeStrokeWidth}
                    onStrokeWidthChange={handleWidthChange}

                    defaultDuration={state?.defaultDuration || 1}
                    onDefaultDurationChange={(d) => annotatorRef.current?.store.setState({ defaultDuration: d })}

                    holdDuration={state?.holdDuration || 1}
                    onHoldDurationChange={(d: number) => {
                        // If setting hold > 1, turn off onion skin
                        if (d > 1) {
                            annotatorRef.current?.store.setState({ holdDuration: d, isOnionSkinEnabled: false });
                        } else {
                            annotatorRef.current?.store.setState({ holdDuration: d });
                        }
                    }}

                    isOnionSkinEnabled={state?.isOnionSkinEnabled}
                    onToggleOnionSkin={() => {
                        const nextState = !state?.isOnionSkinEnabled;
                        // If turning on onion skin, reset hold to 1
                        if (nextState) {
                            annotatorRef.current?.store.setState({ isOnionSkinEnabled: true, holdDuration: 1 });
                        } else {
                            annotatorRef.current?.store.setState({ isOnionSkinEnabled: false });
                        }
                    }}
                    onionSkinPrevFrames={state?.onionSkinPrevFrames}
                    onionSkinNextFrames={state?.onionSkinNextFrames}
                    onOnionSkinSettingsChange={(prev: number, next: number) => annotatorRef.current?.store.setState({ onionSkinPrevFrames: prev, onionSkinNextFrames: next })}
                />

                <div className="flex gap-2 px-2 items-center border-l border-gray-800 h-10">
                    <button title="Undo" onClick={handleUndo} className="p-2 bg-gray-800 rounded hover:bg-gray-700"><Undo2 size={16} /></button>
                    <button title="Redo" onClick={handleRedo} className="p-2 bg-gray-800 rounded hover:bg-gray-700"><Redo2 size={16} /></button>
                </div>

                <div className="flex px-2 items-center border-l border-gray-800 h-10">
                    <SyncPanel annotator={annotatorRef.current} />
                </div>

                {/* Export / Import Menu */}
                <div className="flex px-2 items-center border-l border-gray-800 h-10 mr-2">
                    <Popover
                        side="bottom"
                        align="end"
                        trigger={
                            <button
                                title="Import / Export"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs font-medium transition-colors"
                            >
                                <Download size={14} />
                                <span>Export</span>
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
                                    Import JSON
                                    <input type="file" accept=".json" onChange={handleLoad} className="hidden" />
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
                            </div>
                        }
                    />
                </div>

                <div className="flex gap-2 items-center">
                    <button
                        title="Clear Current Frame"
                        onClick={() => {
                            // Find annotations on current frame and delete them
                            // Ideally Store needs a method, but for now filtering:
                            const current = state?.currentFrame || 0;
                            const keep = state?.annotations.filter(a => a.frame !== current) || [];
                            annotatorRef.current?.store.setState({ annotations: keep });
                        }}
                        className="p-2 rounded hover:bg-red-900/30 text-red-300 transition-colors"
                    >
                        <Eraser size={20} />
                    </button>

                    <button
                        title="Clear All Annotations"
                        onClick={() => {
                            if (confirm('Clear all annotations?')) {
                                annotatorRef.current?.store.setState({ annotations: [] });
                            }
                        }}
                        className="p-2 rounded hover:bg-red-900/50 text-red-500 transition-colors"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-row overflow-hidden">
                <div className="flex-1 relative bg-gray-950 overflow-hidden flex items-center justify-center">
                    <div
                        ref={containerRef}
                        className="relative w-full h-full max-h-full"
                        style={{ aspectRatio: '16/9' }}
                        onWheel={handleWheel}
                    />
                </div>
            </div>

            {/* Timeline / Controls */}
            <div className="h-14 bg-gray-900 border-t border-gray-800 flex items-center px-4 gap-4 pb-safe">
                <div className="flex items-center gap-1">
                    <button title="Prev Annotation" onClick={() => annotatorRef.current?.player.seekToPrevAnnotation()} className="p-1 hover:text-white text-gray-400"><SkipBack size={16} /></button>
                    <button title="Prev Frame" onClick={() => annotatorRef.current?.player.seekToFrame((state?.currentFrame || 0) - 1)} className="p-1 hover:text-white text-gray-400"><ChevronLeft size={16} /></button>

                    {/* Play/Pause - Clean Style */}
                    <button
                        onClick={handlePlayPause}
                        className="w-8 h-8 flex items-center justify-center text-white hover:text-blue-400 mx-2 transition-colors"
                    >
                        {state?.isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                    </button>

                    <button title="Next Frame" onClick={() => annotatorRef.current?.player.seekToFrame((state?.currentFrame || 0) + 1)} className="p-1 hover:text-white text-gray-400"><ChevronRight size={16} /></button>
                    <button title="Next Annotation" onClick={() => annotatorRef.current?.player.seekToNextAnnotation()} className="p-1 hover:text-white text-gray-400"><SkipForward size={16} /></button>

                    {/* Loop Toggle */}
                    <button
                        title="Toggle Loop"
                        onClick={(e) => {
                            const v = annotatorRef.current?.['videoElement'];
                            if (v) {
                                v.loop = !v.loop;
                                (e.currentTarget).classList.toggle('text-blue-500');
                                (e.currentTarget).classList.toggle('text-gray-400');
                            }
                        }}
                        className="p-1 ml-2 text-gray-400 hover:text-white"
                    >
                        <Repeat size={16} />
                    </button>


                </div>

                <div className="flex-1 flex flex-col justify-center">
                    {/* Timeline Slider with Markers */}
                    <div className="relative w-full h-8 flex items-center group">
                        {/* Markers layer - Rendered first (behind scrubber) but outside overflow-hidden track */}
                        <div className="absolute inset-0 pointer-events-none">
                            {markers.map(frame => (
                                <div
                                    key={frame}
                                    className="absolute top-0 h-full flex flex-col items-center justify-center -translate-x-1/2 z-0 opacity-80"
                                    style={{ left: `${(frame / totalFrames) * 100}%` }}
                                >
                                    {/* Triangle Handle */}
                                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-yellow-400 mb-0.5" />
                                    {/* Line */}
                                    <div className="w-0.5 h-full bg-yellow-400/50" />
                                </div>
                            ))}
                        </div>

                        {/* Track Background */}
                        <div className="absolute inset-x-0 h-1 bg-gray-700 rounded-lg overflow-hidden pointer-events-none top-1/2 -translate-y-1/2" />

                        <input
                            type="range"
                            min="0"
                            max={totalFrames}
                            value={state?.currentFrame || 0}
                            onChange={handleSeek}
                            className="w-full h-full opacity-0 cursor-pointer absolute z-20"
                        />

                        {/* Custom Scrubber Visual */}
                        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full shadow pointer-events-none z-10 border-2 border-white box-content" style={{ left: `calc(${(state?.currentFrame || 0) / totalFrames * 100}% - 10px)` }} />
                    </div>
                </div>

                {/* Right Side Controls: Volume & Timecode */}
                <div className="flex items-center gap-2 border-l border-gray-800 pl-4 h-8 ml-2">
                    {/* Volume */}
                    <div className="relative group flex items-center justify-center h-full w-8">
                        <button
                            className="text-gray-400 hover:text-white"
                            onClick={() => {
                                if (annotatorRef.current) {
                                    const v = annotatorRef.current['videoElement'];
                                    v.muted = !v.muted;
                                    annotatorRef.current.store.setState({ volume: v.muted ? 0 : 1 });
                                }
                            }}
                        >
                            {state?.volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>

                        {/* Vertical Slider Popup */}
                        <div className="hidden group-hover:flex absolute bottom-6 mb-1 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 p-2 rounded shadow-2xl flex-col items-center h-32 w-8 z-50">
                            <input
                                type="range"
                                min="0" max="1" step="0.1"
                                defaultValue={state?.volume}
                                onChange={(e) => {
                                    if (annotatorRef.current) {
                                        const val = parseFloat(e.target.value);
                                        annotatorRef.current['videoElement'].volume = val;
                                        annotatorRef.current['videoElement'].muted = false;
                                        annotatorRef.current.store.setState({ volume: val });
                                    }
                                }}
                                className="h-full w-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                            />
                        </div>
                        {/* Invisible bridge for hover */}
                        <div className="hidden group-hover:block absolute bottom-full w-20 h-6 bg-transparent left-1/2 -translate-x-1/2" />
                    </div>

                    {/* Timecode Display */}
                    <button
                        onClick={() => setUseTimecode(!useTimecode)}
                        className="font-mono text-xs w-28 text-right hover:text-blue-400 transition-colors"
                    >
                        {useTimecode
                            ? Player.frameToTimecode(state?.currentFrame || 0, state?.fps || 24)
                            : `${state?.currentFrame} / ${totalFrames}`
                        }
                    </button>
                </div>
            </div>
        </div>
    );
});

Annotator.displayName = 'Annotator';
