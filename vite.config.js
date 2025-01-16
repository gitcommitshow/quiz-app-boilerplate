import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  
  return {
    root: 'src',
    base: './',
    
    // Development server configuration
    server: {
      port: 3000,
      open: true,
    },

    // Build configuration
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      assetsDir: 'assets',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/index.html'),
        },
      },
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000,
    },

    // Handle static assets
    publicDir: 'public',

    // Environment variable replacement
    define: {
      VITE_ANSWER_EVALUATION_API: JSON.stringify(
        isProduction 
          ? process.env.VITE_ANSWER_EVALUATION_API 
          : 'http://localhost:8000/evaluate'
      )
    },

    css: {
        devSourcemap: true, // Enable CSS sourcemaps in development
    },
    
    plugins: []
  };
});