import { Store } from './Store';
import { Player } from './Player';

export interface SyncAction {
    type: string;
    payload: unknown;
    timestamp: number;
    source?: string;
}

export class SyncManager {
    private store: Store;
    private player: Player;
    private dispatchCallback?: (action: SyncAction) => void;

    constructor(store: Store, player: Player) {
        this.store = store;
        this.player = player;
        this.initStoreListeners();
    }

    // Connect external transport (WebSocket, etc)
    setDispatchCallback(cb: (action: SyncAction) => void) {
        this.dispatchCallback = cb;
    }

    private initStoreListeners() {
        // Listen to local changes and dispatch actions
        this.store.on('annotation:added', (annotation) => {
            this.emitAction('ANNOTATION_ADDED', annotation);
        });

        // TODO: Hook into player events for 'PLAY', 'PAUSE', 'SEEK'
        // This requires the Player to emit events or Store key changes

        this.store.on('state:changed', (newState, oldState) => {
            if (newState.isPlaying !== oldState.isPlaying) {
                this.emitAction(newState.isPlaying ? 'PLAY' : 'PAUSE', {});
            }
            // Debounce seek?
        });
    }

    private emitAction(type: string, payload: unknown) {
        if (this.dispatchCallback) {
            this.dispatchCallback({
                type,
                payload,
                timestamp: Date.now()
            });
        }
    }

    // Receive external action
    dispatch(action: SyncAction) {
        // Prevent infinite loops by flagging source?
        switch (action.type) {
            case 'PLAY':
                this.player.play();
                break;
            case 'PAUSE':
                this.player.pause();
                break;
            case 'SEEK':
                this.player.seekToFrame((action.payload as { frame: number }).frame);
                break;
            case 'ANNOTATION_ADDED':
                // Check if exists to avoid dups?
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                this.store.addAnnotation(action.payload as any);
                break;
            // ... handle other actions
        }
    }
}
