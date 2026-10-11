/**
 * Generate Markdown documentation for API packages
 *
 * This module converts PackageDoc data into a Markdown representation
 * suitable for LLMs and programmatic consumption. Type references are
 * collected and output as a Related Links section at the end.
 */
import type {
  DeclarationReflection,
  ExportKind,
  PackageDoc,
} from "./api-docs.ts";
import {
  BUILTIN_TYPE_LINKS,
  getDescription,
  getExamples,
  getParamDocs,
  getReturnDoc,
  groupByKind,
  isDocumentedExport,
  ownMembers,
  partsToMarkdown,
  ReflectionKind,
} from "./api-docs.ts";
import {
  formatClassSignature,
  formatConstructorSignature,
  formatFunctionSignature,
  formatInterfaceSignature,
  formatMethodSignature,
  formatTypeAliasSignature,
  formatVariableSignature,
} from "./signature-formatters.ts";
import { formatType } from "./type-format.ts";
import { TypeRefCollector } from "./type-references.ts";

/**
 * Get the base URL for the site from environment variable.
 * Falls back to the GitHub Pages URL.
 */
function getBaseUrl(): string {
  return import.meta.env?.BASE_URL_FULL ?? "https://probitas-test.github.io";
}

// ============================================================================
// Type Links
// ============================================================================

interface TypeLinkInfo {
  name: string;
  href: string;
  isBuiltin: boolean;
  isLocal: boolean;
  isCrossPackage: boolean;
}

/**
 * Resolve collected type references to links, sorted local first, then
 * cross-package, then built-in
 */
function resolveLinks(
  refs: Set<string>,
  localTypes: Set<string>,
  typeToPackage: Map<string, string>,
  currentPackage: string,
  baseUrl: string,
): TypeLinkInfo[] {
  const links: TypeLinkInfo[] = [];

  for (const name of refs) {
    if (name in BUILTIN_TYPE_LINKS) {
      links.push({
        name,
        href: BUILTIN_TYPE_LINKS[name],
        isBuiltin: true,
        isLocal: false,
        isCrossPackage: false,
      });
      continue;
    }

    if (localTypes.has(name)) {
      links.push({
        name,
        href: `${baseUrl}/api/${currentPackage}#${name}`,
        isBuiltin: false,
        isLocal: true,
        isCrossPackage: false,
      });
      continue;
    }

    const pkg = typeToPackage.get(name);
    if (pkg && pkg !== currentPackage) {
      links.push({
        name,
        href: `${baseUrl}/api/${pkg}#${name}`,
        isBuiltin: false,
        isLocal: false,
        isCrossPackage: true,
      });
    }
  }

  return links.sort((a, b) => {
    if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
    if (a.isCrossPackage !== b.isCrossPackage) {
      return a.isCrossPackage ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

// ============================================================================
// Section Generators
// ============================================================================

function codeBlock(code: string): string[] {
  return ["```typescript", code, "```", ""];
}

function paragraph(text: string | undefined): string[] {
  return text ? [text, ""] : [];
}

function examples(reflection: DeclarationReflection): string[] {
  const blocks = getExamples(reflection);
  if (blocks.length === 0) return [];
  // Examples are already Markdown, output as-is
  return ["**Example:**", "", ...blocks.flatMap((e) => [e.trim(), ""])];
}

/**
 * A bullet list of properties: `- [readonly] \`name?\`: \`Type\` — description`
 */
function propertyList(members: DeclarationReflection[]): string[] {
  const properties = members.filter((m) =>
    m.kind === ReflectionKind.Property || m.kind === ReflectionKind.Accessor
  );
  if (properties.length === 0) return [];
  return [
    "**Properties:**",
    "",
    ...properties.map((prop) => {
      const isAccessor = prop.kind === ReflectionKind.Accessor;
      const modifiers: string[] = [];
      if (prop.flags.isStatic) modifiers.push("static");
      if (isAccessor ? !prop.setSignature : prop.flags.isReadonly) {
        modifiers.push("readonly");
      }
      const prefix = modifiers.length > 0 ? `[${modifiers.join(", ")}] ` : "";
      const optional = prop.flags.isOptional ? "?" : "";
      const type = formatType(
        isAccessor ? prop.getSignature?.type : prop.type,
        { multiline: false },
      );
      const desc = getDescription(prop);
      return `- ${prefix}\`${prop.name}${optional}\`: \`${type}\`${
        desc ? ` — ${desc}` : ""
      }`;
    }),
    "",
  ];
}

function methodList(members: DeclarationReflection[]): string[] {
  const methods = members.filter((m) => m.kind === ReflectionKind.Method);
  if (methods.length === 0) return [];
  return [
    "**Methods:**",
    "",
    ...methods.flatMap((method) =>
      (method.signatures ?? []).flatMap((signature) => {
        const desc = getDescription(signature);
        return [
          "```typescript",
          formatMethodSignature(method, signature),
          "```",
          ...(desc ? ["", desc] : []),
          "",
        ];
      })
    ),
  ];
}

function generateFunctionMarkdown(reflection: DeclarationReflection): string[] {
  const signatures = reflection.signatures ?? [];
  if (signatures.length > 1) {
    return [
      `### \`${reflection.name}\` (${signatures.length} overloads)`,
      "",
      ...signatures.flatMap((signature, i) => [
        `**Overload ${i + 1}:**`,
        "",
        ...codeBlock(formatFunctionSignature(reflection.name, signature)),
        ...paragraph(getDescription(signature)),
      ]),
      ...examples(reflection),
    ];
  }

  const [signature] = signatures;
  if (!signature) return [];
  const lines = [
    `### \`${reflection.name}\``,
    "",
    ...codeBlock(formatFunctionSignature(reflection.name, signature)),
    ...paragraph(getDescription(reflection)),
  ];

  const params = signature.parameters ?? [];
  if (params.length > 0) {
    const paramDocs = getParamDocs(signature);
    lines.push("**Parameters:**", "");
    for (const param of params) {
      const optional = param.flags.isOptional ? " (optional)" : "";
      const type = formatType(param.type, { multiline: false });
      const doc = paramDocs.get(param.name);
      lines.push(
        `- \`${param.name}\`: \`${type}\`${optional}${doc ? ` — ${doc}` : ""}`,
      );
    }
    lines.push("");
  }

  const returnDoc = getReturnDoc(signature);
  lines.push(
    `**Returns:** \`${formatType(signature.type, { multiline: false })}\``,
  );
  if (returnDoc) lines.push("", returnDoc);
  lines.push("");

  lines.push(...examples(reflection));
  return lines;
}

function generateClassMarkdown(reflection: DeclarationReflection): string[] {
  const members = ownMembers(reflection);
  const constructors = members
    .filter((m) => m.kind === ReflectionKind.Constructor)
    .flatMap((m) => m.signatures ?? []);
  return [
    `### \`${reflection.name}\``,
    "",
    ...codeBlock(formatClassSignature(reflection)),
    ...paragraph(getDescription(reflection)),
    ...(constructors.length > 0
      ? [
        "**Constructor:**",
        "",
        ...constructors.flatMap((signature) =>
          codeBlock(formatConstructorSignature(reflection.name, signature))
        ),
      ]
      : []),
    ...propertyList(members),
    ...methodList(members),
    ...examples(reflection),
  ];
}

function generateInterfaceMarkdown(
  reflection: DeclarationReflection,
): string[] {
  const members = ownMembers(reflection);
  return [
    `### \`${reflection.name}\``,
    "",
    ...codeBlock(formatInterfaceSignature(reflection)),
    ...paragraph(getDescription(reflection)),
    ...propertyList(members),
    ...methodList(members),
    ...examples(reflection),
  ];
}

function generateTypeAliasMarkdown(
  reflection: DeclarationReflection,
): string[] {
  return [
    `### \`${reflection.name}\``,
    "",
    ...codeBlock(formatTypeAliasSignature(reflection)),
    ...paragraph(getDescription(reflection)),
    ...examples(reflection),
  ];
}

function generateVariableMarkdown(
  reflection: DeclarationReflection,
): string[] {
  return [
    `### \`${reflection.name}\``,
    "",
    ...codeBlock(formatVariableSignature(reflection)),
    ...paragraph(getDescription(reflection)),
    ...examples(reflection),
  ];
}

const SECTIONS: Array<
  [ExportKind, string, (reflection: DeclarationReflection) => string[]]
> = [
  ["class", "Classes", generateClassMarkdown],
  ["interface", "Interfaces", generateInterfaceMarkdown],
  ["function", "Functions", generateFunctionMarkdown],
  ["typeAlias", "Types", generateTypeAliasMarkdown],
  ["variable", "Variables", generateVariableMarkdown],
];

// ============================================================================
// Main Generator
// ============================================================================

export interface ApiMarkdownOptions {
  /** All packages for cross-package linking */
  allPackages?: PackageDoc[];
  /** Base URL for links */
  baseUrl?: string;
  /** Last updated timestamp (from file mtime) */
  updatedAt?: Date;
}

/**
 * Generate Markdown documentation for a package
 */
export function generateApiMarkdown(
  pkg: PackageDoc,
  options: ApiMarkdownOptions = {},
): string {
  const {
    allPackages = [],
    baseUrl = getBaseUrl(),
    updatedAt,
  } = options;

  const exports = pkg.exports.filter(isDocumentedExport);
  const localTypes = new Set(exports.map((r) => r.name));

  // Build cross-package type map
  const typeToPackage = new Map<string, string>();
  for (const p of allPackages) {
    if (p.name === pkg.name) continue;
    for (const reflection of p.exports) {
      if (isDocumentedExport(reflection)) {
        typeToPackage.set(reflection.name, p.name);
      }
    }
  }

  const lines: string[] = [
    `# ${pkg.specifier}`,
    "",
    `> Version: ${pkg.version}`,
    "",
    ...paragraph(partsToMarkdown(pkg.moduleDoc?.summary)),
  ];

  const collector = new TypeRefCollector();
  const grouped = groupByKind(exports);
  for (const [kind, title, generate] of SECTIONS) {
    const reflections = grouped[kind] ?? [];
    if (reflections.length === 0) continue;
    lines.push(`## ${title}`, "");
    for (const reflection of reflections) {
      collector.declaration(reflection);
      lines.push(...generate(reflection), "---", "");
    }
  }

  // Related Links section
  const links = resolveLinks(
    collector.refs,
    localTypes,
    typeToPackage,
    pkg.name,
    baseUrl,
  );
  if (links.length > 0) {
    lines.push("## Related Links", "");

    const localLinks = links.filter((l) => l.isLocal);
    const crossPkgLinks = links.filter((l) => l.isCrossPackage);
    const builtinLinks = links.filter((l) => l.isBuiltin);

    if (localLinks.length > 0) {
      lines.push("### This Package", "");
      for (const link of localLinks) {
        lines.push(`- [\`${link.name}\`](${link.href})`);
      }
      lines.push("");
    }

    if (crossPkgLinks.length > 0) {
      lines.push("### Other Packages", "");
      for (const link of crossPkgLinks) {
        const pkgName = typeToPackage.get(link.name);
        lines.push(
          `- [\`${link.name}\`](${link.href}) (@probitas-test/${pkgName})`,
        );
      }
      lines.push("");
    }

    if (builtinLinks.length > 0) {
      lines.push("### Built-in Types", "");
      for (const link of builtinLinks) {
        lines.push(`- [\`${link.name}\`](${link.href})`);
      }
      lines.push("");
    }
  }

  // Footer with last updated timestamp
  if (updatedAt) {
    lines.push("---", "");
    lines.push(`*Last updated: ${updatedAt.toISOString().split("T")[0]}*`);
  }

  return lines.join("\n");
}
