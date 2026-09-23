import {defineConfig} from 'vite';

export default defineConfig({
  // NEXT_PUBLIC_* is provisioned by the Vercel Supabase integration and is
  // intentionally safe for browser use. Secret Supabase keys stay server-only.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
});
