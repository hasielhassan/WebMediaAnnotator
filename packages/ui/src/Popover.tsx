import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    const triggerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Position State
    const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    const toggle = () => {
        const newState = !isOpen;
        if (!isControlled) setUncontrolledOpen(newState);
        onOpenChange?.(newState);
    };

    const updatePosition = () => {
        if (!triggerRef.current || !isOpen) return;

        const rect = triggerRef.current.getBoundingClientRect();
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        let top = 0;
        let left = 0;

        // Base Position relative to Trigger (No width/height calc usually needed for basic sides, but aligning might need it if we wanted to center perfectly without transform)
        // We will use transforms for alignment to keep it simple, or precise calcs if we want to avoid blur.
        // For now, let's calc the anchor point.

        if (side === 'bottom') {
            top = rect.bottom + scrollY + 8; // 8px Offset
            if (align === 'start') left = rect.left + scrollX;
            else if (align === 'center') left = rect.left + scrollX + (rect.width / 2);
            else if (align === 'end') left = rect.right + scrollX;
        } else if (side === 'top') {
            top = rect.top + scrollY - 8;
            if (align === 'start') left = rect.left + scrollX;
            else if (align === 'center') left = rect.left + scrollX + (rect.width / 2);
            else if (align === 'end') left = rect.right + scrollX;
        } else if (side === 'right') {
            left = rect.right + scrollX + 8;
            top = rect.top + scrollY; // Default align start
        } else if (side === 'left') {
            left = rect.left + scrollX - 8;
            top = rect.top + scrollY;
        }

        setCoords({ top, left });
    };

    useEffect(() => {
        if (isOpen) {
            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true); // Capture scroll
        }
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is inside Trigger or Content
            const target = event.target as Node;
            const clickedTrigger = triggerRef.current && triggerRef.current.contains(target);
            const clickedContent = contentRef.current && contentRef.current.contains(target);

            if (!clickedTrigger && !clickedContent) {
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
        <>
            <div className="relative inline-block" ref={triggerRef}>
                <div onClick={toggle} className="cursor-pointer">
                    {trigger}
                </div>
            </div>
            {isOpen && createPortal(
                <div
                    ref={contentRef}
                    style={{
                        position: 'absolute',
                        top: coords.top,
                        left: coords.left,
                        zIndex: 9999,
                    }}
                    className={clsx(
                        "bg-gray-900 border border-gray-700 rounded shadow-xl p-4 min-w-[200px]",
                        // Transform classes to handle alignment logic relative to the anchor point
                        side === 'bottom' && align === 'center' && "-translate-x-1/2",
                        side === 'bottom' && align === 'end' && "-translate-x-full",
                        side === 'top' && align === 'start' && "-translate-y-full",
                        side === 'top' && align === 'center' && "-translate-x-1/2 -translate-y-full",
                        side === 'top' && align === 'end' && "-translate-x-full -translate-y-full",

                        side === 'left' && "-translate-x-full",
                        side === 'right' && "" // Default is top-left anchor, so no transform needed usually unless aligning center vertically
                        // TODO: Add vertical center alignment for left/right if needed
                    )}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    {content}
                </div>,
                document.body
            )}
        </>
    );
};
