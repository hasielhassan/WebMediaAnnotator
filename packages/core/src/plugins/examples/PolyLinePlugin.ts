import { Plugin } from '../../PluginManager';
import { WebMediaAnnotator } from '../../index';
import { PolyLineTool } from './PolyLineTool';

export const PolyLinePlugin: Plugin = {
    name: 'plugin-polyline',
    version: '1.0.0',
    onInit: (core: WebMediaAnnotator) => {
        core.toolRegistry.register('polyline', (c) => new PolyLineTool(c), {
            label: 'Polyline',
            shortcut: 'L',
            icon: 'waypoints' // We'll map this to a specific icon in the UI
        });
    }
};
