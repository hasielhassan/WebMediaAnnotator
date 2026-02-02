import React, { useEffect, useState } from 'react';
import { WebMediaAnnotator } from '@web-media-annotator/core';
import { Users, Wifi, WifiOff, Copy, Link as LinkIcon, Lock } from 'lucide-react';
import { Popover } from '@web-media-annotator/ui';

interface SyncPanelProps {
    annotator: WebMediaAnnotator | null;
}

export const SyncPanel: React.FC<SyncPanelProps> = ({ annotator }) => {
    // Core State
    const [isConnected, setIsConnected] = useState(false);
    const [peerId, setPeerId] = useState<string>('');
    const [users, setUsers] = useState<number>(0);
    const [targetId, setTargetId] = useState('');
    const [isHost, setIsHost] = useState(true);

    // User Identity State
    const [username, setUsername] = useState<string>('');
    const [userColor, setUserColor] = useState<string>('#3b82f6');
    const [connectedUsers, setConnectedUsers] = useState<any[]>([]);

    useEffect(() => {
        // Generate random user on mount
        const ANIMALS = ['Bear', 'Fox', 'Wolf', 'Eagle', 'Hawk', 'Owl', 'Lion', 'Tiger', 'Panda', 'Koala'];
        const COLORS = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Cyan', 'Magenta', 'Lime', 'Pink'];
        const rColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        const rAnimal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
        setUsername(`${rColor} ${rAnimal}`);
        // Map color name to hex? keeping simple for now or use rColor string
        // Let's rely on standard colors or simple hash if needed, but names are fine.
        setUserColor('#' + Math.floor(Math.random() * 16777215).toString(16));
    }, []);

    useEffect(() => {
        if (!annotator) return;
        const sync = annotator.sync;

        const onOpen = (id: string) => {
            setIsConnected(true);
            setPeerId(id);
            // Announce Self
            sync.announceUser({ id, name: username, color: userColor });
        };
        const onClose = () => {
            setIsConnected(false);
            setPeerId('');
            setUsers(0);
            setConnectedUsers([]);
        };
        const onUsersChanged = (usersList: any[]) => {
            setConnectedUsers(usersList);
            setUsers(usersList.length);
        };

        sync.on('ready', onOpen);
        sync.on('disconnected', onClose);
        sync.on('users:changed', onUsersChanged);

        // Also listen for re-announce request
        sync.on('request-announce', () => {
            // If we are connected (have peerId), announce
            const currentId = sync['_peerId'] || peerId; // Access internal or state
            if (currentId) {
                sync.announceUser({ id: currentId, name: username, color: userColor });
            }
        });

        // Initialize user list if already connected
        if (sync['connectedUsers']) {
            setConnectedUsers(Array.from(sync['connectedUsers'].values()));
        }

        return () => {
            sync.off('ready', onOpen);
            sync.off('disconnected', onClose);
            sync.off('users:changed', onUsersChanged);
            sync.off('request-announce');
        };
    }, [annotator, username, userColor]); // Re-announce if name changes? Maybe

    const handleHost = async () => {
        if (!annotator) return;
        setIsHost(true);
        // Set username in sync BEFORE creating session? Or just rely on 'ready' event which triggers onOpen
        const id = await annotator.sync.createSession();
        // onOpen will fire
    };

    const handleJoin = async () => {
        if (!annotator || !targetId) return;
        setIsHost(false);
        await annotator.sync.connect(targetId);
        // onOpen will fire
    };

    const copyId = () => {
        navigator.clipboard.writeText(peerId);
    };

    return (
        <Popover
            side="bottom"
            align="end"
            trigger={
                <button
                    title="Live Session"
                    className={`p-2 rounded transition-colors ${isConnected ? 'text-green-400 bg-green-900/20' : 'text-gray-400 hover:text-white'}`}
                >
                    {isConnected ? <Users size={20} /> : <Users size={20} />}
                </button>
            }
            content={
                <div className="w-72 p-3 bg-gray-900 text-white rounded-lg border border-gray-700 shadow-xl">
                    <h3 className="font-bold flex items-center gap-2 mb-3">
                        <Users size={16} /> Sync Session
                    </h3>

                    {!isConnected ? (
                        <div className="flex flex-col gap-3">
                            {/* User Identity Input */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-400">Your Name</label>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 bg-gray-800 border-none rounded px-2 py-1 text-sm text-white"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 p-1 bg-gray-800 rounded">
                                <button
                                    className={`flex-1 py-1 text-xs rounded ${isHost ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                                    onClick={() => setIsHost(true)}
                                >
                                    Host
                                </button>
                                <button
                                    className={`flex-1 py-1 text-xs rounded ${!isHost ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                                    onClick={() => setIsHost(false)}
                                >
                                    Join
                                </button>
                            </div>

                            {isHost ? (
                                <button
                                    onClick={handleHost}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-semibold transition-colors"
                                >
                                    Start Session
                                </button>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <input
                                        type="text"
                                        placeholder="Enter Host ID"
                                        value={targetId}
                                        onChange={e => setTargetId(e.target.value)}
                                        className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 rounded text-sm text-white focus:border-blue-500 outline-none"
                                    />
                                    <button
                                        onClick={handleJoin}
                                        disabled={!targetId}
                                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-semibold transition-colors"
                                    >
                                        Connect
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="bg-green-900/20 border border-green-900/50 rounded p-2 text-center">
                                <span className="text-xs text-green-400 font-medium">Session Active</span>
                            </div>

                            {isHost && (
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-gray-400">Your ID (Share this):</span>
                                    <div className="flex gap-1">
                                        <code className="flex-1 bg-black/30 p-1.5 rounded text-xs select-all text-gray-300 font-mono truncate">
                                            {peerId}
                                        </code>
                                        <button onClick={copyId} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-300" title="Copy ID">
                                            <Copy size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!isHost && (
                                <div className="text-xs text-gray-400 flex items-center gap-1">
                                    <LinkIcon size={12} /> Connected to host
                                </div>
                            )}

                            {/* User List */}
                            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                                <span className="text-xs text-gray-400 font-bold">In Session ({connectedUsers.length}):</span>
                                {connectedUsers.map(u => (
                                    <div key={u.id} className="flex items-center gap-2 text-xs">
                                        <div className="w-2 h-2 rounded-full" style={{ background: u.color }}></div>
                                        <span className={`truncate ${u.id === peerId ? 'text-blue-400 font-bold' : 'text-gray-300'}`}>
                                            {u.name} {u.id === peerId ? '(You)' : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>


                            {/* Session Settings */}
                            <div className="pt-2 border-t border-gray-800">
                                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                                    <input type="checkbox" className="rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-0"
                                        onChange={() => { }}
                                    />
                                    <span>Sync Viewport (Experimental)</span>
                                </label>
                                <p className="text-[10px] text-gray-500 mt-1 pl-5">
                                    Sync zoom & pan across users.
                                </p>
                            </div>

                            <button
                                onClick={() => {
                                    annotator?.sync.disconnect();
                                    setIsConnected(false);
                                    setPeerId('');
                                }}
                                className="mt-2 w-full py-1.5 text-xs text-red-400 hover:bg-red-900/20 rounded border border-red-900/30 transition-colors"
                            >
                                Disconnect
                            </button>
                        </div>
                    )}
                </div>
            }
        />
    );
};
