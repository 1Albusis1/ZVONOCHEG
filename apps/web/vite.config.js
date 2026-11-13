import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: Number(process.env.ZVONOCHEG_WEB_PORT ?? 5173),
    strictPort: true,
    proxy: { '/api': process.env.ZVONOCHEG_API_URL ?? 'http://127.0.0.1:3000' },
  },
});
