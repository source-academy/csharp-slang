import {
  type CsCodeEntryContext,
  NamespaceDefinitionContext,
  NamespacePathContext,
  NamespaceNameContext,
  NamespaceBodyContext,
  UsingStatementContext,
  UsingNamespacePathContext,
  ClassDefinitionContext,
  type ParserRuleContext
} from '../parser'
import { logWarn } from '../../../util/Logger'
import { assertTrue, assertNonNullOrUndefined } from '../../../util/Assertion'
import {
  parseToTree,
  iterateParseTreeNodeChildren,
  searchDataFromSingleChildNode,
  getChildNodeByTypeAssertExistsChild,
  getChildNodeByType
} from '../util/ParseTreeUtil'
import { CSRuleError, CILError } from '../../CSInterpreterError'
import { TypePath } from '../TypePath'
import { ROOT_NAMESPACE_NAME } from '../../Constants'
import { type UsingNamespacePath } from '../CSharpProgram'
import { type CILTypePath } from '../../cil/CILMethodBody'
import { InternalBindingType } from '../Scope'
import { NamespaceMetadata } from './NamespaceMetadata'
import { ClassMetadata } from './ClassMetadata'
import { getCurrentProgram } from '../../Main'

/**
 * A class for holding the program metadata for a `CSharpProgram`.
 */
class MetadataStorage {
  /**
   * The root namespace in the program. It's an internal namespace so it will not be visible to user's code and type (class) paths.
   */
  readonly rootNamespace: NamespaceMetadata

  /**
   * The constructor for the `MetadataStorage` class.
   */
  constructor () {
    this.rootNamespace = new NamespaceMetadata(ROOT_NAMESPACE_NAME, -1)
  }

  /**
   * Add a piece of raw C# code into the metadata and returns an array of using namespace path (which are actually strings) that are specified from the using directives at the beginning of the newly added C# code piece.
   *
   * @param rawCode The raw C# code string.
   * @returns An array of using namespace path that are specified from the using directives at the beginning of the newly added C# code piece.
   */
  addCodeToMetadataAndGetUsings (rawCode: string): UsingNamespacePath[] {
    const usings: UsingNamespacePath[] = []
    const parseTreeRoot = parseToTree(rawCode)

    const addUsingNamespace = (parseTreeNode: UsingStatementContext): void => {
      const namespacePath = getChildNodeByTypeAssertExistsChild(parseTreeNode, UsingNamespacePathContext)
      let usingNamespacePath: UsingNamespacePath = ''
      const pathArray = assertNonNullOrUndefined(namespacePath.children)
      const pathArrayLength = pathArray.length
      for (let i = 0; i < pathArrayLength; i++) {
        usingNamespacePath += pathArray[i].toString()
      }
      usings[usings.length] = usingNamespacePath
      // log("Added new using [ " + usingNamespacePath + " ] to the metadata.");
    }

    const generateMetadataFromTreeRoot = (parseTreeRoot: CsCodeEntryContext): void => {
      const callback = (node: ParserRuleContext): boolean => {
        if (node instanceof NamespaceDefinitionContext) {
          this.generateNamespaceMetadata(node, this.rootNamespace)
        } else if (node instanceof UsingStatementContext) {
          addUsingNamespace(node)
        } else {
          /* eslint-disable @typescript-eslint/no-base-to-string */
          logWarn('Ignoring unknown node ' + node.toString())
        }
        return true
      }
      iterateParseTreeNodeChildren(parseTreeRoot, callback)
    }

    generateMetadataFromTreeRoot(parseTreeRoot)
    return usings
  }

  /**
   * Get a `ClassMetadata` with an absolute type path.
   * "Absolute" means that this `TypePath` must contains the full namespace path and class name.
   *
   * @param path The absolute type path.
   * @param relatedCodePieceIndex The code piece index of the C# code that requires this method during processing. This is for error reporting.
   * @return The `ClassMetadata` specified by the absolute type path.
   */
  getClassMetadataByAbsolutePath (path: TypePath, relatedCodePieceIndex: number): ClassMetadata {
    assertTrue(path.namespacePath.length > 0)
    const namespacePathLength = path.namespacePath.length
    let currentNamespace: NamespaceMetadata = this.rootNamespace
    for (let i = 0; i < namespacePathLength; i++) {
      const nextNamespaceName = path.namespacePath[i]
      const nextNamespace = currentNamespace.getChildNamespace(nextNamespaceName)
      if (nextNamespace === null) {
        throw new CSRuleError('0234', [nextNamespaceName, currentNamespace.name], relatedCodePieceIndex)
        // return null;
      }
      currentNamespace = nextNamespace
    }
    const className = path.typeName
    const classMetadata = currentNamespace.getClassMetadata(className)
    if (classMetadata === null) {
      if (currentNamespace.getChildNamespace(className) !== null) { // Test whether the given "className" is actually a namespace name.
        throw new CSRuleError('0118', [className], relatedCodePieceIndex)
      }
      throw new CSRuleError('0234', [className, currentNamespace.name], relatedCodePieceIndex)
    }
    return classMetadata
  }

  /**
   * Similar to `getClassMetadataByAbsolutePath()`.
   *
   * The differences are that this method uses a CIL type path (which is actually a string) to find the `ClassMetadata` and it has different error reporting (because the errors from this method are coming from errors in CIL code rather than the users' code).
   *
   * This method should only be used during runtime when running CIL codes, not during compile-time.
   */
  getClassMetadataByCILTypePath (path: CILTypePath): ClassMetadata {
    // todo: support path for nested classes
    const splited = path.split('.')
    const len = splited.length
    let currentNamespace: NamespaceMetadata = this.rootNamespace
    for (let i = 0; i < len - 1; i++) { // The last element in splited should always be the class name
      const nextNamespaceName = splited[i]
      const nextNamespace = currentNamespace.getChildNamespace(nextNamespaceName)
      if (nextNamespace === null) {
        throw new CILError('[getClassMetadataByCILTypePath] Can not find namespace with name ' + nextNamespaceName + ' in namespace ' + currentNamespace.name + '  (full path that causes this error is ' + path + ')')
      }
      currentNamespace = nextNamespace
    }
    const className = splited[len - 1]
    const classMetadata = currentNamespace.getClassMetadata(className)
    if (classMetadata === null) {
      // Unlike function getClassMetadataByAbsolutePath, here I don't check whether className is actually a namespace name, since this check is already performed during compiling C# code to CIL code with function getClassMetadataByAbsolutePath.
      throw new CILError('[getClassMetadataByCILTypePath] Can not find class with name ' + className + ' in namespace ' + currentNamespace.name + '  (full path that causes this error is ' + path + ')')
    }
    return classMetadata
  }

  private generateInnermostNamespaceMetadata (parseTreeNode: NamespaceDefinitionContext, parentNamespace: NamespaceMetadata): void {
    const name = searchDataFromSingleChildNode(parseTreeNode, NamespaceNameContext)
    const theNamespace = parentNamespace.getOrCreateChildNamespace(name)
    const callback = (node: ParserRuleContext): boolean => {
      if (node instanceof NamespaceDefinitionContext) {
        this.generateNamespaceMetadata(node, theNamespace)
      } else if (node instanceof ClassDefinitionContext) {
        const newClass = this.generateClassMetadata(node, theNamespace)
        theNamespace.addNameBinding(InternalBindingType.Class, newClass.name, newClass)
      } else {
        logWarn('Ignoring unknown node ' + node.toString())
      }
      return true
    }
    iterateParseTreeNodeChildren(getChildNodeByTypeAssertExistsChild(parseTreeNode, NamespaceBodyContext), callback)
  }

  private generateNamespaceMetadata (parseTreeNode: NamespaceDefinitionContext, parentNamespace: NamespaceMetadata): void {
    const namespacePathNode = getChildNodeByType(parseTreeNode, NamespacePathContext)
    if (namespacePathNode === null) {
      this.generateInnermostNamespaceMetadata(parseTreeNode, parentNamespace)
      return
    }
    const path = assertNonNullOrUndefined(namespacePathNode.children)
    let currentChildIndexInPath = 0
    const recursiveHelper = (parentNamespace: NamespaceMetadata): void => {
      if (currentChildIndexInPath === path.length) {
        // Now it reaches the end of path (index has passed the terminating dot token in path token array)
        this.generateInnermostNamespaceMetadata(parseTreeNode, parentNamespace)
        return
      }
      const namespaceName = path[currentChildIndexInPath].toString()
      const currentNamespace = parentNamespace.getOrCreateChildNamespace(namespaceName)
      currentChildIndexInPath += 2 // Skip the dot token after the namespace name token
      recursiveHelper(currentNamespace)
    }
    recursiveHelper(parentNamespace)
  }

  private generateClassMetadata (node: ClassDefinitionContext, theNamespace: NamespaceMetadata): ClassMetadata {
    const newClass = new ClassMetadata()
    // todo
    newClass.fromParseTree(node)
    getCurrentProgram().checkDuplicatedClassDefinition(new TypePath(theNamespace.fullPathToString_Namespace() + '.' + newClass.name), theNamespace)
    theNamespace.addChildScope(newClass)
    return newClass
  }
}

export { MetadataStorage }
