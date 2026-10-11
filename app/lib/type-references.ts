/**
 * Type reference extraction utilities for API documentation
 *
 * These utilities collect the names of the types a reflection's declaration
 * mentions, for building cross-reference links.
 */
import type {
  DeclarationReflection,
  SignatureReflection,
  SomeType,
  TypeParameterReflection,
} from "./api-docs.ts";
import { isPublic } from "./api-docs.ts";
import { typeRefs } from "./type-format.ts";

/**
 * Collect type references from types, signatures, and members
 */
export class TypeRefCollector {
  readonly refs = new Set<string>();

  type(type: SomeType | undefined): this {
    for (const ref of typeRefs(type)) this.refs.add(ref);
    return this;
  }

  typeParams(typeParams: TypeParameterReflection[] | undefined): this {
    for (const p of typeParams ?? []) {
      this.type(p.type);
      this.type(p.default);
    }
    return this;
  }

  signature(signature: SignatureReflection | undefined): this {
    if (!signature) return this;
    this.typeParams(signature.typeParameters);
    for (const p of signature.parameters ?? []) this.type(p.type);
    return this.type(signature.type);
  }

  /**
   * Collect from a declaration: its type parameters, heritage, type,
   * signatures, and public members
   */
  declaration(reflection: DeclarationReflection): this {
    this.typeParams(reflection.typeParameters);
    for (const t of reflection.extendedTypes ?? []) this.type(t);
    for (const t of reflection.implementedTypes ?? []) this.type(t);
    this.type(reflection.type);
    for (const sig of reflection.signatures ?? []) this.signature(sig);
    for (const sig of reflection.indexSignatures ?? []) this.signature(sig);
    this.signature(reflection.getSignature);
    this.signature(reflection.setSignature);
    for (const member of reflection.children ?? []) {
      if (isPublic(member) && !member.inheritedFrom) this.declaration(member);
    }
    return this;
  }
}

/**
 * Extract all type names referenced by a declaration
 */
export function extractDeclarationRefs(
  reflection: DeclarationReflection,
): Set<string> {
  return new TypeRefCollector().declaration(reflection).refs;
}
