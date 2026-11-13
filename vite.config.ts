import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_API_TARGET || "http://localhost:8000";

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    // Keep every sample PDF a real file: a small one inlined into the script could not be shown in a frame.
    build: { assetsInlineLimit: 0 },
    server: {
      port: 5173,
      strictPort: true,
      proxy: { "/v1": { target, changeOrigin: true } },
    },
  };
});
