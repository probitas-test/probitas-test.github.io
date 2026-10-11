/**
 * Generate API documentation from the @probitas-test/* npm packages
 *
 * This script lists the packages of the probitas-test npm organization,
 * installs their latest versions into a temporary directory, runs TypeDoc
 * on each package's entry point, and saves the resulting TypeDoc JSON to
 * data/api/ for use by the documentation site.
 *
 * Usage: npm run generate-api
 */

import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  Application,
  type JSONOutput,
  LogLevel,
  normalizePath,
} from "typedoc";
import {
  type ApiDocsIndex,
  countExports,
  isDocumentedExport,
  type PackageInfo,
  ReflectionKind,
} from "../app/lib/api-docs.ts";

const API_DIR = fileURLToPath(new URL("../data/api/", import.meta.url));
const SCOPE = "@probitas-test";
const REGISTRY = "https://registry.npmjs.org";

interface NpmPackage {
  /** Package name without the scope (e.g., "client-http") */
  name: string;
  version: string;
}

/**
 * List the packages of the npm organization with their latest versions
 */
async function fetchPackages(): Promise<NpmPackage[]> {
  console.log(`Fetching package list for ${SCOPE} from npm...`);
  const response = await fetch(`${REGISTRY}/-/org/probitas-test/package`);
  if (!response.ok) {
    throw new Error(`Failed to fetch packages: ${response.status}`);
  }
  const names = Object.keys(await response.json())
    .filter((name) => name.startsWith(`${SCOPE}/`))
    .map((name) => name.slice(SCOPE.length + 1))
    .sort();

  const packages: NpmPackage[] = [];
  for (const name of names) {
    const latest = await fetch(`${REGISTRY}/${SCOPE}/${name}/latest`);
    if (!latest.ok) {
      throw new Error(`Failed to resolve ${SCOPE}/${name}: ${latest.status}`);
    }
    const { version } = await latest.json() as { version: string };
    packages.push({ name, version });
  }
  return packages;
}

/**
 * Install the packages into a fresh directory so TypeDoc sees exactly the
 * published files
 */
async function installPackages(
  workDir: string,
  packages: NpmPackage[],
): Promise<void> {
  console.log("Installing packages...");
  await writeFile(
    path.join(workDir, "package.json"),
    JSON.stringify({ private: true }),
  );
  await promisify(execFile)(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      ...packages.map((pkg) => `${SCOPE}/${pkg.name}@${pkg.version}`),
    ],
    { cwd: workDir },
  );
}

/**
 * Resolve the TypeScript source a package exposes as its main entry point
 *
 * The packages publish their sources next to the compiled output and point
 * the `bun` condition at them; the sources carry the module documentation
 * that the declaration files drop.
 */
async function resolveEntryPoint(packageDir: string): Promise<string> {
  const manifest = JSON.parse(
    await readFile(path.join(packageDir, "package.json"), "utf-8"),
  );
  const main = manifest.exports?.["."];
  const entry = typeof main === "string" ? main : main?.bun ?? main?.types;
  if (!entry) {
    throw new Error(`${manifest.name} has no main entry point`);
  }
  return path.join(packageDir, entry);
}

/**
 * Run TypeDoc on a package and return its project JSON
 */
async function convertPackage(
  workDir: string,
  pkg: NpmPackage,
): Promise<JSONOutput.ProjectReflection> {
  const packageDir = path.join(workDir, "node_modules", SCOPE, pkg.name);
  const entryPoint = await resolveEntryPoint(packageDir);

  const tsconfig = path.join(workDir, `tsconfig.${pkg.name}.json`);
  await writeFile(
    tsconfig,
    JSON.stringify({
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        types: [],
      },
      files: [entryPoint],
    }),
  );

  const app = await Application.bootstrap({
    entryPoints: [entryPoint],
    tsconfig,
    name: `${SCOPE}/${pkg.name}`,
    readme: "none",
    disableSources: true,
    // The published sources are not type-checked against every optional
    // peer dependency; documentation does not need a clean compile.
    skipErrorChecking: true,
    excludeExternals: true,
    // Other @probitas-test packages are part of the documented surface: a
    // package re-exporting their symbols documents them as its own, the way
    // users import them.
    externalPattern: [`**/node_modules/!(${SCOPE})/**`],
    excludePrivate: true,
    excludeProtected: true,
    excludeInternal: true,
    logLevel: LogLevel.Warn,
  });

  const project = await app.convert();
  if (!project) {
    throw new Error(`TypeDoc failed to convert ${SCOPE}/${pkg.name}`);
  }
  const json = app.serializer.projectToObject(
    project,
    normalizePath(workDir),
  );
  json.packageVersion = pkg.version;
  return json;
}

/**
 * Drop what the site does not use
 *
 * Namespaces (e.g. `export * as client`) repeat other packages' whole API and
 * are not rendered, and groups, categories, and the file registry only serve
 * TypeDoc's own HTML theme.
 */
function trimProject(
  json: JSONOutput.ProjectReflection,
): JSONOutput.ProjectReflection {
  const { groups: _g, categories: _c, files: _f, symbolIdMap: _s, ...rest } =
    json;
  return {
    ...rest,
    children: (json.children ?? []).filter((child) =>
      child.kind !== ReflectionKind.Namespace &&
      child.kind !== ReflectionKind.Module
    ).map(stripGroups),
  } as JSONOutput.ProjectReflection;
}

function stripGroups<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripGroups) as T;
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "groups" || key === "categories") continue;
      result[key] = stripGroups(child);
    }
    return result as T;
  }
  return value;
}

async function writeJson(
  dir: string,
  file: string,
  value: unknown,
): Promise<void> {
  await writeFile(path.join(dir, file), `${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<void> {
  const packages = await fetchPackages();
  console.log(`Found ${packages.length} packages\n`);

  const workDir = await mkdtemp(path.join(tmpdir(), "probitas-api-docs-"));
  try {
    await installPackages(workDir, packages);

    // Write everything aside first so that a failure leaves data/api intact
    const outDir = path.join(workDir, "api");
    await mkdir(outDir);

    const infos: PackageInfo[] = [];
    for (const pkg of packages) {
      console.log(`Processing ${SCOPE}/${pkg.name}@${pkg.version}...`);
      const project = trimProject(await convertPackage(workDir, pkg));
      await writeJson(outDir, `${pkg.name}.json`, project);

      const exports = (project.children ?? []).filter(isDocumentedExport);
      infos.push({
        name: pkg.name,
        specifier: `${SCOPE}/${pkg.name}`,
        version: pkg.version,
        exportCount: exports.length,
        counts: countExports(exports),
      });
      console.log(`  Saved ${exports.length} exports to ${pkg.name}.json`);
    }

    const index: ApiDocsIndex = { packages: infos };
    await writeJson(outDir, "index.json", index);

    await rm(API_DIR, { recursive: true, force: true });
    await cp(outDir, API_DIR, { recursive: true });
    console.log(`\nSaved index with ${infos.length} packages`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
