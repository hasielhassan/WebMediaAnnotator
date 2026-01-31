import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Annotator, AnnotatorRef } from '@web-media-annotator/react';
import { WebMediaAnnotator as CoreAnnotator } from '@web-media-annotator/core';

export class WebMediaAnnotatorElement extends HTMLElement {
    private root: Root | null = null;
    private annotatorRef: AnnotatorRef | null = null;

    static get observedAttributes() {
        return ['src', 'fps', 'start-frame', 'width', 'height'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        if (!this.shadowRoot) return; // Should not happen

        // Inject Tailwind/UI styles if managing css injection is tricky in shadow dom
        // For now, we assume styles are globally available or we insert a style tag
        // Ideally, we import the css string.

        this.render();
    }

    disconnectedCallback() {
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (oldValue !== newValue && this.root) {
            this.render();
        }
    }

    // Public API to access internal instance
    get instance(): CoreAnnotator | null {
        return this.annotatorRef?.getInstance() ?? null;
    }

    private render() {
        if (!this.shadowRoot) return;

        const src = this.getAttribute('src') || '';
        const fps = parseInt(this.getAttribute('fps') || '24');
        const startFrame = parseInt(this.getAttribute('start-frame') || '0');
        const width = this.getAttribute('width') || '100%';
        const height = this.getAttribute('height') || '100%';

        if (!this.root) {
            this.root = createRoot(this.shadowRoot);
        }

        // We need to inject styles. Since we are in Shadow DOM, global styles won't apply.
        // For this demo, we can try to copy styles from document head or rely on a <link>
        // But bundling CSS is the real solution.
        // For now, I will render a Style Wrapper.

        // Note: Tailwind classes won't work in Shadow DOM unless we inject the CSS string.
        // We will assume for this "Drop-In" test that the user might load CSS separately or we use <slot> method?
        // No, React renders mostly inside.

        // HACK: For dev purposes, we'll fetch the index.css from the demo if we can, or just expect it to be broken without CSS bundling.
        // Actually, let's use Light DOM for simplicity if Shadow DOM filtering of styles is an issue for Tailwind without config.
        // But Custom Elements usually use Shadow DOM.
        // Let's stick to Light DOM for this first iteration to ensure Tailwind Global Styles pick it up.

    }
}

// Re-defining for Light DOM simplicity to inherit Tailwind
export class WebMediaAnnotatorLightElement extends HTMLElement {
    private root: Root | null = null;
    private annotatorRef: AnnotatorRef | null = null;

    static get observedAttributes() {
        return ['src', 'fps', 'start-frame', 'width', 'height'];
    }

    connectedCallback() {
        this.render();
    }

    disconnectedCallback() {
        this.root?.unmount();
        this.root = null;
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (oldValue !== newValue && this.root) {
            this.render();
        }
    }

    private render() {
        const src = this.getAttribute('src') || '';
        const fps = parseInt(this.getAttribute('fps') || '24');
        const startFrame = parseInt(this.getAttribute('start-frame') || '0');
        const width = this.getAttribute('width') || '100%';
        const height = this.getAttribute('height') || '100%';

        if (!this.root) {
            this.root = createRoot(this);
        }

        this.root.render(
            <React.StrictMode>
                <Annotator
                    ref={(r) => this.annotatorRef = r}
                    src={src}
                    fps={fps}
                    startFrame={startFrame}
                    width={width}
                    height={height}
                />
            </React.StrictMode>
        );
    }
}

if (!customElements.get('web-media-annotator')) {
    customElements.define('web-media-annotator', WebMediaAnnotatorLightElement);
}
