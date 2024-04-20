import {
  getChildNodeByTypeAssertExistsChild,
  getChildNodeByType,
  getDataFromTerminalNodeChild,
  iterateParseTreeNodeChildren
} from './util/ParseTreeUtil'
import {
  type TypeSpecifierContext,
  TypeIdentifierContext,
  TypeIdentifierLiteralContext,
  PrimitiveTypeContext,
  NamespacePathContext,
  type TerminalNode,
  TypeNameContext
} from './parser'
import { assertTrue, assertNotReachHere } from '../../util/Assertion'
import { SYSTEM_NAMESPACE_PATH, PrimitiveClassNames } from '../Constants'

/**
 * A class representing a path for a C# type (class).
 *
 * For example: `System.Object`
 *
 */
class TypePath {
  /**
   * The namespace path represented in an array of string.
   *
   * For example, for a `TypePath` from the string path `Namespace1.Namespace2.Namespace3.Class1`, its `namespacePath` property should be `["Namespace1", "Namespace2", "Namespace3"]`.
   *
   * Note: For a non-empty `TypePath` that the data is filled in by method `fromParseTree`, this array may be empty (length === 0) if the parse tree `TypeIdentifierContext` node only contains type name but no full namespace path.
   */
  readonly namespacePath: string[]
  /**
   * The name of the type (class).
   */
  typeName: string

  /**
   * The constructor for the `TypePath` class.
   *
   * @param typePathAndName The full path and name for a C# type (class). It must begins with a namespace's name and ends with a class's name. Or you can use an empty string to create an empty `TypePath`, then use methods `fromParseTree` or `fromParseTree_TypeIdentifierNode` to fill in the data from a parse tree node later.
   */
  constructor (typePathAndName: string) {
    this.namespacePath = []
    if (typePathAndName === '') {
      this.typeName = ''
      return
    }
    const splited = typePathAndName.split('.')
    const len = splited.length
    assertTrue(len >= 2) // There should be at least 2 elements in the splited string array: the first element is the namespace name, the second element is the type name.
    for (let i = 0; i < len - 1; i++) {
      this.namespacePath[this.namespacePath.length] = splited[i]
    }
    this.typeName = splited[len - 1]
  }

  /**
   * Fill in the data from a parse tree node that has a type of `TypeSpecifierContext`.
   *
   * You can only use this method when this `TypePath` is created with an empty string as `typePathAndName` argument in the constructor.
   *
   * You can NOT call this method for more than one time on the same `TypePath` object.
   *
   * @param parseTreeNode The node of a type specifier in the parse tree.
   */
  fromParseTree (parseTreeNode: TypeSpecifierContext): void {
    const typeIdentifierNode = getChildNodeByTypeAssertExistsChild(parseTreeNode, TypeIdentifierContext) as TypeIdentifierContext
    this.fromParseTree_TypeIdentifierNode(typeIdentifierNode)
  }

  /**
   * Fill in the data from a parse tree node that has a type of `TypeIdentifierContext`.
   *
   * You can only use this method when this `TypePath` is created with an empty string as `typePathAndName` argument in the constructor.
   *
   * You can NOT call this method for more than one time on the same `TypePath` object.
   *
   * @param parseTreeNode The node of a type identifier in the parse tree.
   */
  fromParseTree_TypeIdentifierNode (typeIdentifierNode: TypeIdentifierContext): void {
    assertTrue(this.namespacePath.length === 0)
    assertTrue(this.typeName === '')
    const typeIdentifierLiteralNode = getChildNodeByTypeAssertExistsChild(typeIdentifierNode, TypeIdentifierLiteralContext)
    const primitiveTypeNode = getChildNodeByType(typeIdentifierLiteralNode, PrimitiveTypeContext)
    if (primitiveTypeNode !== null) {
      this.namespacePath[0] = SYSTEM_NAMESPACE_PATH
      this.typeName = primitiveTypeToInternalTypeName(getDataFromTerminalNodeChild(primitiveTypeNode))
      return
    }
    const namespacePathNode = getChildNodeByType(typeIdentifierLiteralNode, NamespacePathContext)
    const typeNameNode = getChildNodeByTypeAssertExistsChild(typeIdentifierLiteralNode, TypeNameContext)
    this.typeName = getDataFromTerminalNodeChild(typeNameNode)
    if (namespacePathNode !== null) { // In the parse tree, for a type without an explicit namespace path, the node NamespacePathContext will not present under that TypeIdentifierLiteralContext
      const callback = (node: TerminalNode): boolean => {
        /* eslint-disable @typescript-eslint/no-base-to-string */
        const str = node.toString()
        if (str === '.') {
          return true
        }
        this.namespacePath[this.namespacePath.length] = str
        return true
      }
      iterateParseTreeNodeChildren(namespacePathNode, callback)
    }
  }

  /**
   * Get the namespace path, represented as a string.
   *
   * @returns The namespace path string.
   */
  getNamespacePathString (): string {
    const len = this.namespacePath.length
    let result = ''
    this.namespacePath.forEach((str, index) => { result += str + (index === len - 1 ? '' : '.') })
    return result
  }

  fullPathToString (): string {
    return this.getNamespacePathString() + "." + this.typeName
  }
}

// https://learn.microsoft.com/en-us/dotnet/api/system.type.isprimitive?view=net-7.0
function primitiveTypeToInternalTypeName (primitiveType: string): PrimitiveClassNames {
  switch (primitiveType) {
    case 'bool':
      return PrimitiveClassNames.Boolean
    case 'byte':
      return PrimitiveClassNames.Byte
    case 'sbyte':
      return PrimitiveClassNames.SByte
    case 'short':
      return PrimitiveClassNames.Int16
    case 'ushort':
      return PrimitiveClassNames.UInt16
    case 'int':
      return PrimitiveClassNames.Int32
    case 'uint':
      return PrimitiveClassNames.UInt32
    case 'long':
      return PrimitiveClassNames.Int64
    case 'ulong':
      return PrimitiveClassNames.UInt64
    case 'char':
      return PrimitiveClassNames.Char
    case 'double':
      return PrimitiveClassNames.Double
    case 'float':
      return PrimitiveClassNames.Single
    case 'decimal':
      return PrimitiveClassNames.Decimal
    case 'string':
      return PrimitiveClassNames.String
    case 'object':
      return PrimitiveClassNames.Object
  }
  assertNotReachHere()
  return '' as any; // Just for passing tsc
}

export { TypePath, primitiveTypeToInternalTypeName }
