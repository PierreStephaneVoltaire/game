import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { gameplayTracing } from './tools/trace-instrumentation';

export default defineConfig({
  envPrefix: ['VITE_', 'PUBLIC_'],
  plugins: [gameplayTracing(), sveltekit()],
});
