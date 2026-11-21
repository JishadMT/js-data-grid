import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/style/js-data-grid.css'],
  format: ['cjs', 'esm', 'iife'], // cjs (Node), esm (Modern bundlers), iife (CDN browser script)
  globalName: 'JsDataGridLib',    // Sets window.JsDataGridLib for CDN users
  dts: true,                      // Generate TypeScript declaration files (.d.ts)
  sourcemap: true,
  clean: true,
  minify: true,
});