import { useState } from 'react';
import { WebMediaAnnotator, AppState, MediaRegistry } from '@web-media-annotator/core';

export function useMediaIO(annotator: WebMediaAnnotator | null, state: AppState | null) {
    const [exportProgress, setExportProgress] = useState<{ current: number, total: number } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState<number | null>(null); // 0-1

    const handleExport = async (composite: boolean) => {
        if (!annotator || !state) return;
        const dataUrl = await annotator.renderer.captureFrame({ composite, mediaElement: (annotator as unknown as { mediaElement: HTMLVideoElement }).mediaElement });
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `frame_${state.currentFrame}_${composite ? 'comp' : 'anno'}.png`;
        a.click();
    };

    const handleBulkExport = async (composite: boolean) => {
        if (!annotator) return;
        try {
            const blob = await annotator.exportAnnotatedFrames(composite, (current, total) => {
                setExportProgress({ current, total });
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `annotations_export_${composite ? 'burned' : 'clean'}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: unknown) {
            console.error("Export failed", err);
            if (err instanceof Error) alert("Export failed: " + err.message);
        } finally {
            setExportProgress(null);
        }
    };

    const handleSave = () => {
        if (!annotator) return;
        const json = JSON.stringify(annotator.store.getState().annotations, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'annotations.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!annotator || !e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];

        setIsLoading(true);

        // Check extension
        if (file.name.toLowerCase().endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const annotations = JSON.parse(ev.target?.result as string);
                    if (Array.isArray(annotations)) {
                        annotator.store.setState({ annotations });
                        annotator.store.captureSnapshot();
                    }
                } catch (err) {
                    console.error("Invalid JSON", err);
                    alert("Failed to load JSON");
                } finally {
                    setIsLoading(false);
                }
            };
            reader.readAsText(file);
        } else {
            // Assume Media
            try {
                setLoadingProgress(0);
                await annotator.loadMedia(file, (p: number) => {
                    setLoadingProgress(p);
                });
                if (confirm("Clear existing annotations for new media?")) {
                    annotator.store.setState({ annotations: [] });
                }
            } catch (err: unknown) {
                console.error("Failed to load media", err);
                const msg = err instanceof Error ? err.message : String(err);
                alert("Failed to load media: " + msg);
            } finally {
                setIsLoading(false);
                setLoadingProgress(null);
            }
        }
    };

    return {
        exportProgress,
        isLoading,
        loadingProgress,
        handleExport,
        handleBulkExport,
        handleSave,
        handleLoad
    };
}
