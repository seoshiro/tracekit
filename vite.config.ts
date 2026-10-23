import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/tracekit/',
  plugins: [
    react(),
    {
      name: 'local-development-csp',
      apply: 'serve',
      // Vite's local HMR needs its inline preamble and localhost WebSocket.
      // The production HTML retains the strict policy in index.html.
      transformIndexHtml: (html) =>
        html.replace(/\s*<meta\b(?=[^>]*http-equiv="Content-Security-Policy")[^>]*>/i, ''),
    },
  ],
  build: { sourcemap: false, target: 'es2022' },
});
