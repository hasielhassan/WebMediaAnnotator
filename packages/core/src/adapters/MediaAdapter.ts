export interface MediaInfo {
    name: string;
    type: string; // MIME type
    size: number;
    dimensions?: { width: number; height: number };
}

export interface MediaAdapter {
    /**
     * Unique identifier for the adapter (e.g., 'native-video', 'ffmpeg', 'heic')
     */
    id: string;

    /**
     * The type of media this adapter produces
     */
    type: 'video' | 'image';

    /**
     * Checks if this adapter can handle the given file
     */
    canHandle(file: File): Promise<boolean>;

    /**
     * Loads the file and returns a ready-to-use HTML element
     */
    load(file: File, onProgress?: (progress: number) => void): Promise<HTMLVideoElement | HTMLImageElement | HTMLCanvasElement>;

    /**
     * Optional: Release resources (revoke URLs, destroy workers)
     */
    destroy?(): void;
}
