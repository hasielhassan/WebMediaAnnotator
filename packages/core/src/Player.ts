import { Store } from './Store';

export class Player {
    private mediaElement: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
    private store: Store;
    private animationFrameId: number | null = null;

    constructor(store: Store, mediaElement: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) {
        this.store = store;
        this.mediaElement = mediaElement;

        this.initListeners();
    }

    setMediaElement(newElement: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) {
        // Cleanup old listeners if any
        // Since we didn't store listener refs, we rely on GC if element is removed from DOM/Refs
        // But for cleaner architecture, we should probably remove listeners. 
        // For now, assuming old element is destroyed/detached.

        this.mediaElement = newElement;

        // Reset Audio Buffer (fix for preload timing)
        this.audioBuffer = null;

        this.initListeners();
    }

    private initListeners() {
        if (this.mediaElement.tagName === 'IMG') {
            // Image Mode: Static duration
            // Delay slightly to ensure store is ready if needed, or just set immediately
            setTimeout(() => {
                this.store.setState({
                    duration: 0, // 1 frame effectively
                    isPlaying: false
                });
            }, 0);
            return;
        }

        // Video or Canvas(GIF)
        const playable = this.mediaElement as any;

        const updateDuration = () => {
            if (playable.duration) {
                this.store.setState({ duration: playable.duration });
            }
        };

        const updateBuffer = () => {
            if (playable.buffered) {
                const buffered: { start: number; end: number }[] = [];
                for (let i = 0; i < playable.buffered.length; i++) {
                    buffered.push({
                        start: playable.buffered.start(i),
                        end: playable.buffered.end(i)
                    });
                }
                this.store.setState({ buffered });
            }
        };

        playable.addEventListener('loadedmetadata', updateDuration);
        playable.addEventListener('progress', updateBuffer);

        // Also call immediately if metadata already loaded (e.g. GIF)
        if (playable.duration) updateDuration();
        updateBuffer(); // Initial buffer check

        playable.addEventListener('timeupdate', () => {
            // Only update if not seeking to avoid loops
            const currentTime = playable.currentTime;
            const fps = this.store.getState().fps;
            const currentFrame = Math.round(currentTime * fps);

            this.store.setState({
                currentTime,
                currentFrame
            });
        });

        playable.addEventListener('play', () => {
            this.store.setState({ isPlaying: true });
            this.startLoop();

            // Resume Audio Context if needed
            if (this.audioContext?.state === 'suspended') {
                this.audioContext.resume();
            }
            // Ensure audio is initialized for scrubbing
            if (!this.audioBuffer) {
                this.initAudio();
            }
        });

        playable.addEventListener('pause', () => {
            this.store.setState({ isPlaying: false });
            this.stopLoop();
        });

        // Sync initial volume
        const state = this.store.getState();
        playable.volume = state.volume;
        playable.muted = false; // Ensure unmuted by default

        // Try to init audio for scrubbing immediately (might stay suspended until click)
        if (!this.audioBuffer) {
            // Delay slightly to not block main thread during heavy load
            setTimeout(() => this.initAudio(), 1000);
        }
    }

    private startLoop() {
        // Main loop for precise updates if needed
    }

    private stopLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    // Audio Scrubbing
    private audioContext: AudioContext | null = null;
    private audioBuffer: AudioBuffer | null = null;
    private isScrubbing = false;

    private async initAudio() {
        if (this.audioBuffer) return; // Already initialized for this media

        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        // Load audio from video src
        if (this.mediaElement instanceof HTMLVideoElement) {
            try {
                console.log("[Core] Initializing Audio Scrubbing Buffer...");
                let arrayBuffer: ArrayBuffer;

                if ((this.mediaElement as any).__rawFile) {
                    // Fast path: direct file access (bypasses SW/fetch issues)
                    const file = (this.mediaElement as any).__rawFile as File;
                    console.log(`[Core] Reading audio from attached File object (${file.name})...`);
                    arrayBuffer = await file.arrayBuffer();
                } else if (this.mediaElement.src) {
                    // Fallback: fetch via URL (might be blob: or http:)
                    console.log(`[Core] Fetching audio from URL (${this.mediaElement.src})...`);
                    const response = await fetch(this.mediaElement.src);
                    arrayBuffer = await response.arrayBuffer();
                } else {
                    return;
                }

                this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                console.log("[Core] Audio Scrubbing Ready.");
            } catch (e) {
                console.error("[Core] Failed to load audio for scrubbing:", e);
                // Suppress audio decode error for now, as it blocks clean console output for debugging
            }
        }
    }

    // Play a snippet of audio at the current time (for scrubbing)
    private playScrubAudio() {
        if (!this.audioContext || !this.audioBuffer || this.store.getState().isPlaying) return;
        if (!(this.mediaElement instanceof HTMLVideoElement)) return;

        // Check volume/mute
        const volume = this.mediaElement.muted ? 0 : this.mediaElement.volume;
        if (volume <= 0.01) return; // Silent, don't play

        // Simple "tape" effect: play small chunk
        const time = this.mediaElement.currentTime;
        const duration = 0.1; // 100ms snippet

        const source = this.audioContext.createBufferSource();
        source.buffer = this.audioBuffer;

        // Create GainNode for volume control
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume;

        // Connect: Source -> Gain -> Destination
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        source.start(this.audioContext.currentTime, time, duration);
    }

    // Public API //

    play() {
        const playable = this.mediaElement as any;
        if (typeof playable.play === 'function') {
            playable.play();
        } else {
            // Image mode fallback
            this.store.setState({ isPlaying: true });
        }
    }

    pause() {
        const playable = this.mediaElement as any;
        if (typeof playable.pause === 'function') {
            playable.pause();
        } else {
            this.store.setState({ isPlaying: false });
        }
    }

    seekToFrame(frame: number) {
        const fps = this.store.getState().fps;
        const time = frame / fps;

        const playable = this.mediaElement as any;
        // Check if writable currentTime (Video or GiftAdapter)
        if ('currentTime' in playable) {
            playable.currentTime = time;
        }

        this.store.setState({ currentFrame: frame, currentTime: time });

        // Trigger scrub sound
        if (this.audioBuffer) this.playScrubAudio();
        // else this.initAudio(); // Avoid auto-init on seek for perf/noise
    }

    seekToNextAnnotation() {
        const state = this.store.getState();
        const currentFrame = state.currentFrame;
        const future = state.annotations
            .map(a => a.frame)
            .filter(f => f > currentFrame)
            .sort((a, b) => a - b);

        if (future.length > 0) {
            this.seekToFrame(future[0]);
        }
    }

    seekToPrevAnnotation() {
        const state = this.store.getState();
        const currentFrame = state.currentFrame;
        const past = state.annotations
            .map(a => a.frame)
            .filter(f => f < currentFrame)
            .sort((a, b) => b - a);

        if (past.length > 0) {
            this.seekToFrame(past[0]);
        }
    }

    // Timecode Utilities //

    static frameToTimecode(frame: number, fps: number, startFrame: number = 0): string {
        const absoluteFrame = frame + startFrame;
        const totalSeconds = Math.floor(absoluteFrame / fps);
        const f = Math.floor(absoluteFrame % fps);
        const s = Math.floor(totalSeconds % 60);
        const m = Math.floor((totalSeconds / 60) % 60);
        const h = Math.floor(totalSeconds / 3600);

        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
    }

    static timecodeToFrame(timecode: string, fps: number, startFrame: number = 0): number {
        const parts = timecode.split(':').map(Number);
        if (parts.length !== 4) return 0;
        const [h, m, s, f] = parts;
        const totalFrames = ((h * 3600) + (m * 60) + s) * fps + f;
        return totalFrames - startFrame;
    }
}
