import path from 'path';
import crypto from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';

export * from './dependencies.js';

/**
 * @typedef {import('esbuild').Metafile} Metafile
 */

/**
 * @typedef {import('esbuild').BuildResult & { metafile: Metafile, outputFiles?: import('esbuild').OutputFile[] }} BuildResult
 */

/**
 * Escape RegExp modifiers in a string.
 * @param {string} source
 */
export function escapeRegexBody(source) {
    return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create an empty metafile object.
 * @return {Metafile}
 */
export function createEmptyMetafile() {
    return { inputs: {}, outputs: {} };
}

/**
 * @param {Metafile} [metafile]
 * @return {BuildResult}
 */
export function createResult(metafile = createEmptyMetafile()) {
    return {
        errors: [],
        warnings: [],
        metafile,
    };
}

/**
 * Merge esbuild results into a single object
 * that collects all inputs and outputs references, errors and warnings.
 * This is useful when running multiple builds in separated process.
 * @param {import('esbuild').BuildResult} context
 * @param {BuildResult} result
 */
export function assignToResult(context, result) {
    context.errors.push(...result.errors);
    context.warnings.push(...result.warnings);

    const contextMeta = context.metafile = context.metafile || createEmptyMetafile();
    const resultMeta = result.metafile || createEmptyMetafile();

    contextMeta.inputs = {
        ...contextMeta.inputs,
        ...resultMeta.inputs,
    };
    contextMeta.outputs = {
        ...contextMeta.outputs,
        ...resultMeta.outputs,
    };
}

/**
 * Get the entrypoint ouput from an esbuild result metafile.
 * This is useful when you need to build multiple files using the `outdir` option
 * and you don't know the name of the resulting file.
 * @param {string[]} entryPoints The list of build entrypoints.
 * @param {Metafile} metafile The result metafile from esbuild.
 * @param {string} rootDir The root dir of the build.
 * @return {string}
 */
export function getMainOutput(entryPoints, metafile, rootDir = process.cwd()) {
    const outputs = metafile.outputs;
    return path.resolve(rootDir, /** @type {string} */(Object.keys(outputs)
        .filter((output) => !output.endsWith('.map'))
        .filter((output) => outputs[output].entryPoint)
        .find((output) => entryPoints.includes(path.resolve(rootDir, /** @type {string} */(outputs[output].entryPoint))))));
}

/**
 * @param {string} from
 * @param {import('esbuild').BuildOptions} options
 */
export async function esbuildFile(from, options = {}) {
    const { sourceRoot, absWorkingDir, assetNames = '[name]', outdir, outfile } = options;
    const rootDir = sourceRoot || absWorkingDir || process.cwd();
    const outDir = outdir || path.dirname(/** @type {string} */ (outfile));

    const inputFile = path.relative(rootDir, from);
    const ext = path.extname(inputFile);
    const basename = path.basename(inputFile, ext);
    const buffer = await readFile(inputFile);
    const computedName = assetNames
        .replace('[name]', basename)
        .replace('[hash]', () => {
            const hash = crypto.createHash('sha1');
            hash.update(buffer);
            return hash.digest('hex').substr(0, 8);
        });

    const outputFile = path.join(outDir, `${computedName}${ext}`);
    await mkdir(path.dirname(outputFile), {
        recursive: true,
    });
    await writeFile(outputFile, buffer);

    const relativeOutputFile = path.relative(rootDir, outputFile);
    const bytes = Buffer.byteLength(buffer);

    return {
        outputFile: relativeOutputFile,
        result: createResult(
            {
                inputs: {
                    [inputFile]: {
                        bytes,
                        imports: [],
                    },
                },
                outputs: {
                    [relativeOutputFile]: {
                        bytes,
                        inputs: {
                            [inputFile]: {
                                bytesInOutput: bytes,
                            },
                        },
                        imports: [],
                        exports: [],
                        entryPoint: inputFile,
                    },
                },
            }
        ),
    };
}

/**
 * @param {import('esbuild').BuildResult} result
 * @param {string} from
 * @param {string} to
 * @return {BuildResult}
 */
export function remapResult(result, from, to) {
    const resultMeta = result.metafile || createEmptyMetafile();
    const inputs = resultMeta.inputs;
    const outputs = resultMeta.outputs;

    return {
        errors: result.errors,
        warnings: result.warnings,
        metafile: {
            inputs: Object.keys(inputs)
                .reduce((acc, input) => {
                    const newPath = path.relative(to, path.resolve(from, input));
                    acc[newPath] = inputs[input];
                    return acc;
                }, /** @type {Metafile['inputs']} */({})),
            outputs: Object.keys(outputs)
                .reduce((acc, output) => {
                    const newPath = path.relative(to, path.resolve(from, output));
                    acc[newPath] = outputs[output];
                    return acc;
                }, /** @type {Metafile['outputs']} */ ({})),
        },
    };
}
