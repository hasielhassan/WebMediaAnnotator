import { MediaAdapter } from './MediaAdapter';

export class HeicAdapter implements MediaAdapter {
    id = 'heic';
    type: 'video' | 'image' = 'image';

    async canHandle(file: File): Promise<boolean> {
        const name = file.name.toLowerCase();
        return /\.(heic|heif)$/.test(name);
    }

    async load(file: File, onProgress?: (progress: number) => void): Promise<HTMLImageElement> {
        // Dynamic import
        const heic2any = await import('heic2any');

        // Conversion
        const resultBlob = await heic2any.default({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.8
        });

        // Handle array result (rare, for animation/burst) or single blob
        const blob = Array.isArray(resultBlob) ? resultBlob[0] : resultBlob;
        const url = URL.createObjectURL(blob);

        const img = new Image();
        return new Promise((resolve, reject) => {
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Failed to load HEIC image"));
            img.src = url;
        });
    }
}
