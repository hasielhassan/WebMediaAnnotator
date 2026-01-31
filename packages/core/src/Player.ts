import { Store } from './Store';

export class Player {
    private videoElement: HTMLVideoElement;
    private store: Store;
    private animationFrameId: number | null = null;

    constructor(store: Store, videoElement: HTMLVideoElement) {
        this.store = store;
        this.videoElement = videoElement;

        this.initListeners();
    }

    private initListeners() {
        this.videoElement.addEventListener('loadedmetadata', () => {
            this.store.setState({
                duration: this.videoElement.duration
            });
        });

        this.videoElement.addEventListener('timeupdate', () => {
            // Only update if not seeking to avoid loops
            const currentTime = this.videoElement.currentTime;
            const fps = this.store.getState().fps;
            const currentFrame = Math.round(currentTime * fps);

            this.store.setState({
                currentTime,
                currentFrame
            });
        });

        this.videoElement.addEventListener('play', () => {
            this.store.setState({ isPlaying: true });
            this.startLoop();
        });

        this.videoElement.addEventListener('pause', () => {
            this.store.setState({ isPlaying: false });
            this.stopLoop();
        });
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
        if (this.audioContext) return;
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Load audio from video src
        if (this.videoElement.src) {
            try {
                const response = await fetch(this.videoElement.src);
                const arrayBuffer = await response.arrayBuffer();
                this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            } catch (e) {
                console.error("Failed to load audio for scrubbing", e);
            }
        }
    }

    // Play a snippet of audio at the current time (for scrubbing)
    private playScrubAudio() {
        if (!this.audioContext || !this.audioBuffer || this.store.getState().isPlaying) return;

        // Check volume/mute
        const volume = this.videoElement.muted ? 0 : this.videoElement.volume;
        if (volume <= 0.01) return; // Silent, don't play

        // Simple "tape" effect: play small chunk
        const time = this.videoElement.currentTime;
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
        this.videoElement.play();
    }

    pause() {
        this.videoElement.pause();
    }

    seekToFrame(frame: number) {
        const fps = this.store.getState().fps;
        const time = frame / fps;
        this.videoElement.currentTime = time;
        this.store.setState({ currentFrame: frame, currentTime: time });

        // Trigger scrub sound
        if (this.audioBuffer) this.playScrubAudio();
        else this.initAudio(); // Try init if not ready
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
