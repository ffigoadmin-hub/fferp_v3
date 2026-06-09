import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { qrcode } from "vite-plugin-qrcode";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), qrcode()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // pdfjs-dist v5 ships ESM-only — exclude from CJS pre-bundling
    exclude: ["pdfjs-dist"],
  },
  build: {
    rollupOptions: {
      // Treat pdfjs-dist as external so Rollup doesn't try to bundle it
      external: (id) => id.startsWith("pdfjs-dist"),
    },
    // Increase chunk size limit to avoid warnings on large ERP bundle
    chunkSizeWarningLimit: 3000,
  },
}));
