import { ClassMetadata } from './ClassMetadata'
import { Scope } from '../Scope'
import { assertTrue } from '../../../util/Assertion'
import { ROOT_NAMESPACE_NAME } from '../../Constants'
import { getCurrentProgram } from '../../Main'

/**
 * A class that represents a C# namespace.
 */
class NamespaceMetadata extends Scope {
  /**
   * The name of the namespace.
   */
  readonly name: string

  /**
   * The constructor for the `NamespaceMetadata` class.
   *
   * @param name The name of the namespace.
   * @param codePieceIndex The index of the code piece that has the code of this namespace.
   */
  constructor (name: string, codePieceIndex: number) {
    super(codePieceIndex)
    this.name = name
  }

  /**
   * Get a direct child namespace by its name from this namespace.
   *
   * @param childNamespaceName The name of the child namespace.
   * @returns The `NamespaceMetadata` for the child namespace, or `null` if the child namespace with the specified name does not directly exist in this namespace.
   */
  getChildNamespace (childNamespaceName: string): NamespaceMetadata | null {
    const childCount = this.childScopes.length
    for (let i = 0; i < childCount; i++) {
      const child = this.childScopes[i]
      if (child instanceof NamespaceMetadata) {
        if ((child).name === childNamespaceName) {
          return child
        }
      }
    }
    return null
  }

  /**
   * Get a class that is directly in this namespace by class name.
   *
   * @param className The name of the class.
   * @returns The `ClassMetadata` for the class, or `null` if the class with the specified name does not directly exist in this namespace.
   */
  getClassMetadata (className: string): ClassMetadata | null {
    const childCount = this.childScopes.length
    for (let i = 0; i < childCount; i++) {
      const child = this.childScopes[i]
      if (child instanceof ClassMetadata) {
        if ((child).name === className) {
          return child
        }
      }
    }
    return null
  }

  /**
   * Get a direct child namespace by its name in this namespace. If the child namespace with the specified name does not directly exist in this namespace, then create a new namespace with the specified name directly in this namespace.
   *
   * @param childNamespaceName The name of the child namespace.
   * @returns The `NamespaceMetadata` for the child namespace that is found or created in this namespace.
   */
  getOrCreateChildNamespace (childNamespaceName: string): NamespaceMetadata {
    let childNamespace = this.getChildNamespace(childNamespaceName)
    if (childNamespace === null) {
      childNamespace = new NamespaceMetadata(childNamespaceName, getCurrentProgram().getCurrentCodePieceIndexAssertExistsCodePiece())
      this.addChildScope(childNamespace)
    }
    return childNamespace
  }

  /**
   * Get the full path of this namespace as a string.
   *
   * For example: `Namespace1.Namespace2.Namespace3.Class1`
   *
   * @returns The full path of this namespace as a string.
   */
  fullPathToString_Namespace (): string {
    const recursiveHelper = (namespace: NamespaceMetadata, str: string): string => {
      if (namespace.parent === null) {
        assertTrue(namespace.name === ROOT_NAMESPACE_NAME)
        return str
      }
      return recursiveHelper(namespace.parent as NamespaceMetadata, namespace.name + (namespace !== this ? '.' : '') + str)
    }
    return recursiveHelper(this, '')
  }
}

export { NamespaceMetadata }
