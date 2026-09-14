import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{outDir:'.standalone-build',target:'es2022',chunkSizeWarningLimit:2000,rollupOptions:{input:'src/main.ts',output:{format:'iife',inlineDynamicImports:true,entryFileNames:'game.js',assetFileNames:'[name][extname]'}}}});
