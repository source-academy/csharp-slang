import { TypeSpecifier } from '../TypeSpecifier'
import { type ClassMetadata } from './ClassMetadata'
import { PrimitiveClassNames, SYSTEM_NAMESPACE_PATH } from '../../Constants'
import {
  type FieldDefinitionContext,
  FieldTypeContext,
  FieldNameContext,
  TypeSpecifierContext
} from '../parser'
import { assertNonNullOrUndefined, assertTrue } from '../../../util/Assertion'
import {
  getChildNodeByTypeAssertExistsChild,
  getDataFromTerminalNodeChild
} from '../util/ParseTreeUtil'

const FieldSizeInBytes = {
  [PrimitiveClassNames.Boolean]: 1,
  [PrimitiveClassNames.Byte]: 1,
  [PrimitiveClassNames.SByte]: 1,
  [PrimitiveClassNames.Int16]: 2,
  [PrimitiveClassNames.UInt16]: 2,
  [PrimitiveClassNames.Int32]: 4,
  [PrimitiveClassNames.UInt32]: 4,
  [PrimitiveClassNames.Int64]: 8,
  [PrimitiveClassNames.UInt64]: 8,
  [PrimitiveClassNames.Single]: 4,
  [PrimitiveClassNames.Double]: 8,
  [PrimitiveClassNames.Decimal]: 24,
  [PrimitiveClassNames.Char]: 2,
  Reference: 4
}

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
   * Is the value in the field a reference to an object?
   */
  isReferenceField: boolean

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
    this.fieldSize = -1
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
   * Calculate field size and set the value of property `isReferenceField` for this `FieldMetadata` based on `fieldType`.
   *
   * This should only be called during class metadata post processing by `ClassMetadata`.
   */
  calculateFieldSizeAndSetIsReferenceField (): void {
    assertTrue(this.fieldSize === -1)
    assertNonNullOrUndefined(this.fieldType)
    this.isReferenceField = false
    const typeFullPathAndName = assertNonNullOrUndefined(this.fieldType.matchedClass).fullPathToString_Class()
    if (typeFullPathAndName.indexOf(SYSTEM_NAMESPACE_PATH) !== -1) {
      const primitiveClassName = typeFullPathAndName.split('.')[1]
      switch (primitiveClassName) {
        case 'Boolean':
          this.fieldSize = FieldSizeInBytes.Boolean
          break
        case 'Byte':
          this.fieldSize = FieldSizeInBytes.Byte
          break
        case 'SByte':
          this.fieldSize = FieldSizeInBytes.SByte
          break
        case 'Int16':
          this.fieldSize = FieldSizeInBytes.Int16
          break
        case 'UInt16':
          this.fieldSize = FieldSizeInBytes.UInt16
          break
        case 'Int32':
          this.fieldSize = FieldSizeInBytes.Int32
          break
        case 'UInt32':
          this.fieldSize = FieldSizeInBytes.UInt32
          break
        case 'Int64':
          this.fieldSize = FieldSizeInBytes.Int64
          break
        case 'UInt64':
          this.fieldSize = FieldSizeInBytes.UInt64
          break
        case 'Single':
          this.fieldSize = FieldSizeInBytes.Single
          break
        case 'Double':
          this.fieldSize = FieldSizeInBytes.Double
          break
        case 'Decimal':
          this.fieldSize = FieldSizeInBytes.Decimal
          break
        case 'Char':
          this.fieldSize = FieldSizeInBytes.Char
          break
        default:
          this.fieldSize = FieldSizeInBytes.Reference
          this.isReferenceField = true
          break
      }
    } else {
      this.fieldSize = FieldSizeInBytes.Reference
      this.isReferenceField = true
    }
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
    result.isReferenceField = this.isReferenceField
    return result
  }
}

export { FieldMetadata }
