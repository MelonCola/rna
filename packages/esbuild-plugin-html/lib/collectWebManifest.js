import { isRelativeUrl } from '@chialab/node-resolve';
import Jimp, { SUPPORTED_MIME_TYPES } from './generator.js';
import { generateIcon } from './generateIcon.js';

const MANIFEST_ICONS = [
    {
        name: 'android-chrome-36x36.png',
        size: 36,
    },
    {
        name: 'android-chrome-48x48.png',
        size: 48,
    },
    {
        name: 'android-chrome-72x72.png',
        size: 72,
    },
    {
        name: 'android-chrome-96x96.png',
        size: 96,
    },
    {
        name: 'android-chrome-144x144.png',
        size: 144,
    },
    {
        name: 'android-chrome-192x192.png',
        size: 192,
    },
    {
        name: 'android-chrome-256x256.png',
        size: 256,
    },
    {
        name: 'android-chrome-384x384.png',
        size: 384,
    },
    {
        name: 'android-chrome-512x512.png',
        size: 512,
    },
];

/**
 * Collect and bundle webmanifests.
 * @type {import('./index').Collector}
 */
export async function collectWebManifest($, dom, options, { emitFile, resolve, load }) {
    const htmlElement = dom.find('html');
    const baseElement = dom.find('base');
    const titleElement = dom.find('title');
    const descriptionElement = dom.find('meta[name="description"]');
    const themeElement = dom.find('meta[name="theme"]');
    const iconElement = dom.find('link[rel*="icon"]').last();
    const element = dom.find('link[rel="manifest"]');
    if (!element.length) {
        return [];
    }

    const manifestHref = /** @type {string} */($(element).attr('href'));
    if (!isRelativeUrl(manifestHref)) {
        return [];
    }

    const manifestFilePath = await resolve(manifestHref);
    if (!manifestFilePath.path) {
        throw new Error(`Failed to resolve manifest path: ${manifestHref}`);
    }

    const manifestFile = await load(manifestFilePath.path, manifestFilePath);
    if (!manifestFile.contents) {
        throw new Error(`Failed to load manifest file: ${manifestFilePath.path}`);
    }

    const json = JSON.parse(manifestFile.contents.toString());
    json.name = json.name || titleElement.text() || undefined;
    json.short_name = json.short_name || json.name || titleElement.text() || undefined;
    json.description = json.description || descriptionElement.attr('content') || undefined;
    json.start_url = json.start_url || baseElement.attr('href') || '/';
    json.scope = json.scope || baseElement.attr('href') || '';
    json.display = json.display || 'standalone';
    json.orientation = json.orientation || 'any';
    json.theme_color = json.theme_color || themeElement.attr('content') || undefined;
    json.background_color = json.background_color || '#fff';
    json.lang = json.lang || htmlElement.attr('lang') || 'en-US';

    icon: if (iconElement && iconElement.length) {
        const iconHref = iconElement.attr('href') || '';
        const mimeType = iconElement.attr('type') || 'image/png';
        if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
            break icon;
        }

        const iconFilePath = await resolve(iconHref);
        if (!iconFilePath.path) {
            throw new Error(`Failed to resolve icon path: ${iconHref}`);
        }

        const iconFile = await load(iconFilePath.path, iconFilePath);
        if (!iconFile.contents) {
            throw new Error(`Failed to load icon file: ${iconFilePath.path}`);
        }

        const imageBuffer = Buffer.from(iconFile.contents);
        const image = await Jimp.read(imageBuffer);

        json.icons = await Promise.all(
            MANIFEST_ICONS.map(async ({ name, size }) => {
                const contents = await generateIcon(image, size, 0, { r: 255, g: 255, b: 255, a: 1 });
                const result = await emitFile(name, contents);
                return {
                    src: result.path,
                    sizes: `${size}x${size}`,
                    type: 'image/png',
                };
            })
        );
    }

    return [
        {
            build: {
                entryPoint: manifestFilePath.path,
                contents: JSON.stringify(json, null, 2),
                loader: 'file',
            },
            async finisher(files) {
                $(element).attr('href', files[0]);
            },
        },
    ];
}
