import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Built into dist/, which the backend serves at /admin. In development
// (`npm run dev`, http://localhost:5174/admin/) the API calls go to the
// backend on port 4000.
export default defineConfig({
  plugins: [react()],
  base: "/admin/",
  server: {
    port: 5174,
    proxy: { "/api": "http://localhost:4000" },
  },
});
