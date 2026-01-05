import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  // Load environment variables from .env file that starts with VITE_
  // This is the same mechanism used by the 'define' option below
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const siteUrl = env.VITE_SITE_URL || 'http://localhost:3000';

  // Plugin to replace placeholders in robots.txt and sitemap.xml
  // Note: We can't use 'define' for these files because they're static files
  // copied from publicDir and don't go through Vite's bundler.
  // Instead, we use the same loadEnv mechanism and replace placeholders after build.
  const replaceSiteUrlPlugin = () => {
    return {
      name: 'replace-site-url',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist');
        const robotsPath = join(distDir, 'robots.txt');
        const sitemapPath = join(distDir, 'sitemap.xml');

        // Replace in robots.txt
        try {
          let robotsContent = readFileSync(robotsPath, 'utf-8');
          robotsContent = robotsContent.replace(/__VITE_SITE_URL__/g, siteUrl);
          writeFileSync(robotsPath, robotsContent, 'utf-8');
        } catch (error) {
          console.warn('Could not update robots.txt:', error.message);
        }

        // Replace in sitemap.xml
        try {
          let sitemapContent = readFileSync(sitemapPath, 'utf-8');
          sitemapContent = sitemapContent.replace(/__VITE_SITE_URL__/g, siteUrl);
          writeFileSync(sitemapPath, sitemapContent, 'utf-8');
        } catch (error) {
          console.warn('Could not update sitemap.xml:', error.message);
        }
      }
    };
  };

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
    
    plugins: [replaceSiteUrlPlugin()]
  };
});