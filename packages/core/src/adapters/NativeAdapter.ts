import { MediaAdapter } from './MediaAdapter';

export class NativeAdapter implements MediaAdapter {
    id = 'native';
    type: 'video' | 'image' = 'video'; // Default, changes based on file

    async canHandle(file: File): Promise<boolean> {
        // Basic MIME type check for native browser support
        const type = file.type;
        const name = file.name.toLowerCase();

        const isVideo = (type.startsWith('video/') && !type.includes('quicktime') && !name.endsWith('.mov')) || /\.(mp4|webm|ogg)$/.test(name);
        // Exclude .mov from NativeAdapter to ensure FfmpegAdapter handles complex MOVs (like MJPEG)
        const isImage = type.startsWith('image/') && !type.includes('gif') || /\.(png|jpg|jpeg|webp|bmp|svg)$/.test(name);

        return isVideo || isImage;
    }

    async load(file: File, _onProgress?: (progress: number) => void): Promise<HTMLVideoElement | HTMLImageElement> {
        const type = file.type;
        const name = file.name.toLowerCase();

        // Strict Image detection (MIME or Extension)
        // Note: Some browsers report empty MIME for local files, so extension is fallback
        const isImage =
            type.startsWith('image/') ||
            /\.(png|jpg|jpeg|webp|bmp|svg)$/.test(name);

        this.type = isImage ? 'image' : 'video';

        const url = URL.createObjectURL(file);

        if (this.type === 'image') {
            const img = new Image();
            return new Promise((resolve, reject) => {
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error("Failed to load image"));
                img.src = url;
            });
        } else {
            const video = document.createElement('video');
            return new Promise((resolve, reject) => {
                video.onloadedmetadata = () => resolve(video);
                video.onerror = () => reject(new Error("Failed to load video"));
                video.src = url;
                // Important for cross-browser
                video.playsInline = true;
                video.muted = true; // Auto-play policies often require mute
                (video as unknown as { __rawFile: File }).__rawFile = file; // Attach for direct access (e.g. AudioContext)
            });
        }
    }
}
