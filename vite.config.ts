import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ command, isPreview }) => ({
  server: { host: "0.0.0.0", port: 8080 },
  preview: { host: "127.0.0.1", port: 8081 },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    // Nitro builds the server. The "vercel" preset deploys to Vercel; use
    // "node-server" (or leave the preset out) to run with `node .output/server/index.mjs`.
    ...(command === "build" || isPreview ? [nitro({ preset: process.env.NITRO_PRESET ?? "node-server" })] : []),
    viteReact(),
  ],
}));
