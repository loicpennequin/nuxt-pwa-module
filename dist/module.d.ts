import * as _nuxt_schema from '@nuxt/schema';

interface ManifestIcon {
    src: string;
    type: string;
    sizes: string;
    purpose: 'any' | 'maskable';
}
interface ManifestOptions {
    name: string;
    short_name: string;
    description: string;
    lang: string;
    start_url: string;
    display: string;
    background_color: string;
    theme_color: string;
    icons: ManifestIcon[];
}

interface Device {
    width: number;
    height: number;
    pixelRatio: number;
    orientation: 'portrait' | 'landscape';
}
interface IconOptions {
    source: string | null;
    fileName: string;
    sizes: number[];
    maskablePadding: number;
    targetDir: string;
    splash: {
        backgroundColor: string | undefined;
        devices: Device[];
        targetDir: string;
    };
}

interface MetaOptions {
    name: string;
    author: string;
    description: string;
    favicon: boolean;
    mobileApp: boolean;
    mobileAppIOS: boolean;
    appleStatusBarStyle: boolean;
    theme_color: string | undefined;
    lang: string;
    ogType: string;
    ogSiteName: boolean | string;
    ogTitle: boolean | string;
    ogDescription: boolean | string;
    ogImage: boolean | string | {
        path: string;
        width?: number;
        height?: number;
        type?: string;
    };
    ogHost: string | undefined;
    ogUrl: boolean | string;
    twitterCard: string | undefined;
    twitterSite: string | undefined;
    twitterCreator: string | undefined;
}

interface WorkboxOptions {
    swTemplatePath: string;
    enabled: boolean;
    workboxVersion: string;
    workboxUrl?: string | null;
    autoRegister?: boolean;
}

interface PWAOptions {
    icon: IconOptions | false;
    meta: MetaOptions | false;
    manifest: ManifestOptions | false;
    workbox: WorkboxOptions | false;
}
declare module '@nuxt/schema' {
    interface NuxtConfig {
        pwa?: {
            [K in keyof PWAOptions]?: Partial<PWAOptions[K]>;
        };
    }
    interface NuxtOptions {
        pwa: PWAOptions;
    }
}

declare const _default: _nuxt_schema.NuxtModule<PWAOptions>;

export { _default as default };
