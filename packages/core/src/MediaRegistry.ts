import { MediaAdapter, MediaInfo } from './adapters/MediaAdapter';
import { NativeAdapter } from './adapters/NativeAdapter';

// We will dynamically import other adapters to avoid bloat
// import { FfmpegAdapter } from './adapters/FfmpegAdapter';
// import { HeicAdapter } from './adapters/HeicAdapter';
// import { PsdAdapter } from './adapters/PsdAdapter';

export class MediaRegistry {
    private adapters: MediaAdapter[] = [];

    constructor() {
        // Register default adapters
        this.register(new NativeAdapter());
    }

    register(adapter: MediaAdapter) {
        this.adapters.push(adapter);
    }

    async getAdapter(file: File): Promise<MediaAdapter> {
        // 1. Try Native first (it's sync and fast)
        const native = this.adapters.find(a => a.id === 'native');
        if (native && await native.canHandle(file)) {
            return native;
        }

        // 2. Try registered plugins
        for (const adapter of this.adapters) {
            if (adapter.id === 'native') continue;
            if (await adapter.canHandle(file)) {
                return adapter;
            }
        }

        // 3. Fallback: Check for lazy-loadable adapters based on extension
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (ext === 'gif' || file.type === 'image/gif') {
            const { GifAdapter } = await import('./adapters/GifAdapter');
            const adapter = new GifAdapter();
            this.register(adapter);
            if (await adapter.canHandle(file)) return adapter;
        }

        if (ext === 'heic' || ext === 'heif') {
            const { HeicAdapter } = await import('./adapters/HeicAdapter');
            const adapter = new HeicAdapter();
            this.register(adapter);
            if (await adapter.canHandle(file)) return adapter;
        }

        if (ext === 'psd') {
            const { PsdAdapter } = await import('./adapters/PsdAdapter');
            const adapter = new PsdAdapter();
            this.register(adapter);
            if (await adapter.canHandle(file)) return adapter;
        }

        // FFmpeg catch-all for weird video formats
        // This is expensive, so we only try it if nothing else matched and it LOOKS like video/audio
        if (
            file.type.startsWith('video/') ||
            file.type.startsWith('audio/') ||
            ['mkv', 'avi', 'mov', 'wmv', 'flv'].includes(ext || '')
        ) {
            const { FfmpegAdapter } = await import('./adapters/FfmpegAdapter');
            const adapter = new FfmpegAdapter();
            this.register(adapter);
            if (await adapter.canHandle(file)) return adapter;
        }

        throw new Error(`No suitable media adapter found for file type: ${file.type || ext}`);
    }

    async validate(file: File): Promise<MediaInfo> {
        // Basic validation
        if (file.size === 0) throw new Error("File is empty");

        const adapter = await this.getAdapter(file);

        return {
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size
        };
    }

    getSupportedTypes(): { video: string[], image: string[] } {
        return {
            video: ['video/mp4', 'video/webm', 'video/ogg', 'image/gif', '.mkv', '.avi', '.mov'],
            image: ['image/png', 'image/jpeg', 'image/webp', '.heic', '.psd']
        };
    }

    getAcceptAttribute(): string {
        const { video, image } = this.getSupportedTypes();
        return [...video, ...image].join(',');
    }
}
