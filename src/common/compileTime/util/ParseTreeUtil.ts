import { type ParseTree, TerminalNode, type ParserRuleContext } from 'antlr4'
import { parse, type CsCodeEntryContext } from '../parser'
import { assertTrue, assertNonNullOrUndefined } from '../../../util/Assertion'
import { log, logWarn } from '../../../util/Logger'
import { CSParseTreeToMetadataError } from '../../CSInterpreterError'

/**
 * Iterates every child node of a parse tree node with a callback function, accepting a node that don't have any child node.
 *
 * @param node The parse tree node that the child node(s) will be iterated.
 * @param callback The callback function that the argument will be the child node that is iterated.
 */
function iterateParseTreeNodeChildrenAllowNullChildren (node: ParserRuleContext, callback: ((c: ParseTree) => boolean) | ((c: ParseTree, i : number) => boolean)): void {
  // In ANTLR, only the type "ParserRuleContext" has property "children".
  const children = node.children
  if (children === null) {
    logWarn('iterateParseTreeNodeChildrenAllowNullChildren: children is null for the node below:')
    logWarn(node)
    return
  }
  const childCount = children.length
  for (let i = 0; i < childCount; i++) {
    const child = children[i]
    const shouldContinueIteration = callback(child, i)
    if (!shouldContinueIteration) { // When the callback function returns "false", stop iterating.
      log('Iteration interrupted due to stop sign.')
      break
    }
  }
}

/**
 * Iterates every child node of a parse tree node with a callback function. The node must contains at least one child node.
 *
 * @param node The parse tree node that the child node(s) will be iterated.
 * @param callback The callback function that the argument will be the child node that is iterated.
 */
function iterateParseTreeNodeChildren (node: ParserRuleContext, callback: ((c: ParseTree) => boolean) | ((c: ParseTree, i : number) => boolean)): void {
  assertNonNullOrUndefined(node.children)
  iterateParseTreeNodeChildrenAllowNullChildren(node, callback)
}

/**
 * First find the first child node in a node that has the specified child node type. The child node must only have one child-child node that is a `TerminalNode`. Then return the string data in the `TerminalNode`.
 *
 * @param parent The parent node. It must contains at least one child node.
 * @param nodeType The type of the child node.
 * @returns The data in the `TerminalNode` (a child-child node of `parent`).
 */
function searchDataFromSingleChildNode (parent: ParserRuleContext, nodeType: any): string {
  const childNode = getChildNodeByType(parent, nodeType)
  if (assertNonNullOrUndefined(childNode).children.length !== 1) {
    throw new CSParseTreeToMetadataError('searchDataFromSingleChildNode: Found child node of type ' + nodeType.name + " but it's not a single child node.")
  }
  return getDataFromTerminalNodeChild(assertNonNullOrUndefined(childNode))
}

/**
 * Get the string data from the child `TerminalNode` of a node that only contains exactly one child that is a `TerminalNode`.
 *
 * @param parent The parent node.
 * @returns The data in the `TerminalNode` (a child node of `parent`).
 */
function getDataFromTerminalNodeChild (parent: ParserRuleContext): string {
  const childNodeArray = assertNonNullOrUndefined(parent.children)
  assertTrue(childNodeArray.length === 1)
  const childNode = childNodeArray[0]
  if (!(childNode instanceof TerminalNode)) {
    throw new CSParseTreeToMetadataError('getDataFromTerminalNodeChildren: Found child node of type ' + typeof (childNode) + '. It is a single child node, but its child is not a TerminalNodeImpl instance.')
  }
  /* eslint-disable @typescript-eslint/no-base-to-string */
  return childNode.toString()
}

/**
 * Find the first child node in a node that has the specified child node type, asserts the child node that has the specified child node type can be found.
 *
 * @param parent The parent node. It must contains at least one child node.
 * @returns The first child node found that has the specified child node type.
 */
function getChildNodeByTypeAssertExistsChild (parent: ParserRuleContext, childType: any): ParserRuleContext {
  const retVal: ParserRuleContext | null = getChildNodeByType(parent, childType)
  if (retVal === null) {
    throw new CSParseTreeToMetadataError('getChildNodeByType: Can not find child node of type ' + childType.name)
  }
  return retVal
}

/**
 * Find the first child node in a node that has the specified child node type.
 *
 * @param parent The parent node. It must contains at least one child node.
 * @param childType The type of the child node.
 * @returns The first child node found that has the specified child node type, or `null` if there are no child node found with the specified child node type.
 */
function getChildNodeByType (parent: ParserRuleContext, childType: any): ParserRuleContext | null {
  let retVal: ParserRuleContext | null = null
  const callback = (node: ParserRuleContext): boolean => {
    if (node instanceof childType) {
      retVal = node
      return false
    }
    return true
  }
  iterateParseTreeNodeChildren(parent, callback)
  return retVal
}

/**
 * Parse the raw C# code into an ANTLR parse tree.
 *
 * @param rawCode The raw C# code string.
 * @returns The root node of the ANTLR parse tree.
 */
function parseToTree (rawCode: string): CsCodeEntryContext {
  const retVal = parse(rawCode)
  log('Raw parse tree from ANTLR:')
  log(retVal)
  return retVal
}

export {
  parseToTree,
  iterateParseTreeNodeChildrenAllowNullChildren,
  iterateParseTreeNodeChildren,
  searchDataFromSingleChildNode,
  getChildNodeByType,
  getChildNodeByTypeAssertExistsChild,
  getDataFromTerminalNodeChild
}
