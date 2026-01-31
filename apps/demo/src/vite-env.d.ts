/// <reference types="vite/client" />

declare namespace JSX {
    interface IntrinsicElements {
        'web-media-annotator': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
            src?: string;
            fps?: string | number;
            'start-frame'?: string | number;
            width?: string | number;
            height?: string | number;
        }, HTMLElement>;
    }
}
