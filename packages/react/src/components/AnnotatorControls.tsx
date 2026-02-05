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

    // -- Sub-Components (Defined here to capture scope) --

    const Timeline = (
        <div className={`flex flex-col justify-center px-2 ${isMobile ? 'w-full mb-0.5 border-b border-gray-800/50 pb-0.5' : 'flex-1'}`}>
            {state?.mediaType === 'video' && (
                <div className={`relative w-full ${isMobile ? 'h-6' : 'h-8'} flex items-center group`}>
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
                                    left: `${(range.start / (state?.duration || 1)) * 100}%`,
                                    width: `${((range.end - range.start) / (state?.duration || 1)) * 100}%`
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
    );

    const PlaybackControls = (
        <div className={`flex items-center ${isMobile ? 'gap-0.5' : 'gap-1'}`}>
            <button title="Prev Annotation" onClick={() => annotator?.player.seekToPrevAnnotation()} className={`${isMobile ? 'h-9 w-9' : 'h-11 w-11'} flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors`}><SkipBack size={isMobile ? 18 : 20} /></button>
            <button title="Prev Frame" onClick={() => annotator?.player.seekToFrame((state?.currentFrame || 0) - 1)} className={`${isMobile ? 'h-9 w-9' : 'h-11 w-11'} flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors`}><ChevronLeft size={isMobile ? 18 : 20} /></button>

            {/* Play/Pause (highlighted) */}
            {state?.mediaType === 'video' && (
                <button
                    onClick={handlePlayPause}
                    className={`${isMobile ? 'h-9 w-9' : 'h-11 w-11'} flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors`}
                >
                    {state?.isPlaying ? <Pause size={isMobile ? 20 : 24} fill="currentColor" /> : <Play size={isMobile ? 20 : 24} fill="currentColor" />}
                </button>
            )}

            <button title="Next Frame" onClick={() => annotator?.player.seekToFrame((state?.currentFrame || 0) + 1)} className={`${isMobile ? 'h-9 w-9' : 'h-11 w-11'} flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors`}><ChevronRight size={isMobile ? 18 : 20} /></button>
            <button title="Next Annotation" onClick={() => annotator?.player.seekToNextAnnotation()} className={`${isMobile ? 'h-9 w-9' : 'h-11 w-11'} flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors`}><SkipForward size={isMobile ? 18 : 20} /></button>

            <button
                title="Toggle Loop"
                onClick={(e) => {
                    const v = annotator?.['videoElement'];
                    if (v) {
                        v.loop = !v.loop;
                        (e.currentTarget as HTMLElement).dataset.active = v.loop ? 'true' : 'false';
                    }
                }}
                className={`${isMobile ? 'h-9 w-9' : 'h-11 w-11'} flex items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors data-[active=true]:text-blue-400`}
            >
                <Repeat size={isMobile ? 18 : 20} />
            </button>
        </div>
    );

    const VolumeAndTimecode = (
        <div className={`flex items-center gap-1 ${isMobile ? 'h-9' : 'h-11'} ${isMobile ? '' : 'ml-2'}`}>
            {/* Volume */}
            <div className={`relative group flex items-center justify-center ${isMobile ? 'h-9 w-9' : 'h-11 w-11'} rounded-lg hover:bg-gray-700 transition-colors`}>
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
                    {state?.volume === 0 ? <VolumeX size={isMobile ? 18 : 20} /> : <Volume2 size={isMobile ? 18 : 20} />}
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
                className={`${isMobile ? 'h-9 min-w-[60px] text-[10px]' : 'h-11 min-w-[80px] text-xs'} px-2 font-mono text-right hover:text-blue-400 transition-colors flex items-center justify-center`}
            >
                {useTimecode
                    ? Player.frameToTimecode(state?.currentFrame || 0, state?.fps || 24)
                    : `${state?.currentFrame} / ${totalFrames}`
                }
            </button>
        </div>
    );

    // -- Final Layout --

    if (isMobile) {
        return (
            <div className="bg-gray-900 border-t border-gray-800 flex flex-col px-1 py-0.5 shrink-0 z-20 w-full transition-all">
                {Timeline}
                <div className="flex items-center justify-center gap-2 w-full">
                    {PlaybackControls}
                    {VolumeAndTimecode}
                </div>
            </div>
        );
    }

    // Desktop
    return (
        <div className="bg-gray-900 border-t border-gray-800 flex items-center px-1 py-1 gap-1 shrink-0 z-20 h-14 justify-between transition-all">
            {PlaybackControls}
            {Timeline}
            {VolumeAndTimecode}
        </div>
    );
};
