import { WebMediaAnnotator } from './index';

export interface Plugin {
    name: string;
    version: string;
    onInit: (annotator: WebMediaAnnotator) => void;
    onDestroy?: () => void;
}

export class PluginManager {
    private annotator: WebMediaAnnotator;
    private plugins: Map<string, Plugin> = new Map();

    constructor(annotator: WebMediaAnnotator) {
        this.annotator = annotator;
    }

    register(plugin: Plugin) {
        if (this.plugins.has(plugin.name)) {
            console.warn(`Plugin ${plugin.name} is already registered.`);
            return;
        }
        this.plugins.set(plugin.name, plugin);
        plugin.onInit(this.annotator);
    }

    unregister(pluginName: string) {
        const plugin = this.plugins.get(pluginName);
        if (plugin) {
            plugin.onDestroy?.();
            this.plugins.delete(pluginName);
        }
    }
}
