import React from 'react';
import { WebMediaAnnotator, AppState } from '@web-media-annotator/core';
import { Toolbar } from '@web-media-annotator/ui';

export interface AnnotatorToolbarProps {
    annotator: WebMediaAnnotator | null;
    state: AppState | null;
    className?: string;
    orientation?: 'horizontal' | 'vertical';
    isMobile?: boolean;
    children?: React.ReactNode;
}

export const AnnotatorToolbar: React.FC<AnnotatorToolbarProps> = ({
    annotator,
    state,
    className,
    orientation = 'horizontal',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isMobile = false,
    children
}) => {
    // Handlers
    const handleToolSelect = (tool: string) => annotator?.store.setState({ activeTool: tool as AppState['activeTool'], selectedAnnotationIds: [] });
    const handleColorChange = (color: string) => annotator?.store.setState({ activeColor: color });
    const handleWidthChange = (width: number) => annotator?.store.setState({ activeStrokeWidth: width });

    const handleDefaultDurationChange = (d: number) => annotator?.store.setState({ defaultDuration: d });
    const handleHoldDurationChange = (d: number) => {
        if (d > 1) {
            annotator?.store.setState({ holdDuration: d, isOnionSkinEnabled: false });
        } else {
            annotator?.store.setState({ holdDuration: d });
        }
    };

    const handleToggleOnionSkin = () => {
        const nextState = !state?.isOnionSkinEnabled;
        if (nextState) {
            annotator?.store.setState({ isOnionSkinEnabled: true, holdDuration: 1 });
        } else {
            annotator?.store.setState({ isOnionSkinEnabled: false });
        }
    };

    const handleOnionSkinSettingsChange = (prev: number, next: number) =>
        annotator?.store.setState({ onionSkinPrevFrames: prev, onionSkinNextFrames: next });

    return (
        <Toolbar
            orientation={orientation}
            className={className}
            activeTool={state?.activeTool || 'select'}
            onToolSelect={handleToolSelect}
            activeColor={state?.activeColor}
            onColorChange={handleColorChange}
            activeStrokeWidth={state?.activeStrokeWidth}
            onStrokeWidthChange={handleWidthChange}

            defaultDuration={state?.defaultDuration || 1}
            onDefaultDurationChange={handleDefaultDurationChange}

            holdDuration={state?.holdDuration || 1}
            onHoldDurationChange={handleHoldDurationChange}

            isOnionSkinEnabled={state?.isOnionSkinEnabled}
            onToggleOnionSkin={handleToggleOnionSkin}
            onionSkinPrevFrames={state?.onionSkinPrevFrames}
            onionSkinNextFrames={state?.onionSkinNextFrames}
            onOnionSkinSettingsChange={handleOnionSkinSettingsChange}
            isImageMode={(state?.mediaType as string) === 'image'}
        >
            {children}
        </Toolbar>
    );
};
