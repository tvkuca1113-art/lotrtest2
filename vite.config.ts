import {defineConfig} from 'vite';
export default defineConfig({base:'./',server:{host:'0.0.0.0',port:4173,strictPort:true,allowedHosts:['terminal.local']},build:{target:'es2022',chunkSizeWarningLimit:1600,rollupOptions:{output:{manualChunks:{phaser:['phaser']}}}}});
