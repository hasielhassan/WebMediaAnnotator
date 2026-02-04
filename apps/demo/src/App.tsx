/*
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { Annotator } from '@web-media-annotator/react';

function App() {
    return (
        <div className="w-screen h-screen flex flex-col items-center justify-center p-8 bg-gray-950">
            <h1 className="text-2xl font-bold mb-4">Web Media Annotator Demo</h1>

            <div className="w-full max-w-5xl aspect-video border border-gray-800 rounded-lg overflow-hidden shadow-2xl">
                <Annotator
                    src="./mov_bbb.mp4"
                    fps={24}
                    startFrame={1001} // Example offset
                />
            </div>

            <p className="mt-4 text-gray-500">
                Try drawing! Tools: Select, Pencil, Square, Circle, Arrow.
                <br />
                Play/Pause and Scrub the timeline.
            </p>
        </div>
    );
}

export default App;
