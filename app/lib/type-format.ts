/**
 * Type formatting for API documentation
 *
 * Types are formatted to a list of tokens: plain text, and references to
 * named types. Joining the tokens gives the type as a string; renderers turn
 * the references into links, and the Related Types sections collect them.
 */
import type {
  DeclarationReflection,
  ParameterReflection,
  SignatureReflection,
  SomeType,
  TypeParameterReflection,
} from "./api-docs.ts";
import { ReflectionKind } from "./api-docs.ts";

export type TypeToken = string | { ref: string };

export interface FormatOptions {
  /**
   * Break long unions, intersections, object types, and nested conditional
   * types over several lines (for code blocks)
   */
  multiline?: boolean;
  /** Current indentation level (used for nested multi-line types) */
  indent?: number;
}

/** Line length above which multi-line formatting breaks a type */
const LINE_LENGTH_THRESHOLD = 80;

/**
 * Join tokens into a string
 */
export function tokensToString(tokens: TypeToken[]): string {
  return tokens.map((t) => typeof t === "string" ? t : t.ref).join("");
}

/**
 * Format a type as a string
 */
export function formatType(
  type: SomeType | undefined,
  options: FormatOptions = { multiline: true },
): string {
  return tokensToString(typeTokens(type, options));
}

/**
 * Collect the names of the types a type refers to
 */
export function typeRefs(type: SomeType | undefined): string[] {
  return typeTokens(type, {}).flatMap((t) => typeof t === "string" ? [] : t.ref);
}

/**
 * Format a type as tokens
 */
export function typeTokens(
  type: SomeType | undefined,
  options: FormatOptions = {},
): TypeToken[] {
  if (!type) return ["unknown"];
  const indent = options.indent ?? 0;
  const nested = (t: SomeType | undefined, extra = 0) =>
    typeTokens(t, { ...options, indent: indent + extra });

  switch (type.type) {
    case "intrinsic":
      return [type.name];

    case "unknown":
      return [type.name];

    case "reference": {
      const name: TypeToken = type.refersToTypeParameter
        ? type.name
        : { ref: type.name };
      const args = type.typeArguments ?? [];
      if (args.length === 0) return [name];
      return [name, "<", ...joinTokens(args.map((a) => nested(a)), ", "), ">"];
    }

    case "array":
      return [...operand(type.elementType, Precedence.Postfix, nested), "[]"];

    case "union":
      return joinMembers(
        type.types.map((t) => operand(t, Precedence.Union, nested)),
        "|",
        options,
      );

    case "intersection":
      return joinMembers(
        type.types.map((t) => operand(t, Precedence.Intersection, nested)),
        "&",
        options,
      );

    case "literal":
      return [formatLiteral(type.value)];

    case "tuple":
      return [
        "[",
        ...joinTokens((type.elements ?? []).map((t) => nested(t)), ", "),
        "]",
      ];

    case "namedTupleMember":
      return [
        `${type.name}${type.isOptional ? "?" : ""}: `,
        ...nested(type.element),
      ];

    case "optional":
      return [...operand(type.elementType, Precedence.Postfix, nested), "?"];

    case "rest":
      return ["...", ...nested(type.elementType)];

    case "typeOperator":
      return [
        `${type.operator} `,
        ...operand(type.target, Precedence.Prefix, nested),
      ];

    case "indexedAccess":
      return [
        ...operand(type.objectType, Precedence.Postfix, nested),
        "[",
        ...nested(type.indexType),
        "]",
      ];

    case "query":
      return ["typeof ", ...nested(type.queryType)];

    case "predicate":
      return [
        type.asserts ? "asserts " : "",
        type.name,
        ...(type.targetType ? [" is ", ...nested(type.targetType)] : []),
      ];

    case "inferred":
      return [
        `infer ${type.name}`,
        ...(type.constraint ? [" extends ", ...nested(type.constraint)] : []),
      ];

    case "conditional": {
      const head = [
        ...operand(type.checkType, Precedence.Union, nested),
        " extends ",
        ...operand(type.extendsType, Precedence.Function, nested),
      ];
      // Nested conditional types read best one branch per line
      if (options.multiline && type.falseType.type === "conditional") {
        const spaces = "  ".repeat(indent);
        return [
          ...head,
          `\n${spaces}  ? `,
          ...nested(type.trueType),
          `\n${spaces}  : `,
          ...nested(type.falseType, 1),
        ];
      }
      return [
        ...head,
        " ? ",
        ...nested(type.trueType),
        " : ",
        ...nested(type.falseType),
      ];
    }

    case "mapped": {
      const readonly = type.readonlyModifier === "+"
        ? "readonly "
        : type.readonlyModifier === "-"
        ? "-readonly "
        : "";
      const optional = type.optionalModifier === "+"
        ? "?"
        : type.optionalModifier === "-"
        ? "-?"
        : "";
      return [
        `{ ${readonly}[${type.parameter} in `,
        ...nested(type.parameterType),
        ...(type.nameType ? [" as ", ...nested(type.nameType)] : []),
        `]${optional}: `,
        ...nested(type.templateType),
        " }",
      ];
    }

    case "templateLiteral":
      return [
        "`",
        escapeTemplate(type.head),
        ...type.tail.flatMap(([t, text]) => [
          "${",
          ...nested(t),
          "}",
          escapeTemplate(text),
        ]),
        "`",
      ];

    case "reflection":
      return declarationTokens(type.declaration, options);
  }
}

/**
 * Format a declaration's members as an object type
 *
 * TypeDoc converts a type alias of an object literal into a declaration
 * holding the members itself, without a `type`.
 */
export function formatObjectType(declaration: DeclarationReflection): string {
  return tokensToString(declarationTokens(declaration, { multiline: true }));
}

/**
 * Format an inline object or function type
 */
function declarationTokens(
  declaration: DeclarationReflection,
  options: FormatOptions,
): TypeToken[] {
  const indent = options.indent ?? 0;
  const signatures = declaration.signatures ?? [];
  const members = declaration.children ?? [];
  const indexSignatures = declaration.indexSignatures ?? [];

  // A single call signature and nothing else is a function type
  if (
    signatures.length === 1 && members.length === 0 &&
    indexSignatures.length === 0
  ) {
    return signatureTypeTokens(signatures[0], options);
  }

  const entries: TypeToken[][] = [
    ...signatures.map((sig) => callSignatureTokens(sig, options)),
    ...indexSignatures.map((sig) => [
      sig.flags.isReadonly ? "readonly " : "",
      "[",
      ...joinTokens(
        (sig.parameters ?? []).map((p) => parameterTokens(p, options)),
        ", ",
      ),
      "]: ",
      ...typeTokens(sig.type, { ...options, indent: indent + 1 }),
    ]),
    ...members.map((member) => memberTokens(member, options)),
  ];
  if (entries.length === 0) return ["{}"];

  const inline = ["{ ", ...joinTokens(entries, "; "), " }"];
  if (
    options.multiline &&
    (tokensToString(inline).length > LINE_LENGTH_THRESHOLD ||
      entries.length > 3)
  ) {
    const spaces = "  ".repeat(indent);
    return [
      "{",
      ...entries.flatMap((entry) => [`\n${spaces}  `, ...entry, ";"]),
      `\n${spaces}}`,
    ];
  }
  return inline;
}

/**
 * Format a member of an object type (`name?: Type` or a method signature)
 */
function memberTokens(
  member: DeclarationReflection,
  options: FormatOptions,
): TypeToken[] {
  const indent = options.indent ?? 0;
  const inner = { ...options, indent: indent + 1 };
  const optional = member.flags.isOptional ? "?" : "";
  if (member.kind === ReflectionKind.Method) {
    return joinTokens(
      (member.signatures ?? []).map((sig) => [
        `${member.name}${optional}`,
        ...callSignatureTokens(sig, inner),
      ]),
      "; ",
    );
  }
  const type = member.kind === ReflectionKind.Accessor
    ? member.getSignature?.type
    : member.type;
  const readonly = member.flags.isReadonly ? "readonly " : "";
  return [
    `${readonly}${member.name}${optional}: `,
    ...typeTokens(type, inner),
  ];
}

/**
 * Format a signature as a function type: `(a: A) => R`
 */
function signatureTypeTokens(
  signature: SignatureReflection,
  options: FormatOptions,
): TypeToken[] {
  const prefix = signature.kind === ReflectionKind.ConstructorSignature
    ? "new "
    : "";
  return [
    prefix,
    ...typeParamsTokens(signature.typeParameters, options),
    "(",
    ...joinTokens(
      (signature.parameters ?? []).map((p) => parameterTokens(p, options)),
      ", ",
    ),
    ") => ",
    ...typeTokens(signature.type, options),
  ];
}

/**
 * Format a signature inside an object type: `(a: A): R`
 */
function callSignatureTokens(
  signature: SignatureReflection,
  options: FormatOptions,
): TypeToken[] {
  const prefix = signature.kind === ReflectionKind.ConstructorSignature
    ? "new "
    : "";
  return [
    prefix,
    ...typeParamsTokens(signature.typeParameters, options),
    "(",
    ...joinTokens(
      (signature.parameters ?? []).map((p) => parameterTokens(p, options)),
      ", ",
    ),
    "): ",
    ...typeTokens(signature.type, options),
  ];
}

/**
 * Format a parameter: `name?: Type` or `...name: Type`
 */
export function parameterTokens(
  param: ParameterReflection,
  options: FormatOptions = {},
): TypeToken[] {
  const rest = param.flags.isRest ? "..." : "";
  const optional = param.flags.isOptional ? "?" : "";
  return [`${rest}${param.name}${optional}: `, ...typeTokens(param.type, options)];
}

/**
 * Format type parameters (generics): `<T extends X = Y>`
 */
export function typeParamsTokens(
  typeParams: TypeParameterReflection[] | undefined,
  options: FormatOptions = {},
): TypeToken[] {
  if (!typeParams || typeParams.length === 0) return [];
  return [
    "<",
    ...joinTokens(
      typeParams.map((p) => [
        p.flags.isConst ? "const " : "",
        p.varianceModifier ? `${p.varianceModifier} ` : "",
        p.name,
        ...(p.type ? [" extends ", ...typeTokens(p.type, options)] : []),
        ...(p.default ? [" = ", ...typeTokens(p.default, options)] : []),
      ]),
      ", ",
    ),
    ">",
  ];
}

/**
 * Format type parameters as a string
 */
export function formatTypeParams(
  typeParams: TypeParameterReflection[] | undefined,
): string {
  return tokensToString(typeParamsTokens(typeParams));
}

/**
 * Format a parameter list as a string
 */
export function formatParams(params: ParameterReflection[] | undefined): string {
  return (params ?? [])
    .map((p) => tokensToString(parameterTokens(p, { multiline: true })))
    .join(", ");
}

function formatLiteral(
  value: string | number | boolean | null | { value: string; negative: boolean },
): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "object") {
    return `${value.negative ? "-" : ""}${value.value}n`;
  }
  return String(value);
}

function escapeTemplate(text: string): string {
  return text.replace(/[`\\]/g, "\\$&").replace(/\$\{/g, "\\${");
}

/**
 * How tightly a type binds, loosest first
 *
 * A type in a position demanding a higher precedence than its own is
 * parenthesized: `(A | B)[]`, `(A | B) & C`, `(() => A) | B`.
 */
const Precedence = {
  Conditional: 0,
  Function: 1,
  Union: 2,
  Intersection: 3,
  Prefix: 4,
  Postfix: 5,
  Primary: 6,
} as const;

function precedenceOf(type: SomeType): number {
  switch (type.type) {
    case "conditional":
      return Precedence.Conditional;
    case "union":
      return Precedence.Union;
    case "intersection":
      return Precedence.Intersection;
    case "typeOperator":
    case "query":
    case "inferred":
      return Precedence.Prefix;
    case "reflection": {
      const { signatures = [], children = [], indexSignatures = [] } =
        type.declaration;
      const isFunctionType = signatures.length === 1 && children.length === 0 &&
        indexSignatures.length === 0;
      return isFunctionType ? Precedence.Function : Precedence.Primary;
    }
    default:
      return Precedence.Primary;
  }
}

/**
 * Format a type used as an operand, parenthesized when it binds looser than
 * the position requires
 */
function operand(
  type: SomeType,
  required: number,
  format: (type: SomeType) => TypeToken[],
): TypeToken[] {
  const tokens = format(type);
  return precedenceOf(type) < required ? ["(", ...tokens, ")"] : tokens;
}

function joinTokens(parts: TypeToken[][], separator: string): TypeToken[] {
  return parts.flatMap((part, i) => i === 0 ? part : [separator, ...part]);
}

/**
 * Join union or intersection members, one per line when they do not fit
 */
function joinMembers(
  members: TypeToken[][],
  operator: "|" | "&",
  options: FormatOptions,
): TypeToken[] {
  const inline = joinTokens(members, ` ${operator} `);
  if (
    options.multiline && members.length > 1 &&
    tokensToString(inline).length > LINE_LENGTH_THRESHOLD
  ) {
    const spaces = "  ".repeat(options.indent ?? 0);
    return joinTokens(members, `\n${spaces}${operator} `);
  }
  return inline;
}
