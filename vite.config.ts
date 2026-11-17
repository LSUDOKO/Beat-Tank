import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // review.html is a dev-only asset review page and is not part of the production build
  build: { chunkSizeWarningLimit: 2000 },
});
