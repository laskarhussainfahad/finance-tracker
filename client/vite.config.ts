import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative paths so the built site works on GitHub Pages (github.io/finance-tracker/).
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    // During development, /api requests are forwarded to the Express server.
    proxy: { "/api": "http://localhost:4000" },
  },
});
