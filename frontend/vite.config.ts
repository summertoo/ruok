import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 将 Sui 相关库分离到单独的 chunk
          if (id.includes('@mysten/dapp-kit') || id.includes('@mysten/sui.js')) {
            return 'sui-vendor';
          }
          // 将 React Query 分离
          if (id.includes('@tanstack/react-query')) {
            return 'react-query';
          }
        },
      },
      onwarn(warning, warn) {
        // 忽略这些第三方库的警告
        if (
          warning.code === 'MODULE_LEVEL_DIRECTIVE' ||
          warning.message.includes('"use client"') ||
          warning.message.includes('@__PURE__')
        ) {
          return;
        }
        warn(warning);
      },
    },
    // 提高警告阈值到 1000KB
    chunkSizeWarningLimit: 1000,
  },
});