import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  // Load environment variables from .env file that starts with VITE_
  const env = loadEnv(mode, process.cwd(), 'VITE_');

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
      'process.env.VITE_ANALYTICS_WRITE_KEY': JSON.stringify(env.VITE_ANALYTICS_WRITE_KEY),
      'process.env.VITE_ANALYTICS_DATA_PLANE_URL': JSON.stringify(env.VITE_ANALYTICS_DATA_PLANE_URL),
      'process.env.VITE_ANSWER_EVALUATION_API': JSON.stringify(
        isProduction 
          ? env.VITE_ANSWER_EVALUATION_API 
          : 'http://localhost:8000/evaluate'
      )
    },

    css: {
        devSourcemap: true, // Enable CSS sourcemaps in development
    },
    
    plugins: []
  };
});