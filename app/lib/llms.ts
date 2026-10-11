/**
 * LLM-friendly content generation for AI agents and tools
 *
 * Implements the llms.txt standard: https://llmstxt.org/
 */

import { basePath } from "./path.ts";
import { type PackageDoc, partsToMarkdown } from "./api-docs.ts";

/**
 * Documentation page metadata
 */
export interface DocPage {
  /** URL path (e.g., "/docs/scenario") */
  path: string;
  /** Page title */
  title: string;
  /** Brief description for LLM indexing */
  description: string;
}

/**
 * Site metadata for LLM content generation
 */
export interface SiteMetadata {
  name: string;
  description: string;
  github: string;
  npm: string;
  jsr: string;
}

/**
 * Package group for organizing API documentation
 */
export interface PackageGroup {
  name: string;
  packages: Array<{
    name: string;
    specifier: string;
  }>;
}

/**
 * Options for generating llms.txt content
 */
export interface GenerateLlmsTxtOptions {
  /** Site metadata */
  siteMetadata: SiteMetadata;
  /** Documentation pages */
  docPages: DocPage[];
  /** Package groups for API documentation */
  packageGroups: PackageGroup[];
  /** Function to load package documentation for description extraction */
  loadPackageDoc?: (packageName: string) => Promise<PackageDoc | null>;
}

/**
 * Extract the first line of documentation as a description
 */
function extractDescription(moduleDoc: string | undefined): string | null {
  if (!moduleDoc) return null;
  const firstLine = moduleDoc.split("\n")[0].trim();
  return firstLine ? firstLine : null;
}

/**
 * Get description for a package from its documentation
 */
async function getPackageDescription(
  packageName: string,
  loadPackageDoc?: (name: string) => Promise<PackageDoc | null>,
): Promise<string> {
  if (!loadPackageDoc) {
    return `${packageName} package`;
  }
  try {
    const doc = await loadPackageDoc(packageName);
    const desc = extractDescription(partsToMarkdown(doc?.moduleDoc?.summary));
    if (desc) return desc;
  } catch {
    // Fallback to default description
  }
  return `${packageName} package`;
}

/**
 * Resolve documentation path to markdown file path
 * Uses /path/index.md style for consistency
 */
function resolveDocMarkdownPath(path: string): string {
  return path.endsWith("/") ? `${path}index.md` : `${path}/index.md`;
}

/**
 * Generate /llms.txt content - an index of documentation pages
 * This serves as a "sitemap for AI" with brief descriptions
 */
export async function generateLlmsTxt(
  options: GenerateLlmsTxtOptions,
): Promise<string> {
  const { siteMetadata, docPages, packageGroups, loadPackageDoc } = options;
  const base = basePath("/");

  const lines: string[] = [
    `# ${siteMetadata.name}`,
    "",
    `> ${siteMetadata.description}`,
    "",
    "## Documentation",
    "",
    ...docPages.map((doc) =>
      `- [${doc.title}](${base}${resolveDocMarkdownPath(doc.path).slice(1) // Remove leading slash
      }): ${doc.description}`
    ),
    "",
    "## API Reference",
    "",
  ];

  // Add package groups
  for (const group of packageGroups) {
    lines.push(`### ${group.name}`, "");
    for (const pkg of group.packages) {
      const desc = await getPackageDescription(pkg.name, loadPackageDoc);
      lines.push(
        `- [\`${pkg.specifier}\`](${base}api/${pkg.name}/index.md): ${desc}`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## Links",
    "",
    `- [GitHub](${siteMetadata.github})`,
    `- [npm Package](${siteMetadata.npm})`,
    `- [JSR Package](${siteMetadata.jsr})`,
    "",
  );

  return lines.join("\n");
}
