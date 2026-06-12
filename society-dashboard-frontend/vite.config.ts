// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      proxy: {
        // Proxy /api/exec -> Apps Script exec URL (development only)
        "/api/exec": {
          target:
            "https://script.google.com/macros/s/AKfycbwfC19iRvRpzy_BITKluNYNwtpoBivsrdjyzhJYoarx-8A0je2-R35wmP31VA1OGD6BjQ/exec",
          changeOrigin: true,
          secure: true,
          rewrite: (path: string) => path.replace(/^\/api\/exec/, ""),
        },
      },
    },
  },
});
