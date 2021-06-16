// rollup.config.js
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
let infile,outfile;
if(process.env.NODE_ENV === 'test') {
  infile = './test/index.test.ts'
  outfile = './test/index.test.js'
}else {
  infile = './index.ts'
  outfile = './index.js'
}


export default {
  input: infile,
  output: {
    file: outfile,
    sourcemap:true
  },
  plugins: [
    typescript({ module: 'ES2015' }),
    commonjs(),
    resolve(),
    json()
  ],
};