import commonJS   from '@rollup/plugin-commonjs';
import resolve    from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import {terser}   from 'rollup-plugin-terser';

export default {
    input:   'src/index.ts',
    output:  {
        name:   'ByteshiftThreading',
        file:   'dist/index.js',
        format: 'commonjs',
        exports: 'named',
        sourcemap: true,
    },
    plugins: [
        typescript(),
        resolve({
        }),
        commonJS({
            include: 'node_modules/**',
        }),
        !process.env.ROLLUP_WATCH && terser({
            output: {
                width: 120
            }
        })
    ],
};
