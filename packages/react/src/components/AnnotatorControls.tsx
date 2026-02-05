import React, { useMemo, useState } from 'react';
import { WebMediaAnnotator, AppState, Player } from '@web-media-annotator/core';
import { SkipBack, ChevronLeft, SkipForward, ChevronRight, Pause, Play, Repeat, VolumeX, Volume2 } from 'lucide-react';

export interface AnnotatorControlsProps {
    annotator: WebMediaAnnotator | null;
    state: AppState | null;
    isMobile?: boolean; // Optional to avoid breaking other consumers
}

export const AnnotatorControls: React.FC<AnnotatorControlsProps> = ({ annotator, state, isMobile = false }) => {
    const [useTimecode, setUseTimecode] = useState(false);

    // Derived
    const markers = useMemo(() => {
        if (!state || !state.annotations) return [];
        const frames = new Set(state.annotations.map(a => a.frame));
        return Array.from(frames).sort((a, b) => a - b);
    }, [state?.annotations]);

    const totalFrames = state && state.duration ? Math.floor(state.duration * state.fps) : 100;

    // Handlers
    const handlePlayPause = () => state?.isPlaying ? annotator?.player.pause() : annotator?.player.play();
    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => annotator?.player.seekToFrame(parseInt(e.target.value));

    // Hide for Image Mode
    if ((state?.mediaType as string) === 'image') return null;

    return (
        <div className={`bg-gray-900 border-t border-gray-800 flex items-center px-1 py-1 gap-1 shrink-0 z-20 transition-all ${isMobile ? 'flex-wrap min-h-[56px] h-auto content-start justify-between landscape:py-0 landscape:min-h-[48px]' : 'h-14 justify-between'}`}>

            {/* 1. Playback Controls */}
            <div className={`flex items-center gap-1 ${isMobile ? 'order-1' : ''}`}>
                <button title="Prev Annotation" onClick={() => annotator?.player.seekToPrevAnnotation()} className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"><SkipBack size={20} /></button>
                <button title="Prev Frame" onClick={() => annotator?.player.seekToFrame((state?.currentFrame || 0) - 1)} className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"><ChevronLeft size={20} /></button>

                {/* Play/Pause (highlighted) */}
                {state?.mediaType === 'video' && (
                    <button
                        onClick={handlePlayPause}
                        className="h-11 w-11 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                    >
                        {state?.isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                    </button>
                )}

                <button title="Next Frame" onClick={() => annotator?.player.seekToFrame((state?.currentFrame || 0) + 1)} className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"><ChevronRight size={20} /></button>
                <button title="Next Annotation" onClick={() => annotator?.player.seekToNextAnnotation()} className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"><SkipForward size={20} /></button>

                <button
                    title="Toggle Loop"
                    onClick={(e) => {
                        const v = annotator?.['videoElement'];
                        if (v) {
                            v.loop = !v.loop;
                            // Initial class toggle handled by react state if possible, but here using direct DOM for speed or ref
                            // Ideally use state. isLooping? Not in AppState yet.
                            (e.currentTarget as HTMLElement).dataset.active = v.loop ? 'true' : 'false';
                            // Force re-render or class toggle
                        }
                    }}
                    className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors data-[active=true]:text-blue-400"
                >
                    <Repeat size={20} />
                </button>
            </div>

            {/* 2. Timeline (Adaptive Order) */}
            {/* Desktop: Order 2 (Middle). Mobile Portrait: Order 3 (Bottom, Full Width). Landscape Phone: Middle or Full Width depending on space. */}
            <div className={`flex flex-col justify-center px-2 ${isMobile ? 'w-full order-3 mt-1 border-t border-gray-800/50 pt-1 landscape:w-auto landscape:flex-1 landscape:order-2 landscape:border-t-0 landscape:pt-0 landscape:mt-0' : 'flex-1 order-2'}`}>
                {state?.mediaType === 'video' && (
                    <div className="relative w-full h-8 flex items-center group">
                        {/* Markers layer */}
                        <div className="absolute inset-0 pointer-events-none">
                            {markers.map(frame => (
                                <div
                                    key={frame}
                                    className="absolute top-0 h-full flex flex-col items-center justify-center -translate-x-1/2 z-0 opacity-80"
                                    style={{ left: `${(frame / totalFrames) * 100}%` }}
                                >
                                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-yellow-400 mb-0.5" />
                                    <div className="w-0.5 h-full bg-yellow-400/50" />
                                </div>
                            ))}
                        </div>

                        {/* Track Background */}
                        <div className="absolute inset-x-0 h-1 bg-gray-700 rounded-lg overflow-hidden pointer-events-none top-1/2 -translate-y-1/2">
                            {state?.buffered?.map((range, i) => (
                                <div
                                    key={i}
                                    className="absolute top-0 bottom-0 bg-gray-500/50"
                                    style={{
                                        left: `${(range.start / (state.duration || 1)) * 100}%`,
                                        width: `${((range.end - range.start) / (state.duration || 1)) * 100}%`
                                    }}
                                />
                            ))}
                        </div>

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
                )}
            </div>

            {/* 3. Volume / Timecode */}
            {/* Desktop: Order 3. Mobile Portrait: Order 2 (Right of Playback). */}
            <div className={`flex items-center gap-1 h-11 ${isMobile ? 'order-2 ml-auto landscape:order-3 landscape:ml-0' : 'order-3 ml-2'}`}>
                {/* Volume */}
                <div className="relative group flex items-center justify-center h-11 w-11 rounded-lg hover:bg-gray-700 transition-colors">
                    <button
                        className="w-full h-full flex items-center justify-center text-gray-400 hover:text-white"
                        onClick={() => {
                            if (annotator) {
                                const v = annotator['videoElement'];
                                v.muted = !v.muted;
                                annotator.store.setState({ volume: v.muted ? 0 : 1 });
                            }
                        }}
                    >
                        {state?.volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                    <div className="hidden group-hover:flex absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 p-2 rounded shadow-xl flex-col items-center h-32 w-10 z-[60]">
                        <input
                            type="range"
                            min="0" max="1" step="0.1"
                            defaultValue={state?.volume}
                            onChange={(e) => {
                                if (annotator) {
                                    const val = parseFloat(e.target.value);
                                    annotator['videoElement'].volume = val;
                                    annotator['videoElement'].muted = false;
                                    annotator.store.setState({ volume: val });
                                }
                            }}
                            className="h-full w-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                        />
                    </div>
                </div>

                {/* Timecode Toggle */}
                <button
                    onClick={() => setUseTimecode(!useTimecode)}
                    className="h-11 px-2 font-mono text-xs text-right hover:text-blue-400 transition-colors flex items-center justify-center min-w-[80px]"
                >
                    {useTimecode
                        ? Player.frameToTimecode(state?.currentFrame || 0, state?.fps || 24)
                        : `${state?.currentFrame} / ${totalFrames}`
                    }
                </button>
            </div>

        </div>
    );
};
