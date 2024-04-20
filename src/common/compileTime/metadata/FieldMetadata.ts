import { TypeSpecifier } from '../TypeSpecifier'
import { type ClassMetadata } from './ClassMetadata'
import {
  type FieldDefinitionContext,
  FieldTypeContext,
  FieldNameContext,
  TypeSpecifierContext
} from '../parser'
import { assertNonNullOrUndefined } from '../../../util/Assertion'
import {
  getChildNodeByTypeAssertExistsChild,
  getDataFromTerminalNodeChild
} from '../util/ParseTreeUtil'

const ADDRESS_LENGTH_IN_BYTES = 4

/**
 * A class representing a C# field.
 */
class FieldMetadata {
  // todo: access modifiers, static field support
  /**
   * The type of the field.
   */
  fieldType: TypeSpecifier
  /**
   * The name of the field.
   */
  fieldName: string
  /**
   * The size of the field (in bytes).
   */
  fieldSize: number
  /**
   * The offset of the field in the runtime object, excluding the object header (The first field in the object will have a `fieldOffset` equals to zero).
   */
  fieldOffset: number

  /**
   * The constructor for `FielMetadata` class.
   *
   * You need to use method `fromParseTree` to fill in the data from a parse tree node.
   *
   * @param classScope The `ClassMetadata` that owns this `FieldMetadata`. Note that `classScope` can NOT be `null` anywhere except in `FieldMetadata.getCopy()` method.
   */
  constructor (classScope: ClassMetadata | null) {
    if (classScope !== null) {
      this.fieldType = new TypeSpecifier(classScope)
    }
    this.fieldSize = ADDRESS_LENGTH_IN_BYTES
    this.fieldOffset = -1
  }

  /**
   * Fill in the data from a parse tree node that has a type of `FieldDefinitionContext`.
   *
   * @param parseTreeNode The node of a field definition in the parse tree.
   */
  fromParseTree (parseTreeNode: FieldDefinitionContext): void {
    assertNonNullOrUndefined(this.fieldType)
    const fieldNameNode = getChildNodeByTypeAssertExistsChild(parseTreeNode, FieldNameContext)
    this.fieldName = getDataFromTerminalNodeChild(fieldNameNode)
    const fieldTypeNode = getChildNodeByTypeAssertExistsChild(parseTreeNode, FieldTypeContext)
    this.fieldType.fromParseTree(getChildNodeByTypeAssertExistsChild(fieldTypeNode, TypeSpecifierContext) as TypeSpecifierContext)
  }


  /**
   * Get a copy of this `FieldMetadata`
   *
   * Note: The `fieldType` `TypeSpecifier` in the copied `FieldMetadata` is directly referring the same object from this `FieldMetadata`.
   *
   * @returns The copied `FieldMetadata`
   */
  getCopy (): FieldMetadata {
    const result = new FieldMetadata(null)
    result.fieldType = this.fieldType
    result.fieldName = this.fieldName
    result.fieldSize = this.fieldSize
    result.fieldOffset = this.fieldOffset
    return result
  }
}

export { FieldMetadata }
