import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/examples/')) return 'three-extras';
          if (id.includes('node_modules/three/')) return 'three-core';
        }
      }
    }
  }
});
