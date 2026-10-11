/**
 * Server entry point for HonoX SSG
 *
 * This file registers explicit routes for JSON/Markdown endpoints
 * that don't fit well with file-based routing.
 */
import { Hono } from "hono";
import { createApp } from "honox/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PackageDoc } from "../data/api-pages.js";
import { type ProjectReflection, toPackageDoc } from "./lib/api-docs.js";
import {
  getPackageGroups,
  loadPackageDoc as loadPkg,
} from "../data/api-pages.js";
import { generateApiMarkdown } from "./lib/api-markdown.js";
import { rewriteMarkdownLinks } from "./lib/markdown.js";
import { generateLlmsTxt } from "./lib/llms.js";
import { docPages, siteMetadata } from "../data/docs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
const docsDir = path.resolve(__dirname, "../docs");

/**
 * Get list of API package names from index.json
 */
async function getApiPackageNames(): Promise<string[]> {
  const indexPath = path.join(dataDir, "api/index.json");
  const content = await readFile(indexPath, "utf-8");
  const index = JSON.parse(content);
  return index.packages.map((p: { name: string }) => p.name);
}

/**
 * Load a package document from JSON file
 */
async function loadPackageDoc(
  packageName: string,
): Promise<{ doc: PackageDoc; mtime: Date | undefined }> {
  const jsonPath = path.join(dataDir, `api/${packageName}.json`);
  const [content, fileStat] = await Promise.all([
    readFile(jsonPath, "utf-8"),
    stat(jsonPath),
  ]);
  return {
    doc: toPackageDoc(packageName, JSON.parse(content) as ProjectReflection),
    mtime: fileStat.mtime,
  };
}

/**
 * Load all package documents for cross-package linking
 */
async function loadAllPackages(): Promise<PackageDoc[]> {
  const packages = await getApiPackageNames();
  const docs: PackageDoc[] = [];
  for (const name of packages) {
    try {
      const { doc } = await loadPackageDoc(name);
      docs.push(doc);
    } catch {
      // Skip packages that fail to load
    }
  }
  return docs;
}

// Build documentation markdown path map
// Support both /docs.md and /docs/index.md URL styles for each doc page
const docMarkdownMap = new Map<string, string>();
for (const doc of docPages) {
  const filePath = path.resolve(__dirname, "..", doc.file);
  // Primary: /docs.md style
  docMarkdownMap.set(`${doc.path}.md`, filePath);
  // Alias: /docs/index.md style (for backwards compatibility and user expectation)
  docMarkdownMap.set(`${doc.path}/index.md`, filePath);
}

// Create a base Hono app that handles markdown and other special routes
const baseApp = new Hono();

// Redirect trailing slash to non-trailing slash (except root)
baseApp.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    const newPath = url.pathname.slice(0, -1) + url.search;
    return c.redirect(newPath, 301);
  }
  return next();
});

// Handle documentation markdown requests
// Register explicit routes for each doc page's .md endpoint
for (const [mdPath, filePath] of docMarkdownMap) {
  baseApp.get(mdPath, async (c) => {
    try {
      const content = await readFile(filePath, "utf-8");
      return c.text(rewriteMarkdownLinks(content), 200, {
        "Content-Type": "text/markdown; charset=utf-8",
      });
    } catch {
      return c.notFound();
    }
  });
}

// Create HonoX app with file-based routes
const honoxApp = createApp();

// Mount HonoX routes under base app (for all other paths)
baseApp.route("/", honoxApp);

const app = baseApp;

// LLM-friendly endpoint: llms.txt standard
app.get("/llms.txt", async (c) => {
  const packageGroups = await getPackageGroups();
  const content = await generateLlmsTxt({
    siteMetadata,
    docPages,
    packageGroups: packageGroups.map((g) => ({
      name: g.name,
      packages: g.packages.map((p) => ({
        name: p.name,
        specifier: p.specifier,
      })),
    })),
    loadPackageDoc: loadPkg,
  });
  return c.text(content, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
  });
});

// Home page markdown for LLMs
app.get("/index.md", async (c) => {
  const overviewPath = path.join(docsDir, "overview.md");
  const content = await readFile(overviewPath, "utf-8");
  const modified = [
    "*".repeat(80),
    "",
    "This is a Markdown page for LLMs. If you are LLMs, read this page.",
    "If you are human and want to visit Web page, visit /",
    "",
    "*".repeat(80),
    "",
    content,
  ].join("\n");
  return c.text(rewriteMarkdownLinks(modified), 200, {
    "Content-Type": "text/markdown; charset=utf-8",
  });
});

// API JSON endpoints: /api/:package/index.json
const packages = await getApiPackageNames();

for (const pkg of packages) {
  // JSON endpoint
  app.get(`/api/${pkg}/index.json`, async (c) => {
    try {
      const jsonPath = path.join(dataDir, `api/${pkg}.json`);
      const content = await readFile(jsonPath, "utf-8");
      return c.text(content, 200, {
        "Content-Type": "application/json; charset=utf-8",
      });
    } catch {
      return c.text("Not found", 404);
    }
  });

  // Markdown endpoint
  app.get(`/api/${pkg}/index.md`, async (c) => {
    try {
      const { doc, mtime } = await loadPackageDoc(pkg);
      const allPackages = await loadAllPackages();
      const markdown = generateApiMarkdown(doc, {
        allPackages,
        updatedAt: mtime,
      });
      return c.text(markdown, 200, {
        "Content-Type": "text/markdown; charset=utf-8",
      });
    } catch {
      return c.text("Not found", 404);
    }
  });
}

export default app;
