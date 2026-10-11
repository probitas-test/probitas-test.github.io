/**
 * Signature formatting utilities for API documentation
 *
 * These formatters convert TypeDoc reflections to string representations for
 * syntax highlighting and Markdown output.
 */
import type {
  DeclarationReflection,
  ParameterReflection,
  SignatureReflection,
} from "./api-docs.ts";
import {
  formatObjectType,
  formatParams,
  formatType,
  formatTypeParams,
  parameterTokens,
  tokensToString,
} from "./type-format.ts";

/** Line length threshold for breaking into multiple lines */
const LINE_LENGTH_THRESHOLD = 80;

/**
 * Format parameters inline, and one per line for long signatures
 */
function formatParamsMultiline(
  params: ParameterReflection[] | undefined,
): { inline: string; multiline: string } {
  const inline = formatParams(params);
  if (!params || params.length === 0) {
    return { inline, multiline: inline };
  }

  const multiline = params
    .map((p) =>
      `\n  ${tokensToString(parameterTokens(p, { multiline: true }))},`
    )
    .join("") + "\n";

  return { inline, multiline };
}

/**
 * Put `head(params)tail` on one line if it fits, else one parameter per line
 */
function withParams(
  head: string,
  params: ParameterReflection[] | undefined,
  tail: string,
): string {
  const { inline, multiline } = formatParamsMultiline(params);
  const singleLine = `${head}(${inline})${tail}`;
  if (singleLine.length <= LINE_LENGTH_THRESHOLD) {
    return singleLine;
  }
  return `${head}(${multiline})${tail}`;
}

/**
 * Format a function signature as a string for syntax highlighting
 */
export function formatFunctionSignature(
  name: string,
  signature: SignatureReflection,
): string {
  const typeParams = formatTypeParams(signature.typeParameters);
  return withParams(
    `function ${name}${typeParams}`,
    signature.parameters,
    `: ${formatType(signature.type)}`,
  );
}

/**
 * Format a method signature as a string for syntax highlighting
 */
export function formatMethodSignature(
  method: DeclarationReflection,
  signature: SignatureReflection,
): string {
  const staticPrefix = method.flags.isStatic ? "static " : "";
  const abstractPrefix = method.flags.isAbstract ? "abstract " : "";
  const optional = method.flags.isOptional ? "?" : "";
  const typeParams = formatTypeParams(signature.typeParameters);
  return withParams(
    `${staticPrefix}${abstractPrefix}${method.name}${optional}${typeParams}`,
    signature.parameters,
    `: ${formatType(signature.type)}`,
  );
}

/**
 * Format a class signature as a string for syntax highlighting
 */
export function formatClassSignature(reflection: DeclarationReflection): string {
  const abstractPrefix = reflection.flags.isAbstract ? "abstract " : "";
  const typeParams = formatTypeParams(reflection.typeParameters);
  const extendsClause = reflection.extendedTypes?.length
    ? ` extends ${reflection.extendedTypes.map((t) => formatType(t)).join(", ")}`
    : "";

  const implementsTypes = (reflection.implementedTypes ?? []).map((t) =>
    formatType(t)
  );
  const implementsInline = implementsTypes.length > 0
    ? ` implements ${implementsTypes.join(", ")}`
    : "";

  const head = `${abstractPrefix}class ${reflection.name}${typeParams}`;
  const singleLine = `${head}${extendsClause}${implementsInline}`;

  if (
    singleLine.length <= LINE_LENGTH_THRESHOLD || implementsTypes.length <= 1
  ) {
    return singleLine;
  }

  // Break implements into multiple lines
  const implementsMultiline = implementsTypes
    .map((t, i) => i === 0 ? ` implements ${t}` : `  ${t}`)
    .join(",\n");

  return `${head}${extendsClause}\n${implementsMultiline}`;
}

/**
 * Format an interface signature as a string for syntax highlighting
 */
export function formatInterfaceSignature(
  reflection: DeclarationReflection,
): string {
  const typeParams = formatTypeParams(reflection.typeParameters);
  const extendsTypes = (reflection.extendedTypes ?? []).map((t) =>
    formatType(t)
  );
  const extendsInline = extendsTypes.length > 0
    ? ` extends ${extendsTypes.join(", ")}`
    : "";

  const head = `interface ${reflection.name}${typeParams}`;
  const singleLine = `${head}${extendsInline}`;

  if (singleLine.length <= LINE_LENGTH_THRESHOLD || extendsTypes.length <= 1) {
    return singleLine;
  }

  // Break extends into multiple lines
  const extendsMultiline = extendsTypes
    .map((t, i) => i === 0 ? ` extends ${t}` : `  ${t}`)
    .join(",\n");

  return `${head}\n${extendsMultiline}`;
}

/**
 * Format a type alias signature as a string for syntax highlighting
 */
export function formatTypeAliasSignature(
  reflection: DeclarationReflection,
): string {
  const typeParams = formatTypeParams(reflection.typeParameters);
  const type = reflection.type
    ? formatType(reflection.type)
    : formatObjectType(reflection);
  const head = `type ${reflection.name}${typeParams} = `;

  // If the type spans several lines (e.g., a conditional or long union),
  // indent its continuation lines under the declaration
  if (type.includes("\n")) {
    const indented = type.split("\n").map((line, i) =>
      i === 0 ? line : `  ${line}`
    ).join("\n");
    return `${head}${indented}`;
  }

  return `${head}${type}`;
}

/**
 * Format a constructor signature as a string for syntax highlighting
 */
export function formatConstructorSignature(
  className: string,
  signature: SignatureReflection,
): string {
  return withParams(`new ${className}`, signature.parameters, "");
}

/**
 * Format a variable declaration as a string for syntax highlighting
 */
export function formatVariableSignature(
  reflection: DeclarationReflection,
): string {
  const kind = reflection.flags.isConst ? "const" : "let";
  return `${kind} ${reflection.name}: ${formatType(reflection.type)}`;
}
