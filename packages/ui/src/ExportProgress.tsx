import React from 'react';
// import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export interface ExportProgressProps {
    current: number;
    total: number;
    title?: string;
}

export const ExportProgress: React.FC<ExportProgressProps> = ({ current, total, title = "Preparing Export" }) => {
    const progress = Math.round((current / total) * 100);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-8 w-80 flex flex-col items-center gap-6">
                <div className="relative">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                        {progress}%
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2 text-center">
                    <h3 className="text-white font-semibold text-lg">{title}</h3>
                    <p className="text-gray-400 text-xs">
                        Processing frame {current} of {total}
                    </p>
                </div>

                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-500 transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
};
