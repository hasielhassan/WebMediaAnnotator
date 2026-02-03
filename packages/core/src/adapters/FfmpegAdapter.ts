import { MediaAdapter } from './MediaAdapter';

export class FfmpegAdapter implements MediaAdapter {
    id = 'ffmpeg';
    type: 'video' | 'image' = 'video';
    private ffmpeg: any = null;

    async canHandle(file: File): Promise<boolean> {
        const type = file.type;
        const name = file.name.toLowerCase();

        // Formats that browsers often struggle with or don't support
        // MKV, AVI, MOV (codec dep), WMV, FLV
        const complexFormats = /\.(mkv|avi|mov|wmv|flv|ts|mts)$/.test(name);

        return complexFormats;
    }

    async load(file: File, onProgress?: (progress: number) => void): Promise<HTMLVideoElement> {
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const { toBlobURL, fetchFile } = await import('@ffmpeg/util');

        if (!this.ffmpeg) {
            this.ffmpeg = new FFmpeg();
            // Use local assets to satisfy COOP/COEP (SharedArrayBuffer) requirements
            // These files must be served from the same origin or with correct CORP headers
            const baseURL = '.';

            try {
                // Determine if we are on file:// protocol
                if (window.location.protocol === 'file:') {
                    throw new Error("Local server required.");
                }

                console.log(`[FfmpegAdapter] BaseURL: ${baseURL}`);
                console.log(`[FfmpegAdapter] Fetching core from: ${baseURL}/ffmpeg-core.js`);

                // Fetch as Blobs to avoid relative path resolution issues from within chunks
                const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
                const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');

                console.log(`[FfmpegAdapter] Blob URLs created. Core: ${coreURL.slice(0, 50)}... Wasm: ${wasmURL.slice(0, 50)}...`);

                await this.ffmpeg.load({
                    coreURL: coreURL,
                    wasmURL: wasmURL,
                });
            } catch (e: any) {
                console.error("FFmpeg load failed:", e);
                if (window.location.protocol === 'file:') {
                    throw new Error("Advanced video support (.mov) requires running on a local server (http://localhost) due to browser security restrictions on 'file://' protocol. Please use 'npx serve' or similar.");
                }
                throw e;
            }
        }

        const inputName = 'input.' + file.name.split('.').pop();
        const outputName = 'output.mp4';

        await this.ffmpeg.writeFile(inputName, await fetchFile(file));

        // Transcode to MP4 (H.264/AAC) - fast preset for speed
        this.ffmpeg.on('progress', ({ progress, time }: { progress: number, time: number }) => {
            console.log(`FFmpeg Progress: ${(progress * 100).toFixed(1)}%`);
            if (onProgress) onProgress(progress);
        });

        this.ffmpeg.on('log', ({ message }: { message: string }) => {
            console.log('FFmpeg Log:', message);
        });

        console.log("Starting FFmpeg transcoding...");
        await this.ffmpeg.exec(['-i', inputName, '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', outputName]);

        console.log("FFmpeg transcoding complete.");

        const data = await this.ffmpeg.readFile(outputName);
        const blob = new Blob([data], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        console.log("Generated Video URL:", url);

        const video = document.createElement('video');
        return new Promise((resolve, reject) => {
            video.onloadedmetadata = () => {
                console.log("Video metadata loaded. Dimensions:", video.videoWidth, "x", video.videoHeight, "Duration:", video.duration);
                resolve(video);
            };
            video.onerror = (e) => {
                console.error("Video element error:", e);
                reject(new Error("Failed to load transcoded video"));
            };
            video.src = url;
            video.playsInline = true;
            video.muted = true;
        });
    }

    destroy() {
        // Cleanup if necessary
    }
}
