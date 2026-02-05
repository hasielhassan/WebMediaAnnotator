import { EventEmitter } from 'eventemitter3';
import { Peer, DataConnection } from 'peerjs';
import * as Y from 'yjs';

// Protocol Message Types
// Protocol Message Types
interface SyncUser {
    id: string;
    name: string;
    color: string;
}

export type Message =
    | { type: 'sync-step-1'; data: number[] } // Send State Vector (as Array for JSON compat)
    | { type: 'sync-step-2'; data: number[] } // Send Update (Diff) (as Array for JSON compat)
    | { type: 'update'; data: number[] }      // Incremental Update (as Array for JSON compat)
    | { type: 'announce-user'; user: SyncUser }
    | { type: 'playback'; action: 'play' | 'pause' | 'seek'; frame?: number; time?: number }
    | { type: 'ping' };

export interface SyncStats {
    connected: boolean;
    peerId: string | null;
    isHost: boolean;
    connections: number;
}

export class LinkSync extends EventEmitter {
    public doc: Y.Doc;
    private peer: Peer | null = null;
    private connections = new Map<string, DataConnection>();
    private isHost = false;
    public get isHostUser(): boolean {
        return this.isHost;
    }
    private _peerId: string | null = null;

    // Yjs Types
    // Yjs Types
    public annotationsMap: Y.Map<unknown>; // ID -> Annotation Data
    public sessionMap: Y.Map<unknown>; // Session Settings (Ghosting etc)
    public usersMap: Y.Map<unknown>; // Connected Users

    constructor(
        private signalingServer?: { host: string; port: number; path: string }
    ) {
        super();
        this.doc = new Y.Doc();
        this.annotationsMap = this.doc.getMap('annotations');
        this.sessionMap = this.doc.getMap('session');
        this.usersMap = this.doc.getMap('users');

        // Listen for LOCAL updates to the doc (e.g. user draws something)
        // and broadcast them to peers.
        // Listen for LOCAL updates to the doc (e.g. user draws something)
        // and broadcast them to peers.
        this.doc.on('update', (update: Uint8Array, origin: unknown) => {
            // 'origin' is useful to distinguish local vs remote.
            // If origin is NOT this class instance, it means it's a local change (from Store).
            if (origin !== this) {
                // Convert Uint8Array to Array for JSON serialization over PeerJS
                this.broadcast({ type: 'update', data: Array.from(update) });
            }
        });
    }

    public get peerId() {
        return this._peerId;
    }

    /**
     * Start a session as HOST
     */
    public async createSession(): Promise<string> {
        this.isHost = true;
        return this.initPeer();
    }

    /**
     * Join an existing session as GUEST
     */
    public async connect(hostId: string): Promise<string> {
        this.isHost = false;
        await this.initPeer(); // Get own ID first
        this.connectToPeer(hostId);
        return this._peerId!;
    }

    public disconnect() {
        this.connections.forEach(conn => conn.close());
        this.connections.clear();
        this.peer?.destroy();
        this.peer = null;
        this.emit('disconnected');
    }

    private initPeer(): Promise<string> {
        return new Promise((resolve, _reject) => {
            const options = this.signalingServer ? {
                host: this.signalingServer.host,
                port: this.signalingServer.port,
                path: this.signalingServer.path
            } : undefined;

            this.peer = new Peer(undefined as unknown as string, {

                ...options,
                debug: 1
            });

            this.peer.on('open', (id) => {
                this._peerId = id;
                this.emit('ready', id);
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                this.handleConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS Error:', err);
                this.emit('error', err);
            });

            this.peer.on('disconnected', () => {
                // Auto-reconnect not fully implemented here
                this.emit('disconnected');
            });
        });
    }

    private connectToPeer(targetId: string) {
        if (!this.peer) return;
        const conn = this.peer.connect(targetId, { reliable: true });
        this.handleConnection(conn);
    }

    private handleConnection(conn: DataConnection) {
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            this.emit('connection:open', conn.peer);
            this.emit('stats', this.getStats());

            // 1. Send Sync Step 1: My State Vector
            const stateVector = Y.encodeStateVector(this.doc);
            // Convert Uint8Array to Array for JSON serialization over PeerJS
            if (conn.open) conn.send({ type: 'sync-step-1', data: Array.from(stateVector) });

            // 2. Announce User Trigger
            this.emit('request-announce');

            // 3. User List Sync (Host only)
            if (this.isHost) {
                // Send all existing users to the new peer
                this.connectedUsers.forEach(user => {
                    if (conn.open) conn.send({ type: 'announce-user', user });
                });
            }
        });

        conn.on('data', (data) => {
            if (data && typeof data === 'object') {
                this.handleMessage(conn, data as Message);
            }
        });

        conn.on('close', () => {
            // Remove user
            if (this.connectedUsers.has(conn.peer)) {
                this.connectedUsers.delete(conn.peer);
                this.emit('users:changed', Array.from(this.connectedUsers.values()));

                // If Host, announce 'user-left' or just let new list sync?
                // 'users:changed' is local. To sync removal, we need a 'user-left' or just rely on 'announce-user' + timeouts?
                // Yjs presence handles this with timeouts.
                // Simple approach: Host sends "user-left" message?
                // I haven't defined 'user-left'.
                // For now, list update is local. Guests won't know if someone left unless Host sends explicit message.
                // I'll add 'user-left' message type later if critical. 
                // Currently only Host knows who disconnected (direct connection).
                // Guests connect to Host. If Host drops, everyone drops.
                // If Guest A drops, Host sees it. Guest B doesn't know Guest A dropped unless Host relays it.
                // I'll implement 'user-left' relay for completeness.
            }

            this.connections.delete(conn.peer);
            this.emit('connection:close', conn.peer);
            this.emit('stats', this.getStats());
        });

        conn.on('error', (err) => {
            console.error(`Connection error with ${conn.peer}:`, err);
        });
    }

    private handleMessage(conn: DataConnection, msg: Message) {
        try {
            switch (msg.type) {
                case 'sync-step-1': {
                    // They sent their State Vector. We calculate Diff (what they are missing) and send it back.
                    // Convert back from Array to Uint8Array (PeerJS JSON serialization)
                    const data = new Uint8Array(msg.data);
                    const diff = Y.encodeStateAsUpdate(this.doc, data);
                    // Convert Uint8Array to Array for sending
                    if (conn.open) conn.send({ type: 'sync-step-2', data: Array.from(diff) });
                    break;
                }
                case 'sync-step-2': {
                    // They sent the Diff. We apply it.
                    // Convert back from Array to Uint8Array
                    const data = new Uint8Array(msg.data);
                    Y.applyUpdate(this.doc, data, this);
                    break;
                }
                case 'update': {
                    // Incremental update
                    // Convert back from Array to Uint8Array
                    const data = new Uint8Array(msg.data);
                    Y.applyUpdate(this.doc, data, this);

                    // HOST RELAY LOGIC
                    if (this.isHost) {
                        // Forward to all OTHER peers (msg already has Array data format)
                        this.connections.forEach((otherConn) => {
                            if (otherConn.peer !== conn.peer && otherConn.open) {
                                otherConn.send(msg);
                            }
                        });
                    }
                    break;
                }
                case 'announce-user': {
                    const user = msg.user;
                    if (user && user.id) {
                        this.connectedUsers.set(user.id, user);
                        this.emit('users:changed', Array.from(this.connectedUsers.values()));

                        // HOST RELAY LOGIC
                        if (this.isHost) {
                            this.connections.forEach((otherConn) => {
                                if (otherConn.peer !== conn.peer && otherConn.open) {
                                    otherConn.send(msg);
                                }
                            });
                        }
                    }
                    break;
                }
                case 'playback': {
                    this.emit('playback:change', msg);

                    // HOST RELAY LOGIC
                    if (this.isHost) {
                        this.connections.forEach((otherConn) => {
                            if (otherConn.peer !== conn.peer && otherConn.open) {
                                otherConn.send(msg);
                            }
                        });
                    }
                    break;
                }
            }
        } catch (e) {
            console.error('Error handling message:', e);
        }
    }

    public sendPlayback(action: 'play' | 'pause' | 'seek', frame?: number) {
        this.broadcast({ type: 'playback', action, frame });
    }

    public sendPlaybackToPeer(peerId: string, action: 'play' | 'pause' | 'seek', frame?: number) {
        const conn = this.connections.get(peerId);
        if (conn && conn.open) {
            conn.send({ type: 'playback', action, frame });
        }
    }

    // User Identity
    public connectedUsers = new Map<string, SyncUser>();

    public announceUser(user: SyncUser) {
        this.broadcast({ type: 'announce-user', user });
        // Add self
        this.connectedUsers.set(this._peerId!, user);
        this.emit('users:changed', Array.from(this.connectedUsers.values()));
    }

    private broadcast(msg: Message) {
        this.connections.forEach(conn => {
            if (conn.open) conn.send(msg);
        });
    }

    public getStats(): SyncStats {
        return {
            connected: !!this.peer && !this.peer.disconnected,
            peerId: this._peerId,
            isHost: this.isHost,
            connections: this.connections.size
        };
    }
}
