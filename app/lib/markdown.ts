/**
 * Markdown rendering utilities
 */
import { readFile } from "node:fs/promises";
import { marked, type Tokens } from "marked";
import { basePath } from "./path.ts";

/** Generate slug from text (for heading IDs) */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/`([^`]+)`/g, "$1") // Remove inline code backticks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

// Configure marked with custom heading and link renderers
marked.use({
  gfm: true, // GitHub Flavored Markdown
  breaks: false,
  renderer: {
    heading(this: unknown, token: Tokens.Heading): string {
      const id = slugify(token.text);
      const text = this
        ? (this as any).parser.parseInline(token.tokens)
        : token.text;
      return `<h${token.depth} id="${id}">${text}</h${token.depth}>\n`;
    },
    link(token: Tokens.Link): string {
      // Add basePath to internal links (starting with /)
      let href = token.href;
      if (href.startsWith("/") && !href.startsWith("//")) {
        href = basePath(href);
      }
      const title = token.title ? ` title="${token.title}"` : "";
      return `<a href="${href}"${title}>${token.text}</a>`;
    },
    table(token: Tokens.Table): string {
      // Wrap table in scrollable container for mobile
      let header = "";
      let body = "";

      // Build header row
      let headerRow = "";
      for (let j = 0; j < token.header.length; j++) {
        const cell = token.header[j];
        const align = token.align[j];
        const alignAttr = align ? ` style="text-align:${align}"` : "";
        const content = (this as any).parser.parseInline(cell.tokens);
        headerRow += `<th${alignAttr}>${content}</th>`;
      }
      header = `<thead><tr>${headerRow}</tr></thead>`;

      // Build body rows
      if (token.rows.length > 0) {
        let bodyRows = "";
        for (let i = 0; i < token.rows.length; i++) {
          const row = token.rows[i];
          let rowHtml = "";
          for (let j = 0; j < row.length; j++) {
            const cell = row[j];
            const align = token.align[j];
            const alignAttr = align ? ` style="text-align:${align}"` : "";
            const content = (this as any).parser.parseInline(cell.tokens);
            rowHtml += `<td${alignAttr}>${content}</td>`;
          }
          bodyRows += `<tr>${rowHtml}</tr>`;
        }
        body = `<tbody>${bodyRows}</tbody>`;
      }

      return `<div class="table-wrapper"><table>${header}${body}</table></div>\n`;
    },
  },
});

/**
 * Parse markdown content to HTML
 * @param content - Markdown content
 * @param headerExtra - Optional HTML to insert after h1 inside header
 */
export function parseMarkdown(content: string, headerExtra?: string): string {
  const html = marked.parse(content, { async: false }) as string;
  // Wrap first h1 in <header class="content-header">
  const extra = headerExtra ?? "";
  return html.replace(
    /^(<h1[^>]*>.*?<\/h1>)/,
    `<header class="content-header">$1${extra}</header>`,
  );
}

/**
 * Options for parsing API documentation markdown
 */
export interface ApiMarkdownOptions {
  /** Map of type names to package names for cross-package linking */
  typeToPackage?: Map<string, string>;
  /** Set of local type names in the current package */
  localTypes?: Set<string>;
  /** Current package name (e.g., "builder") */
  currentPackage?: string;
}

/**
 * Process JSDoc link tags ({@link name} and {@linkcode name}) to HTML links
 *
 * Supports formats:
 * - {@link TypeName} - creates a link with regular text
 * - {@linkcode TypeName} - creates a link with code formatting
 * - {@link TypeName description} - link with custom description text
 */
function processJsDocLinks(
  content: string,
  options: ApiMarkdownOptions,
): string {
  const { typeToPackage, localTypes, currentPackage } = options;
  const base = basePath("/");

  // Match {@link name} or {@linkcode name} with optional description
  // Pattern: {@link(code)? name (optional description)}
  // Name must not contain } or whitespace
  const linkPattern = /\{@(link|linkcode)\s+([^\s}]+)(?:\s+([^}]+))?\}/g;

  return content.replace(linkPattern, (_, tag, name, description) => {
    const isCode = tag === "linkcode";
    const displayText = description?.trim() || name;

    // A member (`Type.member`) has its anchor at `Type-member` on the page of
    // the package exporting `Type`
    const [typeName, ...member] = name.split(".");
    const anchor = member.length > 0
      ? `${typeName}-${member.join(".")}`
      : typeName;

    // Determine the target URL
    let href: string | null = null;

    // Check if it's a local type in the current package
    if (localTypes?.has(typeName) && currentPackage) {
      href = `${base}api/${currentPackage}#${anchor}`;
    } // Check if it's in another package
    else if (typeToPackage?.has(typeName)) {
      const targetPackage = typeToPackage.get(typeName)!;
      href = `${base}api/${targetPackage}#${anchor}`;
    } // Default: link to current package anchor (best effort)
    else if (currentPackage) {
      href = `${base}api/${currentPackage}#${anchor}`;
    }

    // Format the display text
    const formattedText = isCode ? `<code>${displayText}</code>` : displayText;

    // Return link or just formatted text if no href could be determined
    if (href) {
      return `<a href="${href}" class="type-link">${formattedText}</a>`;
    }
    return formattedText;
  });
}

/**
 * Parse API documentation markdown with JSDoc link support
 *
 * This function processes JSDoc {@link} and {@linkcode} tags before
 * parsing as markdown, creating proper links to API documentation.
 */
export function parseApiMarkdown(
  content: string,
  options: ApiMarkdownOptions = {},
): string {
  const processed = processJsDocLinks(content, options);
  return parseMarkdown(processed);
}

/** Read and parse a markdown file */
export async function readMarkdownFile(path: string): Promise<string> {
  const content = await readFile(path, "utf-8");
  return parseMarkdown(content);
}

/** Extract title from markdown (first h1) */
export function extractTitle(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1];
}

/**
 * Rewrite internal links in markdown content to include basePath.
 * Transforms [text](/path) to [text](/basePath/path) for internal links.
 */
export function rewriteMarkdownLinks(content: string): string {
  const base = basePath("/");
  // Match markdown links: [text](url) or [text](url "title")
  // Only rewrite internal links starting with /
  return content.replace(
    /\[([^\]]*)\]\((\/[^)"'\s]*)(\s+"[^"]*")?\)/g,
    (_, text, href, title) => {
      if (href.startsWith("//")) {
        const titlePart = title ?? "";
        return `[${text}](${href}${titlePart})`;
      }

      const [path, fragment] = href.split("#");
      const normalizedPath = path.endsWith("/") ? `${path}index.md` : path;
      let nextHref = fragment
        ? `${normalizedPath}#${fragment}`
        : normalizedPath;
      if (base && base !== "/") {
        // Remove leading slash from nextHref to avoid double slashes
        const cleanPath = nextHref.startsWith("/")
          ? nextHref.slice(1)
          : nextHref;
        nextHref = `${base}${cleanPath}`;
      }

      const titlePart = title ?? "";
      return `[${text}](${nextHref}${titlePart})`;
    },
  );
}

/** Extract table of contents from markdown headings (h2 only) */
export function extractToc(
  content: string,
): Array<{ id: string; label: string; level: number }> {
  const headingRegex = /^(##)\s+(.+)$/gm;
  const toc: Array<{ id: string; label: string; level: number }> = [];

  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const rawLabel = match[2];

    // Clean label for display
    const label = rawLabel
      .replace(/`([^`]+)`/g, "$1") // Remove inline code backticks
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // Remove links

    // Use same slugify function as renderer
    const id = slugify(rawLabel);

    toc.push({ id, label, level });
  }

  return toc;
}
