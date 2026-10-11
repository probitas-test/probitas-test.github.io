/**
 * API documentation data loader
 *
 * Loads pre-generated API documentation from data/api/ directory.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ApiDocsIndex,
  isDocumentedExport,
  type PackageDoc,
  type PackageInfo,
  type ProjectReflection,
  toPackageDoc,
} from "../app/lib/api-docs.js";

// Re-export for convenience
export type { ApiDocsIndex, PackageDoc, PackageInfo };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_DATA_DIR = path.resolve(__dirname, "./api/");

let cachedIndex: ApiDocsIndex | null = null;
const packageCache = new Map<string, PackageDoc>();

/**
 * Load the API documentation index
 */
export async function loadApiIndex(): Promise<ApiDocsIndex> {
  if (cachedIndex) return cachedIndex;

  const indexPath = path.join(API_DATA_DIR, "index.json");
  const content = await readFile(indexPath, "utf-8");
  cachedIndex = JSON.parse(content);
  return cachedIndex!;
}

/**
 * Load documentation for a specific package
 */
export async function loadPackageDoc(name: string): Promise<PackageDoc | null> {
  if (packageCache.has(name)) {
    return packageCache.get(name)!;
  }

  try {
    const filePath = path.join(API_DATA_DIR, `${name}.json`);
    const content = await readFile(filePath, "utf-8");
    const doc = toPackageDoc(name, JSON.parse(content) as ProjectReflection);
    packageCache.set(name, doc);
    return doc;
  } catch {
    return null;
  }
}

/**
 * Get all package info for navigation
 */
export async function getPackageList(): Promise<PackageInfo[]> {
  const index = await loadApiIndex();
  return index.packages;
}

/**
 * Group packages by category for navigation
 */
export interface PackageGroup {
  name: string;
  packages: PackageInfo[];
}

export async function getPackageGroups(): Promise<PackageGroup[]> {
  const packages = await getPackageList();

  // Group by prefix pattern
  const corePackages: PackageInfo[] = [];
  const clientPackages: PackageInfo[] = [];

  for (const pkg of packages) {
    if (pkg.name.startsWith("client")) {
      clientPackages.push(pkg);
    } else {
      corePackages.push(pkg);
    }
  }

  const groups: PackageGroup[] = [];

  if (corePackages.length > 0) {
    groups.push({ name: "Core", packages: corePackages });
  }
  if (clientPackages.length > 0) {
    groups.push({ name: "Clients", packages: clientPackages });
  }

  return groups;
}

/**
 * Type link info: maps type name to package name for cross-package linking
 */
export interface TypeLinkMap {
  /** Set of all type names across all packages */
  allTypes: Set<string>;
  /** Map from type name to package name (for types exported by multiple packages, first wins) */
  typeToPackage: Map<string, string>;
}

let cachedTypeLinkMap: TypeLinkMap | null = null;

/**
 * Build a map of all exported type names across all packages
 */
export async function getTypeLinkMap(): Promise<TypeLinkMap> {
  if (cachedTypeLinkMap) return cachedTypeLinkMap;

  const packages = await getPackageList();
  const allTypes = new Set<string>();
  const typeToPackage = new Map<string, string>();

  for (const pkg of packages) {
    const doc = await loadPackageDoc(pkg.name);
    if (!doc) continue;

    for (const node of doc.exports) {
      if (!isDocumentedExport(node)) continue;

      // Only add if not already mapped (first package wins)
      if (!typeToPackage.has(node.name)) {
        typeToPackage.set(node.name, pkg.name);
      }
      allTypes.add(node.name);
    }
  }

  cachedTypeLinkMap = { allTypes, typeToPackage };
  return cachedTypeLinkMap;
}
