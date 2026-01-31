import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

interface PopoverProps {
    trigger: React.ReactNode;
    content: React.ReactNode;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    side?: 'right' | 'left' | 'top' | 'bottom';
}

export const Popover: React.FC<PopoverProps> = ({ trigger, content, isOpen: controlledOpen, onOpenChange, side = 'right' }) => {
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
                        side === 'bottom' && "top-full left-0 mt-2",
                        side === 'top' && "bottom-full left-0 mb-2"
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
