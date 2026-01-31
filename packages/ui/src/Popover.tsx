import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

interface PopoverProps {
    trigger: React.ReactNode;
    content: React.ReactNode;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    side?: 'right' | 'left' | 'top' | 'bottom';
    align?: 'start' | 'center' | 'end';
}

export const Popover: React.FC<PopoverProps> = ({ trigger, content, isOpen: controlledOpen, onOpenChange, side = 'right', align = 'start' }) => {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
    const ref = useRef<HTMLDivElement>(null);

    const toggle = () => {
        const newState = !isOpen;
        if (!isControlled) setUncontrolledOpen(newState);
        onOpenChange?.(newState);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                if (!isControlled) setUncontrolledOpen(false);
                onOpenChange?.(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, isControlled, onOpenChange]);

    return (
        <div className="relative" ref={ref}>
            <div onClick={toggle} className="cursor-pointer">
                {trigger}
            </div>
            {isOpen && (
                <div
                    className={clsx(
                        "absolute z-50 bg-gray-900 border border-gray-700 rounded shadow-xl p-4 min-w-[200px]",
                        side === 'right' && "left-full top-0 ml-2",
                        side === 'left' && "right-full top-0 mr-2",

                        // Bottom & Top Logic
                        side === 'bottom' && "top-full mt-2",
                        side === 'top' && "bottom-full mb-2",

                        // Alignment for Bottom/Top
                        (side === 'bottom' || side === 'top') && align === 'start' && "left-0",
                        (side === 'bottom' || side === 'top') && align === 'center' && "left-1/2 -translate-x-1/2",
                        (side === 'bottom' || side === 'top') && align === 'end' && "right-0"
                    )}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    {content}
                </div>
            )}
        </div>
    );
};
