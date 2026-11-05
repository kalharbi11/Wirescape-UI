import { defineConfig } from 'vite';
const version = process.env.npm_package_version ?? '0.3.0';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(`v${version}`) },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: { target: 'es2022', sourcemap: true },
});
