#!/usr/bin/env -S deno run --allow-run --allow-write --allow-read --allow-net
/**
 * Generate API documentation from @probitas/* packages
 *
 * This script fetches the list of @probitas packages from JSR,
 * runs `deno doc --json` for each package, and saves the output
 * to data/api/ for use by the documentation site.
 *
 * Usage: npm run generate-api
 */

import type {
  ApiDocsIndex,
  DenoDocOutput,
  DocNode,
  ExportCounts,
  PackageDoc,
  PackageInfo,
} from "../app/lib/api-docs.ts";

const API_DIR = new URL("../data/api/", import.meta.url);

// Packages to exclude from API documentation. `client-deno-kv` and `scenario`
// stay listed on JSR but are no longer part of Probitas.
const EXCLUDED_PACKAGES = new Set(["cli", "client-deno-kv", "scenario"]);

interface JsrPackage {
  scope: string;
  name: string;
  latestVersion: string;
}

/**
 * Fetch all @probitas packages from JSR API
 */
async function fetchPackages(): Promise<JsrPackage[]> {
  console.log("Fetching package list from JSR...");

  const response = await fetch(
    "https://jsr.io/api/scopes/probitas/packages",
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch packages: ${response.status}`);
  }

  const data = await response.json();
  return data.items.map((item: JsrPackage) => ({
    scope: item.scope,
    name: item.name,
    latestVersion: item.latestVersion,
  }));
}

/**
 * Run deno doc --json for a package
 */
async function getPackageDoc(
  specifier: string,
): Promise<DenoDocOutput | null> {
  const command = new Deno.Command("deno", {
    args: ["doc", "--no-lock", "--json", specifier],
    stdout: "piped",
    stderr: "piped",
    env: {
      ...Deno.env.toObject(),
      NO_COLOR: "1",
    },
  });

  const { code, stdout, stderr } = await command.output();

  if (code !== 0) {
    const errorText = new TextDecoder().decode(stderr);
    console.error(`  Failed to get docs for ${specifier}: ${errorText}`);
    return null;
  }

  const text = new TextDecoder().decode(stdout);
  const output = JSON.parse(text);
  // The site renders the version 1 schema (a flat `nodes` array). Newer Deno
  // releases emit version 2, which nests symbols per module.
  if (output.version !== 1 || !Array.isArray(output.nodes)) {
    throw new Error(
      `deno doc emitted JSON schema version ${output.version}; this script ` +
        "needs version 1 (put Deno 2.6 first on PATH)",
    );
  }
  return output;
}

/**
 * Extract module-level documentation
 */
function extractModuleDoc(nodes: DocNode[]): string | undefined {
  const moduleDoc = nodes.find((n) => n.kind === "moduleDoc");
  return moduleDoc?.jsDoc?.doc;
}

/**
 * Filter and process exports
 */
function processExports(nodes: DocNode[]): DocNode[] {
  return nodes.filter((node) => {
    // Skip moduleDoc entries
    if (node.kind === "moduleDoc") return false;
    // Skip import re-exports without explicit declaration
    if (node.kind === "import") return false;
    // Skip private items
    if (node.name.startsWith("_")) return false;
    return true;
  });
}

/**
 * Count exports by kind
 */
function countExports(exports: DocNode[]): ExportCounts {
  return {
    classes: exports.filter((n) => n.kind === "class").length,
    interfaces: exports.filter((n) => n.kind === "interface").length,
    functions: exports.filter((n) => n.kind === "function").length,
    types: exports.filter((n) => n.kind === "typeAlias").length,
    variables: exports.filter((n) => n.kind === "variable").length,
    enums: exports.filter((n) => n.kind === "enum").length,
  };
}

/**
 * Generate documentation for a single package
 */
async function generatePackageDoc(pkg: JsrPackage): Promise<PackageDoc | null> {
  const specifier = `jsr:@${pkg.scope}/${pkg.name}@${pkg.latestVersion}`;
  console.log(`Processing ${specifier}...`);

  const docOutput = await getPackageDoc(specifier);
  if (!docOutput) return null;

  const moduleDoc = extractModuleDoc(docOutput.nodes);
  const exports = processExports(docOutput.nodes);

  return {
    name: pkg.name,
    specifier: `@${pkg.scope}/${pkg.name}`,
    version: pkg.latestVersion,
    moduleDoc,
    exports,
  };
}

/**
 * Save package documentation to file
 */
async function savePackageDoc(doc: PackageDoc): Promise<void> {
  const filename = new URL(`${doc.name}.json`, API_DIR);
  await Deno.writeTextFile(
    filename,
    JSON.stringify(doc, null, 2),
  );
  console.log(`  Saved ${doc.exports.length} exports to ${doc.name}.json`);
}

/**
 * Generate and save index file
 */
async function saveIndex(packages: PackageInfo[]): Promise<void> {
  const index: ApiDocsIndex = {
    packages,
  };

  const filename = new URL("index.json", API_DIR);
  await Deno.writeTextFile(
    filename,
    JSON.stringify(index, null, 2),
  );
  console.log(`Saved index with ${packages.length} packages`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Ensure output directory exists
  await Deno.mkdir(API_DIR, { recursive: true });

  // Fetch all packages
  const packages = (await fetchPackages()).filter((pkg) => {
    if (EXCLUDED_PACKAGES.has(pkg.name)) {
      console.log(`Skipping ${pkg.name} (excluded)`);
      return false;
    }
    return true;
  });
  console.log(`Found ${packages.length} packages\n`);

  // Generate docs for each package
  const packageInfos: PackageInfo[] = [];
  const results: PackageDoc[] = [];

  await updatePackageDependencies(packages);

  for (const pkg of packages) {
    const doc = await generatePackageDoc(pkg);
    if (doc) {
      results.push(doc);
      packageInfos.push({
        name: doc.name,
        specifier: doc.specifier,
        version: doc.version,
        exportCount: doc.exports.length,
        counts: countExports(doc.exports),
      });
    }
  }

  console.log(`\nGenerated docs for ${results.length} packages`);

  // Save individual package docs
  for (const doc of results) {
    await savePackageDoc(doc);
  }

  // Save index
  await saveIndex(packageInfos);

  // Format generated files
  console.log("\nFormatting generated files...");
  await formatGeneratedFiles();

  console.log("\nDone!");
}

/**
 * Update package dependencies by forcing a cache refresh
 *
 * This ensures we have the latest versions of all packages
 * before generating documentation.
 */
async function updatePackageDependencies(
  packages: JsrPackage[],
): Promise<void> {
  const specifiers = packages.map(
    (pkg) => `jsr:@${pkg.scope}/${pkg.name}@${pkg.latestVersion}`,
  );

  console.log("Updating package dependencies...");

  const command = new Deno.Command("deno", {
    args: ["cache", "--no-lock", "-r", ...specifiers],
    stdout: "inherit",
    stderr: "inherit",
  });

  const { code } = await command.output();
  if (code !== 0) {
    throw new Error("Failed to update package dependencies");
  }

  console.log("Package dependencies updated\n");
}

/**
 * Run deno fmt on generated API docs
 */
async function formatGeneratedFiles(): Promise<void> {
  const command = new Deno.Command("deno", {
    args: ["fmt", API_DIR.pathname],
    stdout: "inherit",
    stderr: "inherit",
  });

  const { code } = await command.output();
  if (code !== 0) {
    console.error("Warning: deno fmt failed");
  }
}

// Run
main().catch((error) => {
  console.error("Error:", error);
  Deno.exit(1);
});
