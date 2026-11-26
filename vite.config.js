import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    solid(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: '길냥이 시뮬레이터',
        short_name: '길냥이',
        description: '2D 도트 오픈월드 길냥이 시뮬레이터',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone', // 브라우저 주소창 제거 (네이티브 앱처럼 실행)
        orientation: 'landscape', // 가로 모드 기본
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      devOptions: {
        enabled: true, // 로컬 개발 서버에서도 PWA 동작 확인 가능
      },
    }),
  ],
});