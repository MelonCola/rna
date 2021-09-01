import { createEmptySourcemapComment } from '@chialab/estransform';
import { escapeRegexBody } from '@chialab/esbuild-helpers';

/**
 * A plugin for esbuild that enables automatic injection of the jsx module import.
 * @param {{ jsxModule?: string, jsxExport?: 'named'|'namespace'|'default' }} opts
 * @return An esbuild plugin.
 */
export default function(opts = {}) {
    const RUNTIME_ALIAS = '__jsx-runtime__.js';
    const RUNTIME_REGEX = new RegExp(escapeRegexBody(RUNTIME_ALIAS));

    /**
     * @type {import('esbuild').Plugin}
     */
    const plugin = {
        name: 'jsx-import',
        setup(build) {
            const options = build.initialOptions;
            const { jsxFactory, jsxFragment } = options;

            if (!jsxFactory || !opts || !opts.jsxModule || (options.format === 'iife' && !options.bundle)) {
                return;
            }

            if (!options.inject || !options.inject.includes(RUNTIME_ALIAS)) {
                options.inject = [
                    RUNTIME_ALIAS,
                    ...(options.inject || []),
                ];
            }

            const identifier = jsxFactory.split('.')[0];
            const specs = [identifier];
            if (jsxFragment) {
                specs.push(jsxFragment.split('.')[0]);
            }

            build.onLoad({ filter: RUNTIME_REGEX }, () => {
                let contents = '';
                if (opts.jsxExport === 'default') {
                    contents = `export { default as ${identifier} } from '${opts.jsxModule}';`;
                } else if (opts.jsxExport === 'namespace') {
                    contents = `export * as ${identifier} from '${opts.jsxModule}';`;
                } else {
                    contents = `export { ${specs.join(',')} } from '${opts.jsxModule}';`;
                }

                contents += createEmptySourcemapComment();

                return {
                    contents,
                    loader: 'ts',
                };
            });
        },
    };

    return plugin;
}
