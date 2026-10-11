/**
 * API documentation components
 */
import type { Child } from "hono/jsx";
import type {
  DeclarationReflection,
  ParameterReflection,
  SignatureReflection,
  SomeType,
} from "../../lib/api-docs.ts";
import {
  exportKind,
  type ExportKind,
  getDescription,
  getDescriptionSummary,
  getExamples,
  getParamDocs,
  getReturnDoc,
  isPublic,
  ownMembers,
  ReflectionKind,
} from "../../lib/api-docs.ts";
import { parseApiMarkdown } from "../../lib/markdown.ts";
import {
  formatClassSignature,
  formatConstructorSignature,
  formatFunctionSignature,
  formatInterfaceSignature,
  formatMethodSignature,
  formatTypeAliasSignature,
  formatVariableSignature,
} from "../../lib/signature-formatters.ts";
import { typeTokens } from "../../lib/type-format.ts";
import {
  extractDeclarationRefs,
  TypeRefCollector,
} from "../../lib/type-references.ts";
import { basePath } from "../../lib/path.ts";

// ============================================================================
// Type Display Components (with linking)
// ============================================================================

interface TypeLinkContext {
  /** Set of local type names that should link to anchors on this page */
  localTypes?: Set<string>;
  /** Map from type name to package name for cross-package linking */
  typeToPackage?: Map<string, string>;
  /** Current package name (to avoid linking to self) */
  currentPackage?: string;
}

/**
 * The URL of an export's anchor on its package page
 */
function apiHref(packageName: string, name: string): string {
  return basePath(`/api/${packageName}#${name}`);
}

interface TypeDisplayProps extends TypeLinkContext {
  type?: SomeType;
}

export function TypeDisplay({ type, ...ctx }: TypeDisplayProps) {
  if (!type) return <span class="type-unknown">unknown</span>;
  return (
    <code class="type-code">
      {typeTokens(type).map((token) =>
        typeof token === "string" ? token : renderTypeName(token.ref, ctx)
      )}
    </code>
  );
}

/**
 * Render a type name with appropriate link
 *
 * Link priority:
 * 1. Local types (defined in current package) - same-page anchor
 * 2. Cross-package types (defined in other packages) - link to that package
 * 3. Built-in types and unknown types - no link (user prefers no external links)
 */
function renderTypeName(name: string, ctx: TypeLinkContext): Child {
  const { localTypes, typeToPackage, currentPackage } = ctx;

  // Check for local type (defined in this package - same-page anchor)
  if (localTypes?.has(name)) {
    return (
      <a href={`#${name}`} class="type-link type-link-local">
        {name}
      </a>
    );
  }

  // Check for cross-package type
  const targetPackage = typeToPackage?.get(name);
  if (targetPackage && targetPackage !== currentPackage) {
    return (
      <a
        href={apiHref(targetPackage, name)}
        class="type-link type-link-cross-package"
      >
        {name}
      </a>
    );
  }

  // Built-in types and unknown types - no link
  return name;
}

// ============================================================================
// Type Reference Linking
// ============================================================================

interface LinkableType {
  name: string;
  href: string;
  isCrossPackage: boolean;
}

/**
 * Filter type refs to only linkable ones (local or cross-package)
 */
function getLinkableTypes(
  refs: Set<string>,
  { localTypes, typeToPackage, currentPackage }: TypeLinkContext,
): LinkableType[] {
  const result: LinkableType[] = [];

  for (const name of refs) {
    if (localTypes?.has(name)) {
      result.push({ name, href: `#${name}`, isCrossPackage: false });
      continue;
    }

    const targetPackage = typeToPackage?.get(name);
    if (targetPackage && targetPackage !== currentPackage) {
      result.push({
        name,
        href: apiHref(targetPackage, name),
        isCrossPackage: true,
      });
    }
  }

  // Sort alphabetically
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

interface RelatedTypesProps extends TypeLinkContext {
  /** All type refs extracted from the declaration */
  typeRefs: Set<string>;
}

/**
 * Related Types section component
 */
function RelatedTypes({ typeRefs, ...ctx }: RelatedTypesProps) {
  const linkable = getLinkableTypes(typeRefs, ctx);

  if (linkable.length === 0) return null;

  return (
    <div class="api-related-types">
      <h5>
        <i class="ti ti-link" /> Links
      </h5>
      <ul class="related-types-list">
        {linkable.map((t) => (
          <li key={t.name}>
            <a
              href={t.href}
              class={`type-link ${
                t.isCrossPackage ? "type-link-cross-package" : "type-link-local"
              }`}
            >
              {t.name}
            </a>
            {t.isCrossPackage && (
              <span class="related-type-package">
                {ctx.typeToPackage?.get(t.name)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// Member Summary Table (for interface/type overview)
// ============================================================================

interface MemberSummaryTableProps {
  /** Parent type name (used for generating anchor IDs) */
  parentName: string;
  members: DeclarationReflection[];
}

/**
 * Summary table for properties/methods overview
 * Each name links to the detailed section below
 */
function MemberSummaryTable({ parentName, members }: MemberSummaryTableProps) {
  if (members.length === 0) return null;

  return (
    <div class="api-member-summary">
      <table class="member-summary-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.name}>
              <td>
                <a href={`#${parentName}-${member.name}`} class="member-link">
                  <code>{member.name}</code>
                  {isMethod(member) && (
                    <span class="method-indicator">()</span>
                  )}
                </a>
              </td>
              <td class="member-summary-desc">
                {getDescriptionSummary(member) || (
                  <span class="no-desc">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Markdown Display
// ============================================================================

interface MarkdownBlockProps extends TypeLinkContext {
  text?: string;
  class: string;
}

/**
 * Render documentation Markdown with JSDoc link support
 */
function MarkdownBlock({ text, class: className, ...ctx }: MarkdownBlockProps) {
  if (!text) return null;
  return (
    <div
      class={`${className} api-markdown`}
      dangerouslySetInnerHTML={{ __html: parseApiMarkdown(text, ctx) }}
    />
  );
}

interface DescriptionProps extends TypeLinkContext {
  text?: string;
}

export function Description({ text, ...ctx }: DescriptionProps) {
  return <MarkdownBlock text={text} class="api-description" {...ctx} />;
}

interface ExamplesProps extends TypeLinkContext {
  examples: string[];
}

export function Examples({ examples, ...ctx }: ExamplesProps) {
  if (examples.length === 0) return null;

  return (
    <div class="api-examples">
      <h5>Examples</h5>
      {examples.map((example, i) => (
        // Examples may hold a title or description followed by code blocks
        <div
          key={i}
          class="example-markdown"
          dangerouslySetInnerHTML={{
            __html: parseApiMarkdown(example.trim(), ctx),
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Signature Display
// ============================================================================

function SignatureBlock(
  { code, class: className = "api-signature" }: {
    code: string;
    class?: string;
  },
) {
  return (
    <div class={className}>
      <pre>
        <code class="language-typescript">{code}</code>
      </pre>
    </div>
  );
}

interface ParamListProps extends TypeLinkContext {
  params: ParameterReflection[];
  paramDocs?: Map<string, string>;
}

export function ParamList({ params, paramDocs, ...ctx }: ParamListProps) {
  if (params.length === 0) return null;

  return (
    <div class="api-params">
      <h5>Parameters</h5>
      <ul class="param-list">
        {params.map((param) => (
          <li key={param.name} class="param-item">
            <div class="param-header">
              <code class="param-name">
                {param.flags.isRest && "..."}
                {param.name}
                {param.flags.isOptional && (
                  <span class="param-optional">?</span>
                )}
              </code>
              <span class="param-type">
                <TypeDisplay type={param.type} {...ctx} />
              </span>
            </div>
            <MarkdownBlock
              text={paramDocs?.get(param.name)}
              class="param-desc"
              {...ctx}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ReturnsProps extends TypeLinkContext {
  signature: SignatureReflection;
}

function Returns({ signature, ...ctx }: ReturnsProps) {
  const returnDoc = getReturnDoc(signature);
  if (!returnDoc) return null;
  return (
    <div class="api-returns">
      <h5>Returns</h5>
      <p>
        <TypeDisplay type={signature.type} {...ctx} />
      </p>
      <MarkdownBlock text={returnDoc} class="returns-desc" {...ctx} />
    </div>
  );
}

// ============================================================================
// Item Layout
// ============================================================================

interface ItemHeaderProps {
  kind: string;
  name: string;
  children?: Child;
}

function ItemHeader({ kind, name, children }: ItemHeaderProps) {
  return (
    <div class="api-item-header">
      <span class="api-kind">{kind}</span>
      <h4>
        <a href={`#${name}`} class="anchor-link">#</a>
        {name}
        {children}
      </h4>
    </div>
  );
}

// ============================================================================
// Members (properties and methods)
// ============================================================================

function isMethod(member: DeclarationReflection): boolean {
  return member.kind === ReflectionKind.Method;
}

function isProperty(member: DeclarationReflection): boolean {
  return member.kind === ReflectionKind.Property ||
    member.kind === ReflectionKind.Accessor;
}

interface MembersProps extends TypeLinkContext {
  /** Parent type name (used for generating anchor IDs) */
  parentName: string;
  members: DeclarationReflection[];
}

/**
 * The summary table, properties, and methods of a class, interface, or
 * object type
 */
function Members({ parentName, members, ...ctx }: MembersProps) {
  const properties = members.filter(isProperty);
  const methods = members.filter(isMethod);
  return (
    <>
      <MemberSummaryTable
        parentName={parentName}
        members={[...properties, ...methods]}
      />
      {properties.length > 0 && (
        <div class="api-properties">
          <h5>Properties</h5>
          <ul class="property-list">
            {properties.map((property) => (
              <PropertyItem
                key={property.name}
                parentName={parentName}
                property={property}
                {...ctx}
              />
            ))}
          </ul>
        </div>
      )}
      {methods.length > 0 && (
        <div class="api-methods">
          <h5>Methods</h5>
          {methods.map((method) => (
            <MethodItem
              key={method.name}
              parentName={parentName}
              method={method}
              {...ctx}
            />
          ))}
        </div>
      )}
    </>
  );
}

interface PropertyItemProps extends TypeLinkContext {
  parentName: string;
  property: DeclarationReflection;
}

function PropertyItem({ parentName, property, ...ctx }: PropertyItemProps) {
  // An accessor reads as a property; without a setter it is read-only
  const isAccessor = property.kind === ReflectionKind.Accessor;
  const type = isAccessor ? property.getSignature?.type : property.type;
  const readonly = isAccessor
    ? !property.setSignature
    : property.flags.isReadonly;
  return (
    <li id={`${parentName}-${property.name}`} class="property-item">
      <div class="property-header">
        {property.flags.isStatic && (
          <span class="member-badge member-static">static</span>
        )}
        {readonly && <span class="member-badge member-readonly">readonly</span>}
        <code class="property-name">
          {property.name}
          {property.flags.isOptional && <span class="param-optional">?</span>}
        </code>
        <span class="property-type">
          <TypeDisplay type={type} {...ctx} />
        </span>
      </div>
      <MarkdownBlock
        text={getDescription(property)}
        class="property-desc"
        {...ctx}
      />
    </li>
  );
}

interface MethodItemProps extends TypeLinkContext {
  parentName: string;
  method: DeclarationReflection;
}

function MethodItem({ parentName, method, ...ctx }: MethodItemProps) {
  return (
    <div class="method-item" id={`${parentName}-${method.name}`}>
      {(method.signatures ?? []).map((signature, i) => (
        <div key={i}>
          <SignatureBlock
            class="method-signature api-signature"
            code={formatMethodSignature(method, signature)}
          />
          <MarkdownBlock
            text={getDescription(signature)}
            class="method-desc"
            {...ctx}
          />
          <ParamList
            params={signature.parameters ?? []}
            paramDocs={getParamDocs(signature)}
            {...ctx}
          />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Function Documentation
// ============================================================================

interface ReflectionDocProps extends TypeLinkContext {
  reflection: DeclarationReflection;
}

export function FunctionDoc({ reflection, ...ctx }: ReflectionDocProps) {
  const signatures = reflection.signatures ?? [];
  const [main] = signatures;
  if (!main) return null;
  const hasOverloads = signatures.length > 1;
  // TypeDoc keeps a function's documentation on the signature it was written
  // for; the first documented one describes the function as a whole
  const documented = signatures.find((s) => s.comment) ?? main;

  return (
    <div class="api-item api-function" id={reflection.name}>
      <ItemHeader kind="function" name={reflection.name}>
        {hasOverloads && (
          <span class="overload-count">({signatures.length} overloads)</span>
        )}
      </ItemHeader>

      <SignatureBlock code={formatFunctionSignature(reflection.name, main)} />
      <Description text={getDescription(reflection)} {...ctx} />
      <ParamList
        params={main.parameters ?? []}
        paramDocs={getParamDocs(documented)}
        {...ctx}
      />
      <Returns signature={documented} {...ctx} />
      <Examples examples={getExamples(reflection)} {...ctx} />
      <RelatedTypes typeRefs={extractDeclarationRefs(reflection)} {...ctx} />

      {hasOverloads && (
        <details class="api-overloads">
          <summary>
            <i class="ti ti-chevron-right" />
            Show all {signatures.length} overloads
          </summary>
          <div class="overloads-content">
            {signatures.map((signature, index) => (
              <div key={index} class="overload-item">
                <div class="overload-header">
                  <span class="overload-index">#{index + 1}</span>
                </div>
                <SignatureBlock
                  code={formatFunctionSignature(reflection.name, signature)}
                />
                <Description text={getDescription(signature)} {...ctx} />
                <ParamList
                  params={signature.parameters ?? []}
                  paramDocs={getParamDocs(signature)}
                  {...ctx}
                />
                <Returns signature={signature} {...ctx} />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ============================================================================
// Class Documentation
// ============================================================================

export function ClassDoc({ reflection, ...ctx }: ReflectionDocProps) {
  const members = ownMembers(reflection);
  const constructors = members
    .filter((m) => m.kind === ReflectionKind.Constructor)
    .flatMap((m) => m.signatures ?? []);
  const extendedTypes = reflection.extendedTypes ?? [];
  const implementedTypes = reflection.implementedTypes ?? [];

  return (
    <div class="api-item api-class" id={reflection.name}>
      <ItemHeader kind="class" name={reflection.name} />
      <SignatureBlock code={formatClassSignature(reflection)} />

      {/* Hierarchy info (extends/implements) */}
      {(extendedTypes.length > 0 || implementedTypes.length > 0) && (
        <div class="api-hierarchy">
          <HierarchyItem label="Extends" types={extendedTypes} {...ctx} />
          <HierarchyItem label="Implements" types={implementedTypes} {...ctx} />
        </div>
      )}

      <Description text={getDescription(reflection)} {...ctx} />
      <Examples examples={getExamples(reflection)} {...ctx} />

      {constructors.length > 0 && (
        <div class="api-constructor">
          <h5>Constructor</h5>
          {constructors.map((signature, i) => (
            <div key={i} class="constructor-signature api-signature">
              <pre>
                <code class="language-typescript">
                  {formatConstructorSignature(reflection.name, signature)}
                </code>
              </pre>
              <MarkdownBlock
                text={getDescription(signature)}
                class="constructor-desc"
                {...ctx}
              />
            </div>
          ))}
        </div>
      )}

      <Members parentName={reflection.name} members={members} {...ctx} />
      <RelatedTypes typeRefs={extractDeclarationRefs(reflection)} {...ctx} />
    </div>
  );
}

interface HierarchyItemProps extends TypeLinkContext {
  label: string;
  types: SomeType[];
}

function HierarchyItem({ label, types, ...ctx }: HierarchyItemProps) {
  if (types.length === 0) return null;
  return (
    <div class="hierarchy-item">
      <span class="hierarchy-label">{label}</span>
      <span class="hierarchy-value">
        {types.map((type, i) => (
          <>
            {i > 0 && ", "}
            <TypeDisplay key={i} type={type} {...ctx} />
          </>
        ))}
      </span>
    </div>
  );
}

// ============================================================================
// Interface Documentation
// ============================================================================

export function InterfaceDoc({ reflection, ...ctx }: ReflectionDocProps) {
  return (
    <div class="api-item api-interface" id={reflection.name}>
      <ItemHeader kind="interface" name={reflection.name} />
      <SignatureBlock code={formatInterfaceSignature(reflection)} />
      <Description text={getDescription(reflection)} {...ctx} />
      <Examples examples={getExamples(reflection)} {...ctx} />
      <Members
        parentName={reflection.name}
        members={ownMembers(reflection)}
        {...ctx}
      />
      <RelatedTypes typeRefs={extractDeclarationRefs(reflection)} {...ctx} />
    </div>
  );
}

// ============================================================================
// Type Alias Documentation
// ============================================================================

export function TypeAliasDoc({ reflection, ...ctx }: ReflectionDocProps) {
  // An object type reads like an interface: list its members. TypeDoc puts
  // the members of an object literal alias on the alias itself.
  const declaration = reflection.type?.type === "reflection"
    ? reflection.type.declaration
    : reflection;
  const members = (declaration.children ?? []).filter(isPublic);

  return (
    <div class="api-item api-type-alias" id={reflection.name}>
      <ItemHeader kind="type" name={reflection.name} />
      <SignatureBlock code={formatTypeAliasSignature(reflection)} />
      <Description text={getDescription(reflection)} {...ctx} />
      <Examples examples={getExamples(reflection)} {...ctx} />
      <Members parentName={reflection.name} members={members} {...ctx} />
      <RelatedTypes typeRefs={extractDeclarationRefs(reflection)} {...ctx} />
    </div>
  );
}

// ============================================================================
// Variable Documentation
// ============================================================================

export function VariableDoc({ reflection, ...ctx }: ReflectionDocProps) {
  return (
    <div class="api-item api-variable" id={reflection.name}>
      <ItemHeader
        kind={reflection.flags.isConst ? "const" : "let"}
        name={reflection.name}
      />
      <SignatureBlock code={formatVariableSignature(reflection)} />
      <Description text={getDescription(reflection)} {...ctx} />
      <Examples examples={getExamples(reflection)} {...ctx} />
      <RelatedTypes
        typeRefs={new TypeRefCollector().type(reflection.type).refs}
        {...ctx}
      />
    </div>
  );
}

// ============================================================================
// Generic Export Renderer
// ============================================================================

export function ExportDoc({ reflection, ...ctx }: ReflectionDocProps) {
  switch (exportKind(reflection)) {
    case "function":
      return <FunctionDoc reflection={reflection} {...ctx} />;
    case "class":
      return <ClassDoc reflection={reflection} {...ctx} />;
    case "interface":
      return <InterfaceDoc reflection={reflection} {...ctx} />;
    case "typeAlias":
      return <TypeAliasDoc reflection={reflection} {...ctx} />;
    case "variable":
      return <VariableDoc reflection={reflection} {...ctx} />;
    default:
      // Skip unsupported kinds
      return null;
  }
}

// ============================================================================
// TOC for API items
// ============================================================================

/** Display title, icon, and anchor of each export kind */
export const EXPORT_KIND_INFO: Record<
  ExportKind,
  { title: string; icon: string; id: string }
> = {
  class: { title: "Classes", icon: "ti-box", id: "category-classes" },
  interface: {
    title: "Interfaces",
    icon: "ti-puzzle",
    id: "category-interfaces",
  },
  function: { title: "Functions", icon: "ti-code", id: "category-functions" },
  typeAlias: { title: "Types", icon: "ti-tag", id: "category-types" },
  variable: {
    title: "Variables",
    icon: "ti-variable",
    id: "category-variables",
  },
  enum: { title: "Enums", icon: "ti-list", id: "category-enums" },
};

interface ApiTocProps {
  /** Exports grouped by kind, in display order */
  groups: ReadonlyArray<readonly [ExportKind, DeclarationReflection[]]>;
}

export function ApiToc({ groups }: ApiTocProps) {
  return (
    <nav class="scrollable-nav api-toc">
      <h3>On this page</h3>
      {groups.map(([kind, items]) => {
        const info = EXPORT_KIND_INFO[kind];
        return (
          <div key={kind} class="toc-group">
            <h4>
              <a href={`#${info.id}`}>
                <i class={`ti ${info.icon}`} /> {info.title}
              </a>
            </h4>
            <ul>
              {items.map((item) => (
                <li key={item.name}>
                  <a href={`#${item.name}`}>{item.name}</a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

// ============================================================================
// Package Sidebar
// ============================================================================

interface PackageSidebarProps {
  groups: Array<{
    name: string;
    packages: Array<{ name: string; specifier: string }>;
  }>;
  currentPackage?: string;
}

export function PackageSidebar(
  { groups, currentPackage }: PackageSidebarProps,
) {
  return (
    <>
      {/* Mobile: Package selector dropdown */}
      <div class="api-package-select-wrapper">
        <i class="ti ti-package" />
        <select
          class="api-package-select"
          onchange={`location.href = '${basePath("/api/")}' + this.value`}
          aria-label="Select package"
        >
          <option value="" disabled selected={!currentPackage}>
            Select a package...
          </option>
          {groups.map((group) => (
            <optgroup key={group.name} label={group.name}>
              {group.packages.map((pkg) => (
                <option
                  key={pkg.name}
                  value={pkg.name}
                  selected={pkg.name === currentPackage}
                >
                  {pkg.specifier}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <i class="ti ti-chevron-down" />
      </div>

      {/* Desktop: Full navigation */}
      <nav class="scrollable-nav api-package-nav">
        <h3>Packages</h3>
        {groups.map((group) => (
          <div key={group.name} class="package-group">
            <h4>{group.name}</h4>
            <ul>
              {group.packages.map((pkg) => (
                <li
                  key={pkg.name}
                  class={pkg.name === currentPackage ? "active" : ""}
                >
                  <a href={basePath(`/api/${pkg.name}`)}>{pkg.name}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
