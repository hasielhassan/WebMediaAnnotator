import { WebMediaAnnotator } from '../index';
import { Plugin } from '../PluginManager';
import { SelectTool } from '../tools/SelectTool';
import { FreehandTool } from '../tools/FreehandTool';
import { ShapeTool } from '../tools/ShapeTool';
import { TextTool } from '../tools/TextTool';
import { EraserTool } from '../tools/EraserTool';
import { PanTool } from '../tools/PanTool';

export const CoreToolsPlugin: Plugin = {
    name: 'core-tools',
    version: '1.0.0',
    onInit: (core: WebMediaAnnotator) => {
        // Register Standard Tools with Metadata

        core.toolRegistry.register('pan', (c) => new PanTool(c), {
            label: 'Pan',
            shortcut: 'Space',
            icon: 'hand'
        });

        core.toolRegistry.register('select', (c) => new SelectTool(c), {
            label: 'Select',
            shortcut: 'S',
            icon: 'mouse-pointer'
        });

        core.toolRegistry.register('freehand', (c) => new FreehandTool(c), {
            label: 'Freehand',
            shortcut: 'P',
            icon: 'pencil'
        });

        core.toolRegistry.register('square', (c) => new ShapeTool(c, 'square'), {
            label: 'Rectangle',
            shortcut: 'R',
            icon: 'square'
        });

        core.toolRegistry.register('circle', (c) => new ShapeTool(c, 'circle'), {
            label: 'Circle',
            shortcut: 'C',
            icon: 'circle'
        });

        core.toolRegistry.register('arrow', (c) => new ShapeTool(c, 'arrow'), {
            label: 'Arrow',
            shortcut: 'A',
            icon: 'move-up-right'
        });

        core.toolRegistry.register('text', (c) => new TextTool(c), {
            label: 'Text',
            shortcut: 'T',
            icon: 'type'
        });

        core.toolRegistry.register('eraser', (c) => new EraserTool(c), {
            label: 'Eraser',
            shortcut: 'E',
            icon: 'eraser'
        });


    }
};
