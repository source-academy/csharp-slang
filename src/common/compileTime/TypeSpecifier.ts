import { type ClassMetadata } from './metadata/ClassMetadata'
import { type Scope, InternalBindingType } from './Scope'
import { getCurrentProgram } from '../Main'
import { CSRuleError } from '../CSInterpreterError'
// import { log, logWarn } from '../../util/Logger'
import { assertNonNullOrUndefined, assertTrue } from '../../util/Assertion'
import { type TypeSpecifierContext, type TypeIdentifierContext } from './parser'

import { TypePath } from './TypePath'

/**
 * A class that represents a compile-time type specifier with a type path, the closest scope and the matched class's `ClassMetadata` (available after matching `TypeSpecifier` to `ClassMetadata` during compiling).
 *
 * For now, I only consider the simplest TypeSpecifier with only type path and name (No generic, array type, etc)
 */
class TypeSpecifier {
  /**
   * The `TypePath` object that has the path and name of the type (class).
   */
  readonly typePath: TypePath
  /**
   * The matched class metadata for this `TypeSpecifier`. It is only available after matching `TypeSpecifier` to `ClassMetadata` during compiling.
   */
  matchedClass: ClassMetadata | null
  /**
   * The closest scope for the type specifier. It is used when finding the correct `ClassMetadata` when matching `TypeSpecifier` to `ClassMetadata` during compiling.
   */
  readonly closestScope: Scope

  /**
   * The constructor for the `TypeSpecifier` class.
   *
   * Note: You should NOT create any new `TypeSpecifier` after matching `TypeSpecifier` to `ClassMetadata` during compiling.
   *
   * @param closestScope The closest scope for the type specifier.
   * @param typePathAndName For creating `TypePath` object. It can be either a full type path or an empty string. Please refer to {@link TypePath} for more information.
   */
  constructor (closestScope: Scope, typePathAndName: string = '') {
    this.typePath = new TypePath(typePathAndName)
    this.matchedClass = null
    this.closestScope = closestScope
    getCurrentProgram().addTypeSpecifier(this)
  }

  /**
   * This method directly calls `this.typePath.fromParseTree(parseTreeNode)`. Please refer to {@link TypePath} for more information.
   *
   * @param parseTreeNode Please refer to {@link TypePath} for more information.
   */
  fromParseTree (parseTreeNode: TypeSpecifierContext): void {
    this.typePath.fromParseTree(parseTreeNode)
  }

  /**
   * This method directly calls `this.typePath.fromParseTree_TypeIdentifierNode(typeIdentifierNode)`. Please refer to {@link TypePath} for more information.
   *
   * @param typeIdentifierNode Please refer to {@link TypePath} for more information.
   */
  fromParseTree_TypeIdentifierNode (typeIdentifierNode: TypeIdentifierContext): void {
    this.typePath.fromParseTree_TypeIdentifierNode(typeIdentifierNode)
  }

  /**
   * Match this `TypeSpecifier` with a `ClassMetadata`.
   *
   * This should only be called during compiling by `CSharpProgram`.
   */
  matchClass (): void {
    assertTrue(this.matchedClass === null)
    const codePieceIndex = this.closestScope.codePieceIndex
    if (this.typePath.namespacePath.length > 0) { // If the array namespacePath has a length that is larger than zero, then this type specifier is using a full class path.
      this.matchedClass = getCurrentProgram().getClassMetadataByFullPath(this.typePath, codePieceIndex)
      return
    }
    const typeName = this.typePath.typeName
    // CS0118: Test whether this type path (with namespacePath.length === 0) actually refers to a primary (outermost) namespace (For example: "System")
    // If yes, throws CS0118 error
    if (getCurrentProgram().checkWhetherNameIsOutermostNamespaceName(typeName)) {
      throw new CSRuleError('0118', [typeName], codePieceIndex)
    }
    try {
      this.matchedClass = this.closestScope.lookupValueByNameAndType(typeName, InternalBindingType.Class)
    } catch (e) {
      assertTrue(e.reason === 'NotFound')
      this.matchedClass = getCurrentProgram().getClassWithUsingsInCodePiece(typeName, codePieceIndex)
    }
    // assertNotReachHere();
  }

  /**
   * Check whether two `TypeSpecifier` are equal or not based on whether they are both matched to the same `ClassMetadata` or not.
   *
   * You can only use this method after matching `TypeSpecifier` to `ClassMetadata` during compiling.
   *
   * @returns `true` if the two `TypeSpecifier` are both matched to the same `ClassMetadata` or `false` otherwise.
   */
  equalTo (other: TypeSpecifier): boolean {
    assertNonNullOrUndefined(this.matchedClass)
    assertNonNullOrUndefined(other.matchedClass)
    return this.matchedClass === other.matchedClass
  }

  /**
   * Return the matched class's full path and name.
   *
   * You can only use this method after matching `TypeSpecifier` to `ClassMetadata` during compiling.
   *
   * @returns The matched class's full path and name.
   */
  toString (): string {
    return (assertNonNullOrUndefined(this.matchedClass) as ClassMetadata).fullPathToString_Class()
  }
}

export { TypeSpecifier }
