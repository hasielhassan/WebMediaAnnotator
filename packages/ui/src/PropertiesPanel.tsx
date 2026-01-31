import React from 'react';
import { clsx } from 'clsx';
import { AppState } from '@web-media-annotator/core';

export interface PropertiesPanelProps {
    state: AppState;
    onColorChange: (color: string) => void;
    onWidthChange: (width: number) => void;
    className?: string;
}

const COLORS = [
    '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF',
    '#FFFFFF', '#000000', '#F5f5f5', '#333333'
];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    state, onColorChange, onWidthChange, className
}) => {
    return (
        <div className={clsx("flex flex-col gap-4 p-4 bg-gray-900 border-l border-gray-800 text-sm w-64", className)}>
            <div className="flex flex-col gap-2">
                <label className="font-semibold text-gray-400 uppercase text-xs">Stroke Color</label>
                <div className="grid grid-cols-5 gap-2">
                    {COLORS.map(color => (
                        <button
                            key={color}
                            className={clsx(
                                "w-6 h-6 rounded-full border border-gray-700 hover:scale-110 transition-transform",
                                state.activeColor === color && "ring-2 ring-white"
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => onColorChange(color)}
                        />
                    ))}
                    {/* Custom Picker */}
                    <label className="relative w-6 h-6 cursor-pointer">
                        <input
                            type="color"
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                            value={state.activeColor}
                            onChange={(e) => onColorChange(e.target.value)}
                        />
                        <div
                            className="w-full h-full rounded-full border border-gray-700 bg-gradient-to-br from-red-500 via-green-500 to-blue-500"
                        />
                    </label>
                </div>
            </div>

            <div className="h-px bg-gray-800" />

            <div className="flex flex-col gap-2">
                <label className="font-semibold text-gray-400 uppercase text-xs">
                    Stroke Width: {state.activeStrokeWidth}px
                </label>
                <input
                    type="range"
                    min="1"
                    max="20"
                    value={state.activeStrokeWidth}
                    onChange={(e) => onWidthChange(Number(e.target.value))}
                    className="w-full accent-blue-600"
                />
            </div>

            <div className="h-px bg-gray-800" />

            {/* Selected Annotation Info */}
            {state.selectedAnnotationId && (
                <div className="bg-gray-800 p-2 rounded">
                    <span className="text-xs text-gray-400 block mb-1">Selection</span>
                    <div className="text-xs break-all font-mono opacity-70">
                        ID: {state.selectedAnnotationId.slice(0, 8)}...
                    </div>
                </div>
            )}
        </div>
    );
};
