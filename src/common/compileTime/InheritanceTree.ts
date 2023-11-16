import { type ClassMetadata } from './metadata/ClassMetadata'
import { assertNonNullOrUndefined, assertTrue, assertNotReachHere } from '../../util/Assertion'
import { CSRuleError } from '../CSInterpreterError'
import { OBJECT_CLASS_PATH_AND_NAME } from '../Constants'

/**
 * A class that represents the inheritance relationship between C# base classes and subclasses in a tree structure.
 */
class InheritanceTree {
  private rootNode: InheritanceTreeNode
  private allNodes: InheritanceTreeNode[]

  constructor () {
    this.allNodes = []
  }

  /**
   * Build the inheritance tree from an array of `ClassMetadata`. It can also check for circular inheritance errors.
   *
   * @param classArray An array of `ClassMetadata` that is used for generating the inheritance tree. It should contains **all** classes that are having inheritance relationship between each other, including the `System.Object` class.
   */
  buildTree (classArray: ClassMetadata[]): void {
    assertTrue(this.allNodes.length === 0)
    assertTrue(this.rootNode === undefined)
    const classCount = classArray.length

    // Create a node for each class in the array
    for (let i = 0; i < classCount; i++) {
      const classMetadata = classArray[i]
      this.allNodes[this.allNodes.length] = new InheritanceTreeNode(classMetadata)
    }

    // Build the tree with the nodes
    for (let i = 0; i < classCount; i++) {
      const node = this.allNodes[i]
      const baseClassMetadata = assertNonNullOrUndefined(node.classMetadata.baseClassSpecifier.matchedClass)
      // Here, I don't need to consider the error situation where there are multiple "System.Object" classes in classArray, since the check on duplicated classes is already done before generating inheritance tree.
      if (this.rootNode === undefined) {
        if (node.classMetadata.fullPathToString_Class() === OBJECT_CLASS_PATH_AND_NAME) {
          assertTrue(node.classMetadata === baseClassMetadata) // In this C# interpreter, the real "System.Object" class has a base class which is itself.
          this.rootNode = node
          continue
        }
      }
      const baseClassNode = this.findNodeByClassMetadata(baseClassMetadata)
      node.parent = baseClassNode
    }
    assertTrue(this.rootNode !== undefined)

    // Check for circular inheritance
    const canLoopBackToNode = (initialNode: InheritanceTreeNode): boolean => {
      const resursiveHelper = (currentNode: InheritanceTreeNode): boolean => {
        if (currentNode === initialNode) {
          return true // Circular inheritance detacted
        }
        if (currentNode.isVisited || currentNode === this.rootNode) {
          return false
        }
        currentNode.isVisited = true
        return resursiveHelper(assertNonNullOrUndefined(currentNode.parent))
      }
      return resursiveHelper(assertNonNullOrUndefined(initialNode.parent))
    }

    for (let i = 0; i < classCount; i++) {
      const node = this.allNodes[i]
      if (node === this.rootNode) {
        continue
      }
      if (canLoopBackToNode(node)) {
        throw new CSRuleError('0146', [node.classMetadata.name, assertNonNullOrUndefined(node.parent).classMetadata.name], node.classMetadata.codePieceIndex)
      }
    }
  }

  /**
   * Return the inheritance tree node that is associated to a `ClassMetadata`.
   *
   * @param classMetadata The class metadata that you want to get the inheritance tree node for. This class metadata must exists in the `classArray` argument when calling `buildTree`.
   * @returns The inheritance tree node that is associated to the given `ClassMetadata` in the argument.
   */
  findNodeByClassMetadata (classMetadata: ClassMetadata): InheritanceTreeNode {
    const nodeCount = this.allNodes.length
    for (let i = 0; i < nodeCount; i++) {
      const node = this.allNodes[i]
      if (node.classMetadata === classMetadata) {
        return node
      }
    }
    assertNotReachHere()
    return assertNonNullOrUndefined(null) // just for passing tsc
  }
}

class InheritanceTreeNode {
  readonly classMetadata: ClassMetadata
  parent: InheritanceTreeNode | null
  isVisited: boolean // During checking for circular inheritance, this variable indicates whether this node has been visited before or not.

  constructor (classMetadata: ClassMetadata) {
    this.classMetadata = classMetadata
    this.parent = null
    this.isVisited = false
  }
}

export { InheritanceTree }
