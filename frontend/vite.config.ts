import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Base URL for asset paths, matches Flask's static_url_path='/'
  // base: '/',

  // Development server configuration
  server: {
    host: "::", // Listen on all interfaces (IPv4/IPv6)
    port: 8080, // Dev server port (separate from Flask's 5000)
    proxy: {
      // Forward Socket.IO and API requests to Flask during development
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true, // Enable WebSocket proxying for Socket.IO
      },
      '/upload_video': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },

  // Plugins for React and custom tagging
  plugins: [
    react(), // SWC-based React compilation
    // mode === 'development' && componentTagger(), // Apply tagger only in dev mode
  ].filter(Boolean),
  
  // Build configuration
  // build: {
  //   outDir: 'dist', // Output directory (copied to sld-v2/static/build/)
  //   sourcemap: true, // Generate sourcemaps for debugging (optional)
  // },
  
  // Alias for src/ directory
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
