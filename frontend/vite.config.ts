import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          vendor: ['react', 'react-dom', 'react-router-dom'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
          map: ['mapbox-gl'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          ui: ['@gov-design-system-ce/react']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    // Enable compression
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  // Performance optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@reduxjs/toolkit',
      'react-redux',
      'mapbox-gl',
      'react-hook-form',
      '@hookform/resolvers',
      'zod',
      '@gov-design-system-ce/react'
    ]
  }
});
