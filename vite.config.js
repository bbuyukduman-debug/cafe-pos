import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({ 
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'maskable-icon.png'],
      manifest: {
        name: 'Cafe Adisyon POS Sistemi',
        short_name: 'Adisyon',
        description: 'Gerçek Zamanlı Cafe Yönetim Sistemi',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  resolve: {
    alias: {
      // Rolldown derleyicisinin lucide-react paketini bulmasını kolaylaştırır
      'lucide-react': path.resolve(__dirname, 'node_modules/lucide-react')
    }
  },
  build: {
    // Paketleme esnasında kütüphanelerin doğru şekilde dahil edildiğinden emin olur
    commonjsOptions: {
      include: [/lucide-react/, /node_modules/]
    }
  }
})