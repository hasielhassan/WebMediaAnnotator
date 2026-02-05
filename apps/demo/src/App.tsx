/*
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { Annotator } from '@web-media-annotator/react';
import { PolyLinePlugin } from '@web-media-annotator/core';

function App() {
    return (
        <div className="w-screen h-screen flex flex-col bg-gray-950 overflow-hidden">
            {/* Header - Hidden on very small screens to maximize space */}
            <header className="p-4 flex items-center justify-between shrink-0 hidden lg:flex">
                <h1 className="text-xl font-bold text-white">Web Media Annotator Demo</h1>
                <div className="text-sm text-gray-500">v0.1.0</div>
            </header>

            {/* Main Content Area - Maximized */}
            <main className="flex-1 relative w-full h-full flex flex-col items-center justify-center p-0 lg:p-4 xl:p-6">
                <div className="w-full h-full lg:w-full lg:h-full lg:max-w-6xl lg:aspect-video aspect-[9/16] lg:aspect-auto border-0 lg:border border-gray-800 lg:rounded-lg overflow-hidden shadow-2xl bg-black relative">
                    <Annotator
                        src="/mov_bbb.mp4"
                        fps={24}
                        startFrame={1001}
                        className="w-full h-full absolute inset-0"
                        onReady={(core) => {
                            core.plugins.register(PolyLinePlugin);
                        }}
                    />
                </div>
            </main>

            {/* Footer / Instructions - Hidden on mobile */}
            <p className="hidden lg:block text-center p-4 text-gray-500 text-sm shrink-0">
                Tools: Select (S), Pencil (P), Shape (Q/C/A). Controls: Space (Play/Pause), Arrows (Frame Step).
            </p>
        </div>
    );
}

export default App;
