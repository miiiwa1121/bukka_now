import devServer from '@hono/vite-dev-server';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    devServer({
      entry: 'server/app.ts',
      exclude: [/^\/(?!(api)).*/],
    }),
  ],
  server: {
    port: 5173,
  },
});
