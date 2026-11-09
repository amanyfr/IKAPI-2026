import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Target backend bisa diganti lewat env API_TARGET (default http://localhost:5000)
const API_TARGET = process.env.API_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true
      },
      '/uploads': {
        target: API_TARGET,
        changeOrigin: true
      }
    }
  }
});

