import { promises } from 'fs';
import path from 'path';
import $ from 'cheerio';
import { generateIcon } from './generateIcon.js';
import { generateLaunch } from './generateLaunch.js';

const { writeFile, unlink, mkdir } = promises;

const FAVICONS = [
    {
        name: 'favicon-16x16.png',
        size: 16,
    },
    {
        name: 'favicon-32x32.png',
        size: 32,
    },
    {
        name: 'favicon-48x48.png',
        size: 48,
    },
    {
        name: 'favicon-196x196.png',
        size: 196,
    },
];

const APPLE_ICONS = [
    {
        name: 'apple-touch-icon.png',
        size: 180,
        gutter: 30,
        type: 'icon',
        background: { r: 255, g: 255, b: 255, a: 1 },
    },
    {
        name: 'apple-touch-icon-ipad.png',
        size: 167,
        gutter: 30,
        type: 'icon',
        background: { r: 255, g: 255, b: 255, a: 1 },
    },
];

const APPLE_LAUNCH_SCREENS = [
    {
        name: 'apple-launch-iphonex.png',
        width: 1125,
        height: 2436,
        query: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
    },
    {
        name: 'apple-launch-iphone8.png',
        width: 750,
        height: 1334,
        query: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)',
    },
    {
        name: 'apple-launch-iphone8-plus.png',
        width: 1242,
        height: 2208,
        query: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)',
    },
    {
        name: 'apple-launch-iphone5.png',
        width: 640,
        height: 1136,
        query: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
    },
    {
        name: 'apple-launch-ipadair.png',
        width: 1536,
        height: 2048,
        query: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)',
    },
    {
        name: 'apple-launch-ipadpro10.png',
        width: 1668,
        height: 2224,
        query: '(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)',
    },
    {
        name: 'apple-launch-ipadpro12.png',
        width: 2048,
        height: 2732,
        query: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)',
    },
];

/**
 * Collect and bundle favicons.
 * @param {$.Cheerio} dom The DOM element.
 * @param {string} base The base dir.
 * @param {string} outdir The output dir.
 * @return {import('./index').Entrypoint[]} A list of entrypoints.
 */
export function collectIcons(dom, base, outdir) {
    let iconElement = dom.find('link[rel*="icon"]');
    let element = dom
        .find('link[rel*="icon"]')
        .get()
        .filter((element) => $(element).attr('href'))[0];
    if (!element) {
        return [];
    }

    let iconHref = iconElement.attr('href') || '';
    if (!iconHref) {
        return [];
    }

    let entryPoint = path.resolve(base, iconHref);

    return [
        {
            loader: 'file',
            options: {
                entryPoints: [
                    entryPoint,
                ],
                entryNames: '[name]',
                chunkNames: '[name]',
                assetNames: '[name]',
            },
            async finisher(filePath) {
                let iconsDir = path.join(outdir, 'icons');
                try {
                    await mkdir(iconsDir);
                } catch (err) {
                    //
                }

                let iconFile = path.resolve(base, iconHref);
                for (let i = 0; i < FAVICONS.length; i++) {
                    let { name, size } = FAVICONS[i];
                    let outputFile = path.join(iconsDir, name);
                    let buffer = await generateIcon(iconFile, size, 0, { r: 255, g: 255, b: 255, a: 1 }, iconElement.attr('type') || 'image/png');
                    await writeFile(outputFile, buffer);
                    if (size === 196) {
                        let link = $('<link>');
                        link.attr('rel', 'shortcut icon');
                        link.attr('href', path.relative(outdir, outputFile));
                        link.insertBefore($(element));
                        $(element).before('\n    ');
                    }

                    let link = $('<link>');
                    link.attr('rel', 'icon');
                    link.attr('sizes', `${size}x${size}`);
                    link.attr('href', path.relative(outdir, outputFile));
                    link.insertBefore($(element));
                    $(element).before('\n    ');
                }

                for (let i = 0; i < APPLE_ICONS.length; i++) {
                    let { name, size, gutter, background } = APPLE_ICONS[i];
                    let outputFile = path.join(iconsDir, name);
                    let buffer = await generateIcon(iconFile, size, gutter, background, iconElement.attr('type') || 'image/png');
                    await writeFile(outputFile, buffer);
                    let link = $('<link>');
                    link.attr('rel', 'apple-touch-icon');
                    link.attr('sizes', `${size}x${size}`);
                    link.attr('href', path.relative(outdir, outputFile));
                    link.insertBefore($(element));
                    $(element).before('\n    ');
                }

                for (let i = 0; i < APPLE_LAUNCH_SCREENS.length; i++) {
                    let { name, query, width, height } = APPLE_LAUNCH_SCREENS[i];
                    let outputFile = path.join(iconsDir, name);
                    let buffer = await generateLaunch(iconFile, width, height, 0, { r: 255, g: 255, b: 255, a: 1 }, iconElement.attr('type') || 'image/png');
                    await writeFile(outputFile, buffer);
                    let link = $('<link>');
                    link.attr('rel', 'apple-touch-startup-image');
                    link.attr('media', query);
                    link.attr('href', path.relative(outdir, outputFile));
                    link.insertBefore($(element));
                    if (i !== APPLE_LAUNCH_SCREENS.length - 1) {
                        $(element).before('\n    ');
                    }
                }

                $(element).remove();
                await unlink(filePath);
            },
        },
    ];
}