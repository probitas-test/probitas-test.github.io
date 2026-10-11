import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import honox from "honox/vite";
import ssg from "@hono/vite-ssg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// GitHub Pages base path (set via environment variable or default to root)
const base = process.env.BASE_PATH ?? "/";

/**
 * Keep Vite from resolving `typedoc`, which the site imports for types only
 *
 * HonoX walks the dependency tree of every file under app/ (type imports
 * included) to find islands, and following `typedoc` parses all of
 * TypeScript, stalling the build for minutes.
 */
function typedocTypesOnly(): Plugin {
  return {
    name: "typedoc-types-only",
    enforce: "pre",
    resolveId(id) {
      return id === "typedoc" ? { id, external: true } : null;
    },
  };
}

export default defineConfig(({ mode }) => {
  // Client build (JS only - CSS served from public/)
  if (mode === "client") {
    return {
      base,
      build: {
        rollupOptions: {
          input: ["/app/client.ts"],
          output: {
            entryFileNames: "static/[name].js",
          },
        },
        outDir: "dist",
        emptyOutDir: true,
        manifest: true,
      },
    };
  }

  // SSG build (default)
  return {
    base,
    build: {
      emptyOutDir: false, // Preserve client build assets
    },
    plugins: [
      typedocTypesOnly(),
      honox({
        client: {
          input: ["/app/client.ts"],
        },
        devServer: {
          // Pass base path to fix import.meta.env.BASE_URL in dev
          base,
        },
      }),
      ssg({ entry: "./app/server.ts" }),
    ],
    resolve: {
      alias: {
        // Resolve @tabler/icons JSON exports
        "@tabler/icons/tabler-nodes-outline.json": path.resolve(
          __dirname,
          "node_modules/@tabler/icons/tabler-nodes-outline.json",
        ),
      },
    },
  };
});
