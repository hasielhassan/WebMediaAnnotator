/*
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { WebMediaAnnotator } from './index';
import { BaseTool } from './tools/BaseTool';

export type ToolFactory = (core: WebMediaAnnotator) => BaseTool;

export interface ToolMetadata {
    label: string;
    shortcut?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon?: string | any; // String identifier OR a Component (e.g. React Functional Component)
    section?: 'main' | 'shapes' | 'utility'; // Optional grouping
}

export interface ToolDefinition {
    name: string;
    factory: ToolFactory;
    metadata: ToolMetadata;
}

/**
 * Manages the registration and instantiation of tools.
 * Allows plugins to register new tools dynamically.
 */
export class ToolRegistry {
    private core: WebMediaAnnotator;
    private definitions = new Map<string, ToolDefinition>();
    private instances = new Map<string, BaseTool>();

    constructor(core: WebMediaAnnotator) {
        this.core = core;
    }

    /**
     * Register a new tool with a factory function and metadata.
     * Tools are lazily instantiated when first requested.
     */
    register(name: string, factory: ToolFactory, metadata?: ToolMetadata): void {
        this.definitions.set(name, {
            name,
            factory,
            metadata: metadata || { label: name }
        });

        // If re-registering, clear old instance
        if (this.instances.has(name)) {
            this.instances.delete(name);
        }
    }

    /**
     * Get a tool instance by name. Instantiates it if not already created.
     */
    get(name: string): BaseTool | undefined {
        // Return existing instance
        if (this.instances.has(name)) {
            return this.instances.get(name);
        }

        // Instantiate from factory
        const def = this.definitions.get(name);
        if (def) {
            const tool = def.factory(this.core);
            this.instances.set(name, tool);
            return tool;
        }

        return undefined;
    }

    /**
     * Get definition/metadata for a tool
     */
    getDefinition(name: string): ToolDefinition | undefined {
        return this.definitions.get(name);
    }

    /**
     * Get all registered tool definitions
     */
    getAllDefinitions(): ToolDefinition[] {
        return Array.from(this.definitions.values());
    }

    /**
     * Check if a tool is registered.
     */
    has(name: string): boolean {
        return this.definitions.has(name);
    }

    /**
     * Get a list of all registered tool names.
     */
    getRegisteredNames(): string[] {
        return Array.from(this.definitions.keys());
    }

    /**
     * Clean up all instantiated tools.
     */
    destroy(): void {
        this.instances.clear();
        this.definitions.clear();
    }
}
