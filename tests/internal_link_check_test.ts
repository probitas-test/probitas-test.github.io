import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { basePath, siteMetadata } from "../data/docs.ts";

const SRC_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SITE_ROOT = resolve(SRC_ROOT, "dist");
const FILES = new Map<string, File | Error>();

const SKIP_PATTERNS = [
  /pagefind/,
  /api/,
];

type Link = [path: string, fragment: string | null];
type File = {
  type: "markdown";
  path: string;
  links: Set<Link>;
  ids: null;
} | {
  type: "html";
  path: string;
  links: Set<Link>;
  ids: Set<string>;
};

/**
 * Whether a file holds Markdown or plain text: the SSG writes the Markdown
 * pages as `*.md.html`, which GitHub Pages serves at their `*.md` URLs
 */
function isMarkdownFile(path: string): boolean {
  return [".md", ".txt", ".md.html"].some((ext) => path.endsWith(ext));
}

function findFilesToCrawl(): string[] {
  return readdirSync(SITE_ROOT, { recursive: true, encoding: "utf-8" })
    .map((entry) => join(SITE_ROOT, entry))
    .filter(isMarkdownFile)
    .filter((path) => !SKIP_PATTERNS.some((pattern) => pattern.test(path)))
    .toSorted();
}

function isTargetLink(link: string): boolean {
  const excludes = ["mailto:", "tel:", "data:", "http:", "https:"];
  if (excludes.some((prefix) => link.startsWith(prefix))) {
    return false;
  }
  return link.endsWith(".html") || link.endsWith(".md") ||
    link.endsWith(".txt") || link.endsWith("/");
}

function normalizeLink(link: string, htmlMode: boolean): Link {
  const [path, fragment = null] = link.split("#");
  const cleanPath = path.split("?")[0];
  const basePaths = new Set<string>();
  if (basePath) {
    basePaths.add(basePath);
  }
  try {
    const { pathname } = new URL(siteMetadata.baseUrl);
    if (pathname && pathname !== "/") {
      basePaths.add(pathname);
    }
  } catch {
    // Ignore invalid baseUrl; basePaths will rely on BASE_PATH.
  }
  let normalizedPath = cleanPath;
  for (const candidate of basePaths) {
    const normalizedCandidate = candidate.endsWith("/")
      ? candidate.slice(0, -1)
      : candidate;
    if (
      normalizedCandidate &&
      normalizedPath.startsWith(normalizedCandidate)
    ) {
      const nextPath = normalizedPath.slice(normalizedCandidate.length);
      normalizedPath = nextPath || "/";
      break;
    }
  }
  if (!cleanPath) {
    return ["", fragment];
  }
  if (htmlMode && normalizedPath.endsWith("/")) {
    return [`${normalizedPath}index.html`, fragment];
  }
  return [normalizedPath, fragment];
}

function readFile(filePath: string): File {
  if (isMarkdownFile(filePath)) {
    return readMarkdownFile(filePath);
  } else if (filePath.endsWith(".html")) {
    return readHtmlFile(filePath);
  } else {
    throw new Error(`Unsupported file type: ${filePath}`);
  }
}

function readMarkdownFile(path: string): File {
  const content = readFileSync(path, "utf-8");
  const markdownLinkRegex = /\[[^\]]+\]\(([^\)]+)\)/g;
  // Find all internal links
  const links = new Set<Link>();
  for (const match of content.matchAll(markdownLinkRegex)) {
    const link = match[1].trim();
    if (link && isTargetLink(link)) links.add(normalizeLink(link, false));
  }
  return { type: "markdown", path, links, ids: null } as const;
}

/**
 * Collect the values of an attribute across the elements of an HTML page
 *
 * The site generator writes every attribute quoted, which this relies on.
 */
function attributeValues(content: string, name: string): string[] {
  const pattern = new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, "g");
  return [...content.matchAll(pattern)].map((m) => (m[1] ?? m[2]).trim());
}

function readHtmlFile(path: string): File {
  const content = readFileSync(path, "utf-8");
  // Find all internal links
  const links = new Set<Link>();
  for (const link of [
    ...attributeValues(content, "href"),
    ...attributeValues(content, "src"),
  ]) {
    if (link && isTargetLink(link)) links.add(normalizeLink(link, true));
  }
  // Find all IDs
  const ids = new Set(attributeValues(content, "id").filter(Boolean));
  return { type: "html", path, links, ids } as const;
}

/**
 * Load a linked file, falling back to `<path>.html` the way GitHub Pages
 * serves the generated `*.md.html` pages at their `*.md` URLs
 */
function loadFile(resolvedPath: string): File | Error {
  for (const candidate of [resolvedPath, `${resolvedPath}.html`]) {
    let file = FILES.get(candidate);
    if (!file) {
      try {
        file = readFile(candidate);
      } catch (err: unknown) {
        file = err instanceof Error ? err : new Error(String(err));
      }
      FILES.set(candidate, file);
    }
    if (!(file instanceof Error)) return file;
  }
  return FILES.get(resolvedPath)!;
}

function checkLink(
  [path, fragment]: Link,
  base: string,
): { exists: boolean; resolvedPath: string } {
  const resolvePath = (path: string): string => {
    if (path.startsWith("/")) {
      return resolve(SITE_ROOT, path.substring(1));
    }
    return resolve(base, path);
  };
  const resolvedPath = resolvePath(path);
  const targetFile = loadFile(resolvedPath);
  if (targetFile instanceof Error) {
    return { exists: false, resolvedPath };
  }
  if (fragment && targetFile.type === "html") {
    return { exists: targetFile.ids.has(fragment), resolvedPath };
  }
  return { exists: true, resolvedPath };
}

test("Site Link Checker", async (t) => {
  // Gather all HTML and MD files in the SITE_ROOT
  const filesToCrawl = findFilesToCrawl();
  assert.ok(
    filesToCrawl.length > 0,
    "No files found to check in `dist` directory.",
  );

  // Read all files and extract links
  const filesToCheck: File[] = filesToCrawl.map(readFile);

  const normalizePath = (path: string) => path.replace(SITE_ROOT, "");
  const formatLink = ([path, fragment]: Link) =>
    fragment ? `${path}#${fragment}` : path;

  for (const file of filesToCheck) {
    for (const link of file.links) {
      const linkStr = formatLink(link);
      const filePath = normalizePath(file.path);
      await t.test(`Check ${linkStr} from ${filePath}`, () => {
        const { exists, resolvedPath } = checkLink(link, dirname(file.path));
        const resolvedLinkStr = normalizePath(resolvedPath);
        assert.ok(
          exists,
          `Internal file link broken: ${linkStr} (from ${filePath} to ${resolvedLinkStr})`,
        );
      });
    }
  }
});
