import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      includeAssets: ['favicon.svg', 'icons/*.svg'],

      manifest: {
        name: 'VIDASALUD — Clínica Virtual',
        short_name: 'VIDASALUD',
        description: 'Telemedicina para todo el Perú. Consulta con médicos colegiados desde tu celular.',
        theme_color: '#065F46',
        background_color: '#065F46',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/?source=pwa',
        lang: 'es',
        categories: ['health', 'medical'],

        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],

        shortcuts: [
          {
            name: 'Buscar médico',
            short_name: 'Buscar',
            description: 'Encuentra y reserva una consulta',
            url: '/?source=shortcut',
            icons: [{ src: '/icons/icon.svg', sizes: 'any' }],
          },
          {
            name: 'Mis citas',
            short_name: 'Citas',
            description: 'Ver y gestionar tus citas',
            url: '/citas?source=shortcut',
            icons: [{ src: '/icons/icon.svg', sizes: 'any' }],
          },
          {
            name: 'Mi perfil',
            short_name: 'Perfil',
            description: 'Ver tu perfil y datos personales',
            url: '/perfil?source=shortcut',
            icons: [{ src: '/icons/icon.svg', sizes: 'any' }],
          },
        ],

        screenshots: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            form_factor: 'narrow',
            label: 'VIDASALUD — Pantalla principal',
          },
        ],
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        cleanupOutdatedCaches: true,

        runtimeCaching: [
          // Google Fonts — cache largo, casi nunca cambian
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Supabase API — NetworkFirst: muestra caché si no hay internet
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Supabase Auth — siempre red, no cachear tokens
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: 'NetworkOnly',
          },
          // Culqi CDN — StaleWhileRevalidate
          {
            urlPattern: /^https:\/\/checkout\.culqi\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'culqi-sdk',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
