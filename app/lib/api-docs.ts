/**
 * API documentation types and utilities
 *
 * The API data is TypeDoc's JSON output (one project per package, see
 * scripts/generate-api-docs.ts). These helpers read it for display.
 */
import type { JSONOutput } from "typedoc";

// ============================================================================
// Built-in Type Links
// ============================================================================

const MDN_BASE = "https://developer.mozilla.org/en-US/docs/Web/JavaScript";
const TS_BASE = "https://www.typescriptlang.org/docs/handbook";

/**
 * Map of built-in type names to their documentation URLs
 */
export const BUILTIN_TYPE_LINKS: Record<string, string> = {
  // JavaScript primitives (MDN)
  string: `${MDN_BASE}/Reference/Global_Objects/String`,
  number: `${MDN_BASE}/Reference/Global_Objects/Number`,
  boolean: `${MDN_BASE}/Reference/Global_Objects/Boolean`,
  symbol: `${MDN_BASE}/Reference/Global_Objects/Symbol`,
  bigint: `${MDN_BASE}/Reference/Global_Objects/BigInt`,
  null: `${MDN_BASE}/Reference/Operators/null`,
  undefined: `${MDN_BASE}/Reference/Global_Objects/undefined`,
  object: `${MDN_BASE}/Reference/Global_Objects/Object`,

  // JavaScript built-in objects (MDN)
  Array: `${MDN_BASE}/Reference/Global_Objects/Array`,
  Promise: `${MDN_BASE}/Reference/Global_Objects/Promise`,
  Map: `${MDN_BASE}/Reference/Global_Objects/Map`,
  Set: `${MDN_BASE}/Reference/Global_Objects/Set`,
  WeakMap: `${MDN_BASE}/Reference/Global_Objects/WeakMap`,
  WeakSet: `${MDN_BASE}/Reference/Global_Objects/WeakSet`,
  Date: `${MDN_BASE}/Reference/Global_Objects/Date`,
  RegExp: `${MDN_BASE}/Reference/Global_Objects/RegExp`,
  Error: `${MDN_BASE}/Reference/Global_Objects/Error`,
  Function: `${MDN_BASE}/Reference/Global_Objects/Function`,
  ArrayBuffer: `${MDN_BASE}/Reference/Global_Objects/ArrayBuffer`,
  Uint8Array: `${MDN_BASE}/Reference/Global_Objects/Uint8Array`,
  Int8Array: `${MDN_BASE}/Reference/Global_Objects/Int8Array`,
  Uint16Array: `${MDN_BASE}/Reference/Global_Objects/Uint16Array`,
  Int16Array: `${MDN_BASE}/Reference/Global_Objects/Int16Array`,
  Uint32Array: `${MDN_BASE}/Reference/Global_Objects/Uint32Array`,
  Int32Array: `${MDN_BASE}/Reference/Global_Objects/Int32Array`,
  Float32Array: `${MDN_BASE}/Reference/Global_Objects/Float32Array`,
  Float64Array: `${MDN_BASE}/Reference/Global_Objects/Float64Array`,
  DataView: `${MDN_BASE}/Reference/Global_Objects/DataView`,
  JSON: `${MDN_BASE}/Reference/Global_Objects/JSON`,
  Iterator: `${MDN_BASE}/Reference/Global_Objects/Iterator`,
  AsyncIterator: `${MDN_BASE}/Reference/Global_Objects/AsyncIterator`,
  Generator: `${MDN_BASE}/Reference/Global_Objects/Generator`,
  AsyncGenerator: `${MDN_BASE}/Reference/Global_Objects/AsyncGenerator`,
  Iterable: `${MDN_BASE}/Reference/Iteration_protocols#the_iterable_protocol`,
  AsyncIterable:
    `${MDN_BASE}/Reference/Iteration_protocols#the_async_iterator_and_async_iterable_protocols`,

  // TypeScript utility types
  Partial: `${TS_BASE}/utility-types.html#partialtype`,
  Required: `${TS_BASE}/utility-types.html#requiredtype`,
  Readonly: `${TS_BASE}/utility-types.html#readonlytype`,
  Record: `${TS_BASE}/utility-types.html#recordkeys-type`,
  Pick: `${TS_BASE}/utility-types.html#picktype-keys`,
  Omit: `${TS_BASE}/utility-types.html#omittype-keys`,
  Exclude: `${TS_BASE}/utility-types.html#excludeuniontype-excludedmembers`,
  Extract: `${TS_BASE}/utility-types.html#extracttype-union`,
  NonNullable: `${TS_BASE}/utility-types.html#nonnullabletype`,
  ReturnType: `${TS_BASE}/utility-types.html#returntypetype`,
  Parameters: `${TS_BASE}/utility-types.html#parameterstype`,
  InstanceType: `${TS_BASE}/utility-types.html#instancetypetype`,
  Awaited: `${TS_BASE}/utility-types.html#awaitedtype`,

  // TypeScript special types
  void: `${TS_BASE}/2/basic-types.html#void`,
  never: `${TS_BASE}/2/basic-types.html#never`,
  any: `${TS_BASE}/2/basic-types.html#any`,
  unknown: `${TS_BASE}/2/basic-types.html#unknown`,
};

// ============================================================================
// TypeDoc Model
// ============================================================================

export type DeclarationReflection = JSONOutput.DeclarationReflection;
export type SignatureReflection = JSONOutput.SignatureReflection;
export type ParameterReflection = JSONOutput.ParameterReflection;
export type TypeParameterReflection = JSONOutput.TypeParameterReflection;
export type ProjectReflection = JSONOutput.ProjectReflection;
export type SomeType = JSONOutput.SomeType;
export type Comment = JSONOutput.Comment;
export type CommentDisplayPart = JSONOutput.CommentDisplayPart;

/**
 * TypeDoc's `ReflectionKind` values, copied so that the site does not load
 * TypeDoc at runtime
 */
export const ReflectionKind = {
  Project: 0x1,
  Module: 0x2,
  Namespace: 0x4,
  Enum: 0x8,
  EnumMember: 0x10,
  Variable: 0x20,
  Function: 0x40,
  Class: 0x80,
  Interface: 0x100,
  Constructor: 0x200,
  Property: 0x400,
  Method: 0x800,
  CallSignature: 0x1000,
  IndexSignature: 0x2000,
  ConstructorSignature: 0x4000,
  Parameter: 0x8000,
  TypeLiteral: 0x10000,
  TypeParameter: 0x20000,
  Accessor: 0x40000,
  GetSignature: 0x80000,
  SetSignature: 0x100000,
  TypeAlias: 0x200000,
  Reference: 0x400000,
  Document: 0x800000,
} as const;

/** The kinds of export an API page lists, in display order */
export const EXPORT_KINDS = [
  "class",
  "interface",
  "function",
  "typeAlias",
  "variable",
  "enum",
] as const;

export type ExportKind = typeof EXPORT_KINDS[number];

const EXPORT_KIND_BY_REFLECTION_KIND = new Map<number, ExportKind>([
  [ReflectionKind.Class, "class"],
  [ReflectionKind.Interface, "interface"],
  [ReflectionKind.Function, "function"],
  [ReflectionKind.TypeAlias, "typeAlias"],
  [ReflectionKind.Variable, "variable"],
  [ReflectionKind.Enum, "enum"],
]);

/**
 * The export kind of a top-level reflection, or undefined for reflections an
 * API page does not list (namespaces, re-export references)
 */
export function exportKind(
  reflection: DeclarationReflection,
): ExportKind | undefined {
  return EXPORT_KIND_BY_REFLECTION_KIND.get(reflection.kind);
}

// ============================================================================
// Package Documentation
// ============================================================================

export interface PackageDoc {
  /** Package name without the scope (e.g., "probitas", "client-http") */
  name: string;
  /** npm package name (e.g., "@probitas-test/probitas") */
  specifier: string;
  /** Package version */
  version: string;
  /** Module-level documentation */
  moduleDoc?: Comment;
  /** Exported items */
  exports: DeclarationReflection[];
}

export interface ApiDocsIndex {
  /** All packages */
  packages: PackageInfo[];
}

export interface ExportCounts {
  classes: number;
  interfaces: number;
  functions: number;
  types: number;
  variables: number;
  enums: number;
}

export interface PackageInfo {
  name: string;
  specifier: string;
  version: string;
  exportCount: number;
  counts: ExportCounts;
}

/**
 * Read a package's TypeDoc project as the site's package model
 */
export function toPackageDoc(
  name: string,
  project: ProjectReflection,
): PackageDoc {
  resolveLinkTargets(project);
  return {
    name,
    specifier: project.name,
    version: project.packageVersion ?? "",
    moduleDoc: project.comment,
    exports: project.children ?? [],
  };
}

/**
 * Replace the reflection IDs that `{@link}` tags point at with the names the
 * page anchors use: `Name` for an export, `Name.member` for its member
 *
 * A link to a reflection the site does not render (such as a dropped
 * namespace) loses its target and renders as plain text.
 */
function resolveLinkTargets(project: ProjectReflection): void {
  const names = new Map<number, string>();
  for (const reflection of project.children ?? []) {
    names.set(reflection.id, reflection.name);
    for (const member of reflection.children ?? []) {
      names.set(member.id, `${reflection.name}.${member.name}`);
    }
  }

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const part = value as Record<string, unknown>;
    if (part.kind === "inline-tag" && typeof part.target === "number") {
      const qualifiedName = names.get(part.target);
      if (qualifiedName === undefined) {
        const text = String(part.text);
        const isCode = part.tag === "@linkcode";
        delete part.tag;
        delete part.target;
        Object.assign(
          part,
          isCode ? { kind: "code", text: `\`${text}\`` } : { kind: "text", text },
        );
      } else {
        part.target = { packageName: project.name, packagePath: "", qualifiedName };
      }
      return;
    }
    Object.values(value).forEach(visit);
  };
  visit(project);
}

/**
 * Count exports by kind
 */
export function countExports(exports: DeclarationReflection[]): ExportCounts {
  const count = (kind: ExportKind) =>
    exports.filter((r) => exportKind(r) === kind).length;
  return {
    classes: count("class"),
    interfaces: count("interface"),
    functions: count("function"),
    types: count("typeAlias"),
    variables: count("variable"),
    enums: count("enum"),
  };
}

// ============================================================================
// Comments
// ============================================================================

/**
 * Convert comment display parts to Markdown
 *
 * Inline `{@link}` tags are written back in JSDoc syntax; the Markdown
 * renderer turns them into links to API anchors.
 */
export function partsToMarkdown(parts?: CommentDisplayPart[]): string {
  if (!parts) return "";
  return parts.map((part) => {
    if (part.kind === "inline-tag") {
      if (
        part.tag === "@link" || part.tag === "@linkcode" ||
        part.tag === "@linkplain"
      ) {
        // A string target is a URL: link to it directly
        if (typeof part.target === "string") {
          const text = part.tag === "@linkcode" ? `\`${part.text}\`` : part.text;
          return `[${text}](${part.target})`;
        }
        const tag = part.tag === "@linkcode" ? "linkcode" : "link";
        const target = linkTargetName(part.target) ?? part.text;
        return target === part.text
          ? `{@${tag} ${target}}`
          : `{@${tag} ${target} ${part.text}}`;
      }
      return part.text;
    }
    return part.text;
  }).join("").trim();
}

function linkTargetName(
  target: JSONOutput.InlineTagDisplayPart["target"],
): string | undefined {
  return target && typeof target === "object"
    ? target.qualifiedName
    : undefined;
}

/**
 * The comment documenting a reflection
 *
 * TypeDoc attaches the comment of a function or method to its signature, and
 * that of an accessor to its getter.
 */
export function commentOf(
  reflection: DeclarationReflection | SignatureReflection,
): Comment | undefined {
  const declaration = reflection as DeclarationReflection;
  return reflection.comment ??
    declaration.signatures?.find((s) => s.comment)?.comment ??
    declaration.getSignature?.comment;
}

/**
 * Get the description of a reflection (its summary and remarks) as Markdown
 */
export function getDescription(
  reflection: DeclarationReflection | SignatureReflection,
): string | undefined {
  const comment = commentOf(reflection);
  const paragraphs = [
    partsToMarkdown(comment?.summary),
    ...blockTags(comment, "@remarks"),
  ].filter(Boolean);
  return paragraphs.join("\n\n") || undefined;
}

/**
 * Get just the first sentence or line of the description (for summaries)
 */
export function getDescriptionSummary(
  reflection: DeclarationReflection | SignatureReflection,
): string | undefined {
  const doc = getDescription(reflection);
  if (!doc) return undefined;

  // Try to get first sentence (ending with period followed by space/newline)
  const sentenceMatch = doc.match(/^([^.]+\.)\s/);
  if (sentenceMatch) {
    return sentenceMatch[1];
  }

  // Otherwise get first line
  const firstLine = doc.split("\n")[0].trim();
  return firstLine || undefined;
}

/**
 * Get the contents of a comment's block tags as Markdown
 *
 * A tag's name comes first when it has one, as with an `@example` whose first
 * line titles it.
 */
function blockTags(comment: Comment | undefined, tag: string): string[] {
  return (comment?.blockTags ?? [])
    .filter((t) => t.tag === tag)
    .map((t) =>
      [t.name, partsToMarkdown(t.content)].filter(Boolean).join("\n\n")
    )
    .filter(Boolean);
}

/**
 * Get the @example blocks of a reflection as Markdown
 */
export function getExamples(
  reflection: DeclarationReflection | SignatureReflection,
): string[] {
  return blockTags(commentOf(reflection), "@example");
}

/**
 * Get the documentation of each parameter of a signature, by name
 */
export function getParamDocs(
  signature: SignatureReflection | undefined,
): Map<string, string> {
  const result = new Map<string, string>();
  for (const param of signature?.parameters ?? []) {
    const doc = partsToMarkdown(param.comment?.summary);
    if (doc) result.set(param.name, doc);
  }
  return result;
}

/**
 * Get the @returns documentation of a signature
 */
export function getReturnDoc(
  signature: SignatureReflection | undefined,
): string | undefined {
  return blockTags(signature?.comment, "@returns")[0];
}

// ============================================================================
// Filtering and Grouping
// ============================================================================

/**
 * Check if a reflection should be included in documentation (not private)
 */
export function isPublic(
  reflection: DeclarationReflection | SignatureReflection,
): boolean {
  if (reflection.name.startsWith("_")) return false;
  if (reflection.flags.isPrivate || reflection.flags.isProtected) return false;
  const modifiers = reflection.comment?.modifierTags ?? [];
  return !modifiers.includes("@internal") && !modifiers.includes("@private");
}

/**
 * Check if a top-level reflection is an export an API page lists
 */
export function isDocumentedExport(reflection: DeclarationReflection): boolean {
  return exportKind(reflection) !== undefined && isPublic(reflection);
}

/**
 * The members of a class, interface, or object type that the page documents:
 * public, and declared on the type itself rather than inherited
 */
export function ownMembers(
  reflection: DeclarationReflection,
): DeclarationReflection[] {
  return (reflection.children ?? []).filter((member) =>
    isPublic(member) && !member.inheritedFrom
  );
}

/**
 * Group exports by kind for display
 */
export function groupByKind(
  reflections: DeclarationReflection[],
): Partial<Record<ExportKind, DeclarationReflection[]>> {
  const groups: Partial<Record<ExportKind, DeclarationReflection[]>> = {};
  for (const reflection of reflections) {
    const kind = exportKind(reflection);
    if (!kind) continue;
    (groups[kind] ??= []).push(reflection);
  }
  // Sort each group by name
  for (const group of Object.values(groups)) {
    group.sort((a, b) => a.name.localeCompare(b.name));
  }
  return groups;
}
