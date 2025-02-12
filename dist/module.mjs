import { join, resolve } from 'pathe';
import { useNuxt, addTemplate, defineNuxtModule, createResolver } from '@nuxt/kit';
import { existsSync } from 'node:fs';
import { fork } from 'node:child_process';
import consola from 'consola';
import { provider } from 'std-env';
import hasha from 'hasha';

const TRAILING_SLASH_RE = /\/$|\/\?/;
function hasTrailingSlash(input = "", queryParams = false) {
  if (!queryParams) {
    return input.endsWith("/");
  }
  return TRAILING_SLASH_RE.test(input);
}
function withTrailingSlash(input = "", queryParams = false) {
  if (!queryParams) {
    return input.endsWith("/") ? input : input + "/";
  }
  if (hasTrailingSlash(input, true)) {
    return input || "/";
  }
  const [s0, ...s] = input.split("?");
  return s0 + "/" + (s.length ? `?${s.join("?")}` : "");
}
function hasLeadingSlash(input = "") {
  return input.startsWith("/");
}
function withoutLeadingSlash(input = "") {
  return (hasLeadingSlash(input) ? input.substr(1) : input) || "/";
}
function isNonEmptyURL(url) {
  return url && url !== "/";
}
function joinURL(base, ...input) {
  let url = base || "";
  for (const i of input.filter(isNonEmptyURL)) {
    url = url ? withTrailingSlash(url) + withoutLeadingSlash(i) : i;
  }
  return url;
}

const portraits = [
  { width: 640, height: 1136, pixelRatio: 2 },
  { width: 750, height: 1334, pixelRatio: 2 },
  { width: 828, height: 1792, pixelRatio: 2 },
  { width: 1125, height: 2436, pixelRatio: 3 },
  { width: 1170, height: 2532, pixelRatio: 3 },
  { width: 1242, height: 2208, pixelRatio: 3 },
  { width: 1242, height: 2688, pixelRatio: 3 },
  { width: 1284, height: 2778, pixelRatio: 2 },
  { width: 1536, height: 2048, pixelRatio: 2 },
  { width: 1620, height: 2160, pixelRatio: 2 },
  { width: 1668, height: 2224, pixelRatio: 2 },
  { width: 1668, height: 2388, pixelRatio: 2 }
].map((device) => ({ ...device, orientation: "portrait" }));
const landscapes = [
  { width: 1136, height: 640, pixelRatio: 2 },
  { width: 1334, height: 750, pixelRatio: 2 },
  { width: 1792, height: 828, pixelRatio: 2 },
  { width: 2048, height: 1536, pixelRatio: 2 },
  { width: 2160, height: 1620, pixelRatio: 2 },
  { width: 2208, height: 1242, pixelRatio: 3 },
  { width: 2224, height: 1668, pixelRatio: 2 },
  { width: 2388, height: 1668, pixelRatio: 2 },
  { width: 2436, height: 1125, pixelRatio: 3 },
  { width: 2532, height: 1170, pixelRatio: 3 },
  { width: 2688, height: 1242, pixelRatio: 3 },
  { width: 2732, height: 2048, pixelRatio: 2 },
  { width: 2778, height: 1284, pixelRatio: 3 }
].map((device) => ({ ...device, orientation: "landscape" }));
const defaultDevices = [
  ...portraits,
  ...landscapes
];
const metaFromDevice = (device, options) => {
  const { width, height, pixelRatio, orientation } = device;
  const { assetsDir, hash } = options;
  return {
    href: join(assetsDir, `${width}x${height}${hash}.png`),
    media: [
      `(device-width: ${width / pixelRatio}px)`,
      `(device-height: ${height / pixelRatio}px)`,
      `(-webkit-device-pixel-ratio: ${pixelRatio})`,
      `(orientation: ${orientation})`
    ].join(" and "),
    rel: "apple-touch-startup-image"
  };
};

async function getFileHash(filePath) {
  const hash = await hasha.fromFile(filePath, { algorithm: "md5" });
  return hash.slice(0, 8);
}
function makeManifestIcon({ iconsDir, size, purpose, hash }) {
  return {
    src: joinURL(iconsDir, `${size}x${size}${purpose === "maskable" ? ".maskable" : ""}${hash}.png`),
    type: "image/png",
    sizes: `${size}x${size}`,
    purpose
  };
}

const icon = async (pwa) => {
  if (!pwa.icon || !pwa.manifest) {
    return;
  }
  if (provider === "stackblitz") {
    return console.warn("[PWA] Disabling icon generation as `sharp` is not currently supported on StackBlitz.");
  }
  const options = pwa.icon;
  const nuxt = useNuxt();
  if (!options.source) {
    options.source = resolve(nuxt.options.srcDir, nuxt.options.dir.public, options.fileName);
  }
  if (!existsSync(options.source)) {
    return consola.warn(`[PWA] Icon not found at ${options.source}`);
  }
  if (options.sizes.length === 0) {
    options.sizes = [64, 120, 144, 152, 192, 384, 512];
  }
  const hash = nuxt.options.dev ? "" : `.${await getFileHash(options.source)}`;
  const iconsDir = joinURL(nuxt.options.app.baseURL, nuxt.options.app.buildAssetsDir, options.targetDir);
  for (const size of options.sizes) {
    pwa.manifest.icons.push(makeManifestIcon({ hash, iconsDir, size, purpose: "any" }));
    pwa.manifest.icons.push(makeManifestIcon({ hash, iconsDir, size, purpose: "maskable" }));
  }
  const isSplashSupportEnabled = pwa.meta && pwa.meta.mobileAppIOS;
  if (isSplashSupportEnabled) {
    if (!options.splash.backgroundColor) {
      options.splash.backgroundColor = pwa.manifest.background_color;
    }
    if (options.splash.devices.length === 0) {
      options.splash.devices = defaultDevices;
    }
    pwa._splashMetas = options.splash.devices.map((device) => metaFromDevice(device, {
      assetsDir: joinURL(nuxt.options.app.baseURL, nuxt.options.app.buildAssetsDir, options.splash.targetDir),
      hash
    }));
  }
  const generateOptions = JSON.stringify({
    input: options.source,
    distDir: join(pwa._assetsDir, options.targetDir),
    sizes: options.sizes,
    maskablePadding: options.maskablePadding,
    splash: isSplashSupportEnabled ? options.splash : false,
    hash
  });
  let generate;
  nuxt.hook("build:before", () => {
    const start = Date.now();
    generate = new Promise((resolve2, reject) => {
      const child = fork(pwa._resolver.resolve("../lib/generate.cjs"), [generateOptions]);
      child.on("exit", (code) => code ? reject(code) : resolve2());
    }).then(() => {
      consola.success(`PWA icons${isSplashSupportEnabled ? " and splash screens " : " "}generated in ${Date.now() - start} ms`);
    });
  });
  nuxt.hook("nitro:build:before", async () => {
    await generate;
  });
};

const manifest = (pwa) => {
  if (!pwa.manifest) {
    return;
  }
  const nuxt = useNuxt();
  const manifestJson = JSON.stringify(pwa.manifest, null, 2);
  const filename = nuxt.options.dev ? "manifest.json" : `manifest.${hasha(manifestJson, { algorithm: "md5" }).slice(0, 8)}.json`;
  addTemplate({
    filename,
    dst: join(pwa._rootDir, filename),
    write: true,
    getContents: () => manifestJson
  });
  pwa._manifestMeta = {
    rel: "manifest",
    href: joinURL(nuxt.options.app.baseURL, filename)
  };
};

const meta = (pwa) => {
  if (!pwa.meta || !pwa.manifest) {
    return;
  }
  const options = pwa.meta;
  const nuxt = useNuxt();
  const head = nuxt.options.app.head;
  if (options.mobileApp) {
    head.meta.push({ name: "mobile-web-app-capable", content: "yes" });
  }
  if (options.mobileAppIOS) {
    head.meta.push({ name: "apple-mobile-web-app-capable", content: "yes" });
    if (pwa._splashMetas) {
      head.link.push(...pwa._splashMetas);
    }
  }
  if (options.mobileAppIOS || options.appleStatusBarStyle) {
    head.meta.push({
      name: "apple-mobile-web-app-status-bar-style",
      content: options.appleStatusBarStyle || "default"
    });
  }
  if (pwa.manifest && pwa.manifest.icons && pwa.manifest.icons.length > 0) {
    const iconSmall = pwa.manifest.icons[0];
    const iconBig = pwa.manifest.icons[pwa.manifest.icons.length - 1];
    if (options.favicon) {
      head.link.push({ rel: "shortcut icon", href: iconSmall.src });
      head.link.push({ rel: "apple-touch-icon", href: iconBig.src, sizes: iconBig.sizes });
    }
  }
  head.title = options.name;
  head.meta.push({ name: "apple-mobile-web-app-title", content: options.name });
  if (options.author) {
    head.meta.push({ name: "author", content: options.author });
  }
  if (options.description) {
    head.meta.push({ name: "description", content: options.description });
  }
  const themeColor = pwa.meta.theme_color || pwa.manifest && pwa.manifest.theme_color;
  if (themeColor) {
    head.meta.push({ name: "theme-color", content: themeColor });
  }
  if (options.lang) {
    head.htmlAttrs = head.htmlAttrs || {};
    head.htmlAttrs.lang = options.lang;
  }
  if (options.ogType) {
    head.meta.push({ property: "og:type", content: options.ogType });
  }
  if (options.ogHost && options.ogUrl === true) {
    options.ogUrl = options.ogHost;
  }
  if (options.ogUrl && options.ogUrl !== true) {
    head.meta.push({ property: "og:url", content: options.ogUrl });
  }
  if (options.ogTitle === true) {
    options.ogTitle = options.name;
  }
  if (options.ogTitle) {
    head.meta.push({ property: "og:title", content: options.ogTitle });
  }
  if (options.ogSiteName === true) {
    options.ogSiteName = options.name;
  }
  if (options.ogSiteName) {
    head.meta.push({ property: "og:site_name", content: options.ogSiteName });
  }
  if (options.ogDescription === true) {
    options.ogDescription = options.description;
  }
  if (options.ogDescription) {
    head.meta.push({ property: "og:description", content: options.ogDescription });
  }
  if (options.ogImage === true) {
    if (pwa.manifest.icons && pwa.manifest.icons.length > 0) {
      const iconBig = pwa.manifest.icons[pwa.manifest.icons.length - 1];
      const [width, height] = iconBig.sizes.split("x").map((x) => +x);
      options.ogImage = { path: iconBig.src, width, height, type: iconBig.type };
    } else {
      options.ogImage = false;
    }
  } else if (typeof options.ogImage === "string") {
    options.ogImage = { path: options.ogImage };
  }
  if (options.ogImage) {
    const isUrl = (path) => /^https?:/.test(path);
    if (options.ogHost || isUrl(options.ogImage.path)) {
      head.meta.push({
        property: "og:image",
        content: isUrl(options.ogImage.path) ? options.ogImage.path : options.ogHost + options.ogImage.path
      });
      if (options.ogImage.width && options.ogImage.height) {
        head.meta.push({ property: "og:image:width", content: options.ogImage.width });
        head.meta.push({ property: "og:image:height", content: options.ogImage.height });
      }
      if (options.ogImage.type) {
        head.meta.push({ property: "og:image:type", content: options.ogImage.type });
      }
    }
  }
  if (options.twitterCard) {
    head.meta.push({ name: "twitter:card", content: options.twitterCard });
  }
  if (options.twitterSite) {
    head.meta.push({ name: "twitter:site", content: options.twitterSite });
  }
  if (options.twitterCreator) {
    head.meta.push({ name: "twitter:creator", content: options.twitterCreator });
  }
  if (pwa._manifestMeta) {
    head.link.push(pwa._manifestMeta);
  }
};

const workbox = (pwa) => {
  if (!pwa.workbox || !pwa.workbox.enabled) {
    return;
  }
  const { swTemplatePath, autoRegister, ...options } = pwa.workbox;
  const nuxt = useNuxt();
  const head = nuxt.options.app.head;
  if (nuxt.options.dev) {
    consola.warn("[PWA] Workbox is running in development mode");
  }
  if (!options.workboxUrl) {
    options.workboxUrl = `https://storage.googleapis.com/workbox-cdn/releases/${options.workboxVersion}/workbox-sw.js`;
  }
  addTemplate({
    src: swTemplatePath ?? pwa._resolver.resolve("../templates/workbox/sw.js"),
    dst: join(pwa._rootDir, "sw.js"),
    write: true,
    options: {
      ...options,
      dev: process.env.NODE_ENV === "development"
    }
  });
  if (autoRegister) {
    head.script.push({
      children: [
        "if ('serviceWorker' in navigator) {",
        `  window.addEventListener('load', () => navigator.serviceWorker.register('${joinURL(nuxt.options.app.baseURL, "sw.js")}'))`,
        "}"
      ].join("\n")
    });
  }
};

const module = defineNuxtModule({
  meta: {
    name: "pwa"
  },
  defaults: (nuxt) => ({
    icon: {
      source: null,
      sizes: [],
      maskablePadding: 20,
      fileName: "icon.png",
      targetDir: "icons",
      splash: {
        backgroundColor: void 0,
        devices: [],
        targetDir: "splash"
      }
    },
    manifest: {
      name: process.env.npm_package_name,
      short_name: process.env.npm_package_name,
      description: process.env.npm_package_description,
      lang: "en",
      start_url: nuxt.options.app.baseURL + "?standalone=true",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#000000",
      icons: []
    },
    meta: {
      name: process.env.npm_package_name,
      author: process.env.npm_package_author_name,
      description: process.env.npm_package_description,
      favicon: true,
      mobileApp: true,
      mobileAppIOS: false,
      appleStatusBarStyle: false,
      theme_color: void 0,
      lang: "en",
      ogType: "website",
      ogSiteName: true,
      ogTitle: true,
      ogDescription: true,
      ogImage: true,
      ogHost: void 0,
      ogUrl: true,
      twitterCard: void 0,
      twitterSite: void 0,
      twitterCreator: void 0
    },
    workbox: {
      enabled: !nuxt.options.dev,
      workboxVersion: "6.5.3",
      workboxUrl: null,
      autoRegister: true
    }
  }),
  async setup(options, nuxt) {
    const pwa = {
      ...options,
      _rootDir: join(nuxt.options.buildDir, "pwa"),
      _assetsDir: join(nuxt.options.buildDir, "pwa/assets"),
      _resolver: createResolver(import.meta.url)
    };
    await icon(pwa);
    manifest(pwa);
    meta(pwa);
    workbox(pwa);
    const {
      nitro,
      app: { buildAssetsDir }
    } = nuxt.options;
    nitro.publicAssets = nitro.publicAssets || [];
    nitro.publicAssets.push({ dir: pwa._rootDir, baseURL: "/" });
    nitro.publicAssets.push({ dir: pwa._assetsDir, baseURL: buildAssetsDir });
  }
});

export { module as default };
