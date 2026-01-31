import React from 'react';
import { MousePointer2, Pencil, Circle, Square, MoveRight, Type, Eraser, Trash2, Palette, Settings2, Ghost, Hand } from 'lucide-react';
import { clsx } from 'clsx';
import { Popover } from './Popover';

export interface ToolbarProps {
    activeTool: string;
    onToolSelect: (tool: string) => void;
    onClear?: () => void;
    className?: string;
    orientation?: 'horizontal' | 'vertical';

    // Properties
    activeColor?: string;
    onColorChange?: (color: string) => void;
    activeStrokeWidth?: number;
    onStrokeWidthChange?: (width: number) => void;

    // Onion Skin
    isOnionSkinEnabled?: boolean;
    onToggleOnionSkin?: () => void;
    onionSkinPrevFrames?: number;
    onionSkinNextFrames?: number;
    onOnionSkinSettingsChange?: (prev: number, next: number) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
    activeTool, onToolSelect, onClear, className, orientation = 'vertical',
    activeColor, onColorChange, activeStrokeWidth, onStrokeWidthChange,
    isOnionSkinEnabled, onToggleOnionSkin,
    onionSkinPrevFrames = 3, onionSkinNextFrames = 3, onOnionSkinSettingsChange
}) => {
    const tools = [
        { id: 'select', icon: MousePointer2, label: 'Select' },
        { id: 'pan', icon: Hand, label: 'Pan (Hand)' },
        { id: 'freehand', icon: Pencil, label: 'Pencil' },
        { id: 'arrow', icon: MoveRight, label: 'Arrow' },
        { id: 'circle', icon: Circle, label: 'Circle' },
        { id: 'square', icon: Square, label: 'Square' },
        { id: 'text', icon: Type, label: 'Text' },
        { id: 'eraser', icon: Eraser, label: 'Eraser' },
    ];

    const colors = ['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];

    const isHorizontal = orientation === 'horizontal';

    // Local state for popovers
    const [isGhostingOpen, setIsGhostingOpen] = React.useState(false);

    // Local state for slider values
    const [localPrevFrames, setLocalPrevFrames] = React.useState(onionSkinPrevFrames);
    const [localNextFrames, setLocalNextFrames] = React.useState(onionSkinNextFrames);

    // Sync local state with props when popover opens, but ONLY check if values differ significantly to avoid loops
    // We only want to reset local state if the prop changed from an external source (like a preset load),
    // NOT if it changed because *we* just updated it. 
    // For now, we'll just sync when the popover opens to ensure it's fresh.
    React.useEffect(() => {
        if (isGhostingOpen) {
            setLocalPrevFrames(onionSkinPrevFrames);
            setLocalNextFrames(onionSkinNextFrames);
        }
    }, [isGhostingOpen]);
    // Note: Removed [onionSkinPrevFrames, ...] from dependency because it causes the "stuck" behavior 
    // if the parent updates slower than the user drags, snapping the slider back.

    // Debounce updates to parent
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (localPrevFrames !== onionSkinPrevFrames || localNextFrames !== onionSkinNextFrames) {
                onOnionSkinSettingsChange?.(localPrevFrames, localNextFrames);
            }
        }, 500); // 500ms debounce
        return () => clearTimeout(timer);
    }, [localPrevFrames, localNextFrames, onOnionSkinSettingsChange, onionSkinPrevFrames, onionSkinNextFrames]);


    return (
        <div className={clsx(
            "flex gap-2 p-2 bg-gray-900 border-gray-800",
            isHorizontal ? "flex-row border-b items-center" : "flex-col border-r",
            className
        )}>
            {tools.map(tool => (
                <button
                    key={tool.id}
                    title={tool.label}
                    onClick={() => onToolSelect(tool.id)}
                    className={clsx(
                        "p-2 rounded hover:bg-gray-700 text-white transition-colors",
                        activeTool === tool.id ? "bg-blue-600 hover:bg-blue-500" : "bg-transparent"
                    )}
                >
                    <tool.icon size={20} />
                </button>
            ))}

            <div className={clsx("bg-gray-700", isHorizontal ? "w-px h-6 mx-1" : "h-px w-full my-1")} />

            {/* Onion Skin Popover */}
            <Popover
                side={isHorizontal ? "bottom" : "right"}
                isOpen={isGhostingOpen}
                onOpenChange={setIsGhostingOpen}
                trigger={
                    <button
                        title="Onion Skin (Ghosting)"
                        className={clsx(
                            "p-2 rounded hover:bg-gray-700 text-white transition-colors relative",
                            isOnionSkinEnabled ? "bg-purple-600 hover:bg-purple-500" : "bg-transparent"
                        )}
                    >
                        <Ghost size={20} />
                        {isOnionSkinEnabled && (
                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                        )}
                    </button>
                }
                content={
                    <div className="w-52 p-2 flex flex-col gap-3">
                        <style>{`
                            .styled-range::-webkit-slider-thumb {
                                -webkit-appearance: none;
                                appearance: none;
                                width: 14px;
                                height: 14px;
                                border-radius: 50%;
                                background: #ffffff;
                                cursor: pointer;
                                margin-top: -5px; /* Centers thumb on h-1 track */
                                box-shadow: 0 1px 3px rgba(0,0,0,0.5);
                            }
                            .styled-range::-moz-range-thumb {
                                width: 14px;
                                height: 14px;
                                border-radius: 50%;
                                background: #ffffff;
                                cursor: pointer;
                                border: none;
                                box-shadow: 0 1px 3px rgba(0,0,0,0.5);
                            }
                            /* Firefox track alignment fix */
                            .styled-range::-moz-range-track {
                                height: 4px;
                                background-color: currentColor;
                                border-radius: 9999px;
                            }
                        `}</style>
                        <div className="flex items-center justify-between pb-2 border-b border-gray-700">
                            <span className="text-sm font-medium text-white">Ghosting</span>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleOnionSkin?.();
                                }}
                                className={clsx("w-8 h-4 rounded-full cursor-pointer relative transition-colors border-none outline-none focus:ring-2 ring-gray-600", isOnionSkinEnabled ? "bg-green-500" : "bg-gray-600")}
                            >
                                <div className={clsx("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow-sm", isOnionSkinEnabled ? "left-4.5" : "left-0.5")} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-red-300 font-medium">Past Frames: {localPrevFrames}</span>
                            <input
                                type="range" min="0" max="10" step="1"
                                value={localPrevFrames}
                                // Stop propagation to prevent popover closing
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                    setLocalPrevFrames(parseInt(e.target.value));
                                }}
                                className="styled-range w-full h-1 bg-red-900/50 rounded-lg appearance-none cursor-pointer text-red-900"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-green-300 font-medium">Future Frames: {localNextFrames}</span>
                            <input
                                type="range" min="0" max="10" step="1"
                                value={localNextFrames}
                                // Stop propagation to prevent popover closing
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                    setLocalNextFrames(parseInt(e.target.value));
                                }}
                                className="styled-range w-full h-1 bg-green-900/50 rounded-lg appearance-none cursor-pointer text-green-900"
                            />
                        </div>
                    </div>
                }
            />

            <div className={clsx("bg-gray-700", isHorizontal ? "w-px h-6 mx-1" : "h-px w-full my-1")} />

            {/* Color Popover */}
            <Popover
                side={isHorizontal ? "bottom" : "right"}
                trigger={
                    <button
                        title="Stroke Color"
                        className="relative p-2 rounded hover:bg-gray-700 transition-colors w-10 h-10 flex items-center justify-center"
                    >
                        <div
                            className="w-6 h-6 rounded-full border border-gray-400"
                            style={{ backgroundColor: activeColor }}
                        />
                    </button>
                }
                content={
                    <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-4 gap-2">
                            {colors.map(c => (
                                <button
                                    key={c}
                                    onClick={() => onColorChange?.(c)}
                                    className={clsx(
                                        "w-6 h-6 rounded-full border border-gray-600",
                                        activeColor === c && "ring-2 ring-white"
                                    )}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                            {/* Custom Color Input */}
                            <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-600">
                                <input
                                    type="color"
                                    value={activeColor}
                                    onChange={(e) => onColorChange?.(e.target.value)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-blue-500 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                }
            />

            {/* Stroke Width Popover */}
            <Popover
                side={isHorizontal ? "bottom" : "right"}
                trigger={
                    <button
                        title="Stroke Width / Text Size"
                        className="p-2 rounded hover:bg-gray-700 text-white transition-colors flex items-center justify-center font-bold text-xs w-10 h-10"
                    >
                        {activeStrokeWidth}px
                    </button>
                }
                content={
                    <div className="w-48">
                        <span className="text-xs text-gray-400 mb-2 block">Stroke / Text Size: {activeStrokeWidth}px</span>
                        <input
                            type="range"
                            min="1" max="20"
                            value={activeStrokeWidth}
                            onChange={(e) => onStrokeWidthChange?.(parseInt(e.target.value))}
                            className="w-full"
                        />
                    </div>
                }
            />

            {/* Spacer for horizontal layout to push content if needed, or caller handles it */}
            <div className="flex-1" />

            {onClear && (
                <button
                    title="Clear All"
                    onClick={onClear}
                    className="p-2 rounded hover:bg-red-900/50 text-red-400 transition-colors"
                >
                    <Trash2 size={20} />
                </button>
            )}
        </div>
    );
};
