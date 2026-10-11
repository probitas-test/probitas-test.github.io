/**
 * API Documentation Page Templates
 */
import {
  EXPORT_KINDS,
  groupByKind,
  isDocumentedExport,
  partsToMarkdown,
} from "../../lib/api-docs.ts";
import {
  getPackageGroups,
  getPackageList,
  getTypeLinkMap,
  loadPackageDoc,
  type PackageGroup,
} from "../../../data/api-pages.ts";
import { basePath } from "../../lib/path.ts";
import { parseApiMarkdown } from "../../lib/markdown.ts";
import { Layout } from "../Layout.tsx";
import {
  ApiToc,
  EXPORT_KIND_INFO,
  ExportDoc,
  PackageSidebar,
} from "./components.tsx";

// ============================================================================
// API Index Page (lists all packages)
// ============================================================================

export async function ApiIndexPage() {
  const groups = await getPackageGroups();
  const packages = await getPackageList();

  // Count total exports
  const totalExports = packages.reduce((sum, p) => sum + p.exportCount, 0);

  return (
    <Layout
      title="API Reference - Probitas Documentation"
      description="Complete API reference for all Probitas packages including core, client, and SQL modules."
      pagePath="/api"
    >
      <div class="content-layout">
        <aside class="content-sidebar">
          <PackageSidebar groups={groups} />
        </aside>
        <main class="content-main">
          <article class="content-article">
            <header class="content-header">
              <h1>API Reference</h1>
            </header>
            <p class="api-intro">
              Complete API documentation for all <code>@probitas-test/*</code>{" "}
              packages. Browse <strong>{packages.length} packages</strong> with
              {" "}
              <strong>{totalExports} exports</strong>.
            </p>

            {groups.map((group) => (
              <PackageGroupSection key={group.name} group={group} />
            ))}
          </article>
        </main>
      </div>
    </Layout>
  );
}

interface PackageGroupSectionProps {
  group: PackageGroup;
}

function PackageGroupSection({ group }: PackageGroupSectionProps) {
  return (
    <section class="package-group-section">
      <h2>
        <i class="ti ti-package" /> {group.name}
      </h2>
      <div class="package-grid">
        {group.packages.map((pkg) => (
          <a
            key={pkg.name}
            href={basePath(`/api/${pkg.name}`)}
            class="package-card"
          >
            <h3>{pkg.specifier}</h3>
            <div class="package-meta">
              <span class="package-version">v{pkg.version}</span>
            </div>
            <div class="package-counts">
              {pkg.counts.classes > 0 && (
                <span class="count-item">
                  <i class="ti ti-box" /> {pkg.counts.classes}
                </span>
              )}
              {pkg.counts.interfaces > 0 && (
                <span class="count-item">
                  <i class="ti ti-puzzle" /> {pkg.counts.interfaces}
                </span>
              )}
              {pkg.counts.functions > 0 && (
                <span class="count-item">
                  <i class="ti ti-code" /> {pkg.counts.functions}
                </span>
              )}
              {pkg.counts.types > 0 && (
                <span class="count-item">
                  <i class="ti ti-tag" /> {pkg.counts.types}
                </span>
              )}
              {pkg.counts.variables > 0 && (
                <span class="count-item">
                  <i class="ti ti-variable" /> {pkg.counts.variables}
                </span>
              )}
              {pkg.counts.enums > 0 && (
                <span class="count-item">
                  <i class="ti ti-list" /> {pkg.counts.enums}
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// Package Documentation Page
// ============================================================================

interface PackagePageProps {
  packageName: string;
}

export async function PackagePage({ packageName }: PackagePageProps) {
  const doc = await loadPackageDoc(packageName);
  const groups = await getPackageGroups();

  if (!doc) {
    return <NotFoundPage packageName={packageName} />;
  }

  const exports = doc.exports.filter(isDocumentedExport);
  const grouped = groupByKind(exports);
  const groupsInOrder = EXPORT_KINDS.flatMap((kind) => {
    const items = grouped[kind];
    return items?.length ? [[kind, items] as const] : [];
  });
  const moduleDoc = partsToMarkdown(doc.moduleDoc?.summary);

  // Create set of local type names for linking
  const localTypes = new Set(exports.map((n) => n.name));

  // Get cross-package type linking map
  const typeLinkMap = await getTypeLinkMap();
  const typeToPackage = typeLinkMap.typeToPackage;

  return (
    <Layout
      title={`${doc.specifier} - API Reference - Probitas Documentation`}
      description={moduleDoc || `API documentation for ${doc.specifier}`}
      pagePath={`/api/${packageName}`}
      alternateJson={basePath(`/api/${packageName}/index.json`)}
      alternateMarkdown={basePath(`/api/${packageName}/index.md`)}
    >
      <div class="content-layout">
        <aside class="content-sidebar">
          <PackageSidebar groups={groups} currentPackage={packageName} />
        </aside>
        <main class="content-main">
          <div class="api-main-with-toc">
            <div class="content-article-container">
              <article class="content-article">
                <header class="content-header">
                  <h1>{doc.specifier}</h1>
                  <div class="content-toolbelt">
                    <a
                      href={basePath(`/api/${packageName}/index.md`)}
                      class="source-link md-source-link"
                      title="View Markdown"
                    >
                      <i class="ti ti-markdown" />
                    </a>
                    <a
                      href={basePath(`/api/${packageName}/index.json`)}
                      class="source-link json-source-link"
                      title="View JSON data"
                    >
                      <i class="ti ti-braces" />
                    </a>
                  </div>
                  <div class="content-header-meta">
                    <span class="package-version">v{doc.version}</span>
                    <a
                      href={`https://www.npmjs.com/package/@probitas-test/${doc.name}`}
                      class="npm-link"
                      target="_blank"
                      rel="noopener"
                    >
                      <i class="ti ti-external-link" /> View on npm
                    </a>
                    <a
                      href={`https://jsr.io/@probitas/${doc.name}`}
                      class="jsr-link"
                      target="_blank"
                      rel="noopener"
                    >
                      <i class="ti ti-external-link" /> View on JSR
                    </a>
                  </div>
                </header>

                {moduleDoc && (
                  <div
                    class="module-doc markdown-content"
                    dangerouslySetInnerHTML={{
                      __html: parseApiMarkdown(moduleDoc, {
                        typeToPackage,
                        localTypes,
                        currentPackage: packageName,
                      }),
                    }}
                  />
                )}

                <div class="api-install">
                  <h2>Installation</h2>
                  <pre>
                  <code class="language-bash">
                    npm install @probitas-test/{doc.name}
                  </code>
                  </pre>
                </div>

                {/* Render each kind group */}
                {groupsInOrder.map(([kind, items]) => (
                  <section key={kind} class="api-kind-section">
                    <h2 id={EXPORT_KIND_INFO[kind].id}>
                      <i class={`ti ${EXPORT_KIND_INFO[kind].icon}`} />{" "}
                      {EXPORT_KIND_INFO[kind].title}
                    </h2>
                    {items.map((reflection) => (
                      <ExportDoc
                        key={`${reflection.kind}:${reflection.name}`}
                        reflection={reflection}
                        localTypes={localTypes}
                        typeToPackage={typeToPackage}
                        currentPackage={packageName}
                      />
                    ))}
                  </section>
                ))}

                {exports.length === 0 && (
                  <p class="no-exports">
                    This package has no public exports. It may be a CLI tool or
                    internal module.
                  </p>
                )}
              </article>
            </div>
            <aside class="api-toc-sidebar">
              <ApiToc groups={groupsInOrder} />
            </aside>
          </div>
        </main>
      </div>
    </Layout>
  );
}

// ============================================================================
// 404 Page
// ============================================================================

interface NotFoundPageProps {
  packageName: string;
}

function NotFoundPage({ packageName }: NotFoundPageProps) {
  return (
    <Layout
      title="Package Not Found - Probitas Documentation"
      description={`Package ${packageName} not found`}
    >
      <div class="content-layout">
        <main class="content-main">
          <article class="content-article error-page">
            <header class="content-header">
              <h1>Package Not Found</h1>
            </header>
            <p>
              The package <code>@probitas-test/{packageName}</code> was not found.
            </p>
            <p>
              <a href={basePath("/api")}>← Back to API Reference</a>
            </p>
          </article>
        </main>
      </div>
    </Layout>
  );
}
