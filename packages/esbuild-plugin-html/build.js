import esbuild from 'esbuild';

esbuild.build({
    entryPoints: ['lib/index.js'],
    outdir: 'dist',
    bundle: true,
    splitting: false,
    minify: true,
    sourcemap: true,
    format: 'esm',
    platform: 'node',
    external: [
        '@chialab/esbuild-rna',
        '@chialab/node-resolve',
    ],
    banner: {
        js: 'import { createRequire } from \'module\';\nconst require = createRequire(import.meta.url);\n',
    },
});
