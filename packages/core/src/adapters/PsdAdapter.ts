import { MediaAdapter } from './MediaAdapter';

export class PsdAdapter implements MediaAdapter {
    id = 'psd';
    type: 'video' | 'image' = 'image';

    async canHandle(file: File): Promise<boolean> {
        const name = file.name.toLowerCase();
        return /\.(psd|psb)$/.test(name);
    }

    async load(file: File, onProgress?: (progress: number) => void): Promise<HTMLImageElement> {
        const { readPsd } = await import('ag-psd');

        const buffer = await file.arrayBuffer();
        const psd = readPsd(buffer); // Read metadata only if optimized, but here we need content

        const canvas = document.createElement('canvas');
        canvas.width = psd.width;
        canvas.height = psd.height;
        const ctx = canvas.getContext('2d');

        if (ctx && psd.canvas) {
            ctx.drawImage(psd.canvas, 0, 0);
        } else {
            // If ag-psd didn't pre-render a canvas (depends on options), try rendering
            // Currently ag-psd 'readPsd' returns a structure that usually contains canvas if not skipping composite
            // But 'readPsd' by default reads everything.
            // If 'canvas' is missing, improvements needed, but typically it returns one.
            if (!psd.canvas) throw new Error("PSD parsing failed to produce a valid image");

            ctx?.drawImage(psd.canvas, 0, 0);
        }

        const url = canvas.toDataURL('image/png');

        const img = new Image();
        return new Promise((resolve, reject) => {
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Failed to load PSD image"));
            img.src = url;
        });
    }
}
