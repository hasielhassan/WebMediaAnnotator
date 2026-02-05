import React, { useMemo, useState } from 'react';
import { WebMediaAnnotator, AppState, Player } from '@web-media-annotator/core';
import { SkipBack, ChevronLeft, SkipForward, ChevronRight, Pause, Play, Repeat, VolumeX, Volume2 } from 'lucide-react';

export interface AnnotatorControlsProps {
    annotator: WebMediaAnnotator | null;
    state: AppState | null;
}

export const AnnotatorControls: React.FC<AnnotatorControlsProps> = ({ annotator, state }) => {
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
        <div className="h-14 bg-gray-900 border-t border-gray-800 flex items-center px-4 gap-4 pb-safe">
            <div className="flex items-center gap-1">
                <button title="Prev Annotation" onClick={() => annotator?.player.seekToPrevAnnotation()} className="p-1 hover:text-white text-gray-400"><SkipBack size={16} /></button>
                <button title="Prev Frame" onClick={() => annotator?.player.seekToFrame((state?.currentFrame || 0) - 1)} className="p-1 hover:text-white text-gray-400"><ChevronLeft size={16} /></button>

                {/* Play/Pause - Clean Style - HIDE FOR IMAGE implicitly handled by parent check but good here too */}
                {state?.mediaType === 'video' && (
                    <button
                        onClick={handlePlayPause}
                        className="w-8 h-8 flex items-center justify-center text-white hover:text-blue-400 mx-2 transition-colors"
                    >
                        {state?.isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                    </button>
                )}

                <button title="Next Frame" onClick={() => annotator?.player.seekToFrame((state?.currentFrame || 0) + 1)} className="p-1 hover:text-white text-gray-400"><ChevronRight size={16} /></button>
                <button title="Next Annotation" onClick={() => annotator?.player.seekToNextAnnotation()} className="p-1 hover:text-white text-gray-400"><SkipForward size={16} /></button>

                {/* Loop Toggle */}
                <button
                    title="Toggle Loop"
                    onClick={(e) => {
                        const v = annotator?.['videoElement'];
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
                                    {/* Triangle Handle */}
                                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-yellow-400 mb-0.5" />
                                    {/* Line */}
                                    <div className="w-0.5 h-full bg-yellow-400/50" />
                                </div>
                            ))}
                        </div>

                        {/* Track Background */}
                        <div className="absolute inset-x-0 h-1 bg-gray-700 rounded-lg overflow-hidden pointer-events-none top-1/2 -translate-y-1/2">
                            {/* Buffered Ranges */}
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

            {/* Right Side Controls: Volume & Timecode */}
            <div className="flex items-center gap-2 border-l border-gray-800 pl-4 h-8 ml-2">
                {/* Volume */}
                <div className="relative group flex items-center justify-center h-full w-8">
                    <button
                        className="text-gray-400 hover:text-white"
                        onClick={() => {
                            if (annotator) {
                                const v = annotator['videoElement'];
                                v.muted = !v.muted;
                                annotator.store.setState({ volume: v.muted ? 0 : 1 });
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
    );
};
