import path from 'path';
import { transformLoaders } from './loaders.js';

/**
 * @typedef {import('esbuild').TransformResult} TransformResult
 */

/**
 * Build and bundle sources.
 * @param {import('@chialab/rna-config-loader').EntrypointFinalConfig} config
 * @return {Promise<TransformResult>} The esbuild bundle result.
 */
export async function transform(config) {
    const { default: esbuild } = await import('esbuild');

    const {
        input,
        code,
        root,
        loader,
        format,
        platform,
        target,
        sourcemap,
        bundle = false,
        minify,
        globalName,
        define,
        jsxFactory,
        jsxFragment,
        jsxModule,
        jsxExport,
        plugins,
        transformPlugins,
        logLevel,
    } = config;

    if (code == null) {
        throw new Error('Missing required `code` option');
    }

    if (!code) {
        return { code: '', map: '', warnings: [] };
    }

    const finalPlugins = await Promise.all([
        import('@chialab/esbuild-plugin-env').then(({ default: plugin }) => plugin()),
        import('@chialab/esbuild-plugin-jsx-import').then(({ default: plugin }) => plugin({ jsxModule, jsxExport })),
        ...plugins,
        import('@chialab/esbuild-plugin-transform')
            .then(async ({ default: plugin }) =>
                plugin([
                    ...transformPlugins,
                ])
            ),
    ]);

    const sourceFile = path.resolve(root, Array.isArray(input) ? input[0] : input);
    const { outputFiles, warnings } = await esbuild.build({
        stdin: {
            contents: code,
            loader,
            resolveDir: root,
            sourcefile: sourceFile,
        },
        write: false,
        bundle,
        globalName,
        target,
        platform,
        sourcemap,
        minify,
        format,
        define: {
            this: platform === 'browser' ? 'window' : platform === 'neutral' ? 'globalThis' : 'undefined',
            ...define,
        },
        jsxFactory,
        jsxFragment,
        loader: transformLoaders,
        preserveSymlinks: true,
        sourcesContent: true,
        absWorkingDir: path.dirname(sourceFile),
        plugins: finalPlugins,
        logLevel,
    });

    if (!outputFiles) {
        throw new Error(`Failed to transform "${input}"`);
    }

    return {
        code: outputFiles[0].text,
        map: outputFiles[1] ? outputFiles[1].text : '',
        warnings,
    };
}
