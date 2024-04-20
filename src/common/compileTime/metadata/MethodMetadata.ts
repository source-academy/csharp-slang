import { TypeSpecifier } from '../TypeSpecifier'
import { Scope } from '../Scope'
import { assertNonNullOrUndefined, assertNotReachHere, assertTrue } from '../../../util/Assertion'
import { getCurrentProgram } from '../../Main'
import {
  MethodDefinitionContext,
  type MethodModifierContext,
  MethodModifierListContext,
  MethodNameContext,
  MethodParameterListContext,
  type MethodParameterContext,
  MethodParameterTypeContext,
  MethodParameterNameContext,
  MethodReturnTypeContext,
  TypeSpecifierContext,
  TerminalNode,
  type ClassBodyMethodDefinitionContext,
  MethodBodyContext,
  ExternalMethodDefinitionContext,
  DataAnnotationContext,
  DllImportStatementContext,
  ImportedDllNameContext,
  StringContext,
  BaseConstructorCallContext,
} from '../parser'
import {
  iterateParseTreeNodeChildren,
  iterateParseTreeNodeChildrenAllowNullChildren,
  getChildNodeByTypeAssertExistsChild,
  getChildNodeByType,
  getDataFromTerminalNodeChild
} from '../util/ParseTreeUtil'
import { ClassMetadata } from './ClassMetadata'
import { CILMethodBody, } from '../../cil/CILMethodBody'
import { MethodBodyCompiler } from '../MethodBodyCompiler'
import { removeFirstCharacter, removeLastCharacter } from '../../../util/StringUtil'
import { CSRuleError } from '../../CSInterpreterError'
import { CONSTRUCTOR_METHOD_NAME } from '../../Constants'

class MethodParameter {
  readonly type: TypeSpecifier
  readonly name: string

  constructor (type: TypeSpecifier, name: string) {
    this.type = type
    this.name = name
  }

  equalTo (other: MethodParameter): boolean {
    return this.name === other.name && this.type.equalTo(other.type)
  }

  typeSpecifierToString (): string {
    return this.type.toString()
  }
}

class MethodSignature {
  name: string
  readonly parameterList: MethodParameter[]

  constructor (name: string, parameterList: MethodParameter[]) {
    this.name = name
    this.parameterList = parameterList
  }

  equalTo (other: MethodSignature): boolean {
    if (this.name !== other.name) {
      return false
    }
    const parameterCount = this.parameterList.length
    if (parameterCount !== other.parameterList.length) {
      return false
    }
    for (let i = 0; i < parameterCount; i = i + 1) {
      if (!this.parameterList[i].equalTo(other.parameterList[i])) {
        return false
      }
    }
    return true
  }

  toString (): string {
    let result = this.name + '('
    const parameterCount = this.parameterList.length
    for (let i = 0; i < parameterCount; i++) {
      result += this.parameterList[i].typeSpecifierToString() + (i !== parameterCount - 1 ? ',' : '')
    }
    result += ')'
    return result
  }

  toString_ParameterTypeWithoutNamespacePath() : string {
    let result = this.name + '('
    const parameterCount = this.parameterList.length
    for (let i = 0; i < parameterCount; i++) {
      result += this.parameterList[i].type.matchedClass?.name + (i !== parameterCount - 1 ? ', ' : '')
    }
    result += ')'
    return result
  }
}

type MethodModifier = string

class MethodReturnType {
  type: TypeSpecifier | null

  constructor () {
    this.type = null
  }

  fromParseTree (node: TypeSpecifierContext, closestScope: Scope): void {
    this.type = new TypeSpecifier(closestScope)
    this.type.fromParseTree(node)
  }
}

class MethodReturnTypeVoid extends MethodReturnType {
  fromParseTree (node: TypeSpecifierContext): void {
    assertNotReachHere()
  }
}

/**
 * An abstract class that represents general methods.
 *
 * Its subclasses can represent different kinds of methods, such as methods in classes or methods in interfaces.
 */
abstract class MethodMetadata extends Scope { // any: just a dummy here now, will be replaced to the actual required types in the future.
  /**
   * An array of the method modifiers for this method.
   */
  readonly modifiers: MethodModifier[]
  /**
   * The method signature of this method.
   */
  methodSignature: MethodSignature | null
  /**
   * The return type of this method.
   */
  returnType: MethodReturnType | null

  /**
   * Is the method a static method?
   */
  isStatic: boolean

  /**
   * The constructor for the `MethodMetadata` class.
   *
   * You need to use method `fromParseTreeMethodMetadata` to fill in the data from a parse tree node.
   */
  constructor () {
    super(getCurrentProgram().getCurrentCodePieceIndexAssertExistsCodePiece())
    this.modifiers = []
    this.methodSignature = null
    this.returnType = null
  }

  /**
   * Fill in the data from a parse tree node that has a type of `ClassDefinitionContext`.
   *
   * You can NOT call this method for more than one time on the same object.
   */
  fromParseTreeMethodMetadata (parseTreeNode: MethodDefinitionContext): void {
    this.fromParseTree_ModifierList(parseTreeNode)
    this.fromParseTree_MethodSignature(parseTreeNode)
    this.fromParseTree_ReturnType(parseTreeNode)
  }

  private fromParseTree_ModifierList (parseTreeNode: MethodDefinitionContext): void {
    const callback = (node: MethodModifierContext): boolean => {
      const modifier = getDataFromTerminalNodeChild(node)
      this.modifiers[this.modifiers.length] = modifier;
      if(modifier === 'static') {
        this.isStatic = true;
      }
      return true
    }
    const methodModifierListNode = getChildNodeByTypeAssertExistsChild(parseTreeNode, MethodModifierListContext)
    iterateParseTreeNodeChildrenAllowNullChildren(methodModifierListNode, callback)
  }

  private fromParseTree_MethodSignature (parseTreeNode: MethodDefinitionContext): void {
    assertTrue(this.methodSignature === null)
    assertTrue(this.returnType === null)
    const methodName = getDataFromTerminalNodeChild(getChildNodeByTypeAssertExistsChild(parseTreeNode, MethodNameContext))
    const parameterListNode = getChildNodeByType(parseTreeNode, MethodParameterListContext)
    const parameterList: MethodParameter[] = []
    if (parameterListNode !== null) { // In the parse tree, for a method with an empty parameter list, the node MethodParameterListContext will not present under that MethodDefinitionContext
      const callback = (node: MethodParameterContext | TerminalNode): boolean => {
        if (node instanceof TerminalNode) { // TerminalNode is the token for ',' between parameters
          return true
        }
        const parameterType = new TypeSpecifier(assertNonNullOrUndefined(this.parent))
        parameterType.fromParseTree(getChildNodeByTypeAssertExistsChild(getChildNodeByTypeAssertExistsChild(node, MethodParameterTypeContext), TypeSpecifierContext) as TypeSpecifierContext)
        const parameterName = getDataFromTerminalNodeChild(getChildNodeByTypeAssertExistsChild(node, MethodParameterNameContext))
        parameterList[parameterList.length] = new MethodParameter(parameterType, parameterName)
        return true
      }
      iterateParseTreeNodeChildren(parameterListNode, callback)
    }
    this.methodSignature = new MethodSignature(methodName, parameterList)
  }

  private fromParseTree_ReturnType (parseTreeNode: MethodDefinitionContext): void {
    const returnTypeNode = getChildNodeByType(parseTreeNode, MethodReturnTypeContext)
    if(returnTypeNode !== null) {
      const returnTypeSpecifierNode = getChildNodeByType(returnTypeNode, TypeSpecifierContext)
      if (returnTypeSpecifierNode === null) { // If there is no TypeSpecifierContext under MethodReturnTypeContext, then there should be a TerminalNodeImpl under MethodReturnTypeContext which holds "void".
        assertTrue(getDataFromTerminalNodeChild(returnTypeNode) === 'void')
        this.returnType = new MethodReturnTypeVoid()
      } else {
        this.returnType = new MethodReturnType()
        this.returnType.fromParseTree(returnTypeSpecifierNode as TypeSpecifierContext, assertNonNullOrUndefined(this.parent))
      }
    }
    else {
      assertTrue(this.parent instanceof ClassMetadata);
      const className = (this.parent as ClassMetadata).name;
      const methodSignature = assertNonNullOrUndefined(this.methodSignature) as MethodSignature;
      if(methodSignature.name !== className) {
        throw new CSRuleError("1520", [], this.codePieceIndex);
      }
      // Treat this method as a constructor
      methodSignature.name = CONSTRUCTOR_METHOD_NAME;
      this.returnType = null;
    }
    
  }

  /**
   * Get the full path of this method as a string, including the full namespace path to the owner class/interface, the owner class's/interface's name and the method signature.
   *
   * For example: `Namespace1.Namespace2.Namespace3.Class1.Method1(System.Int32)`
   *
   * @returns The full path of this method as a string.
   */
  fullPathAndNameToString (): string {
    if (this.parent instanceof ClassMetadata) {
      return assertNonNullOrUndefined(this.parent).fullPathToString_Class() + '.' + assertNonNullOrUndefined(this.methodSignature).toString()
    }
    assertNotReachHere()
    return 'ERROR' // Just for passing tsc
  }
}

/**
 * An class that represents a method with method body (implementation) in a class.
 */
class ImplementedMethodMetadata extends MethodMetadata {
  methodBody: CILMethodBody
  compiler : MethodBodyCompiler | null;
  /**
   * Fill in the data from a parse tree node that has a type of `ClassBodyMethodDefinitionContext`.
   *
   * You can NOT call this method for more than one time on the same `ImplementedMethodMetadata` object.
   */
  fromParseTree (node : ClassBodyMethodDefinitionContext): void {
    this.fromParseTreeMethodMetadata(getChildNodeByTypeAssertExistsChild(node, MethodDefinitionContext) as MethodDefinitionContext)
    const methodBodyNode : MethodBodyContext = getChildNodeByTypeAssertExistsChild(node, MethodBodyContext) as MethodBodyContext;
    const baseConstructorCallNode = getChildNodeByType(node, BaseConstructorCallContext) as BaseConstructorCallContext | null;
    if(baseConstructorCallNode !== null && this.methodSignature?.name !== CONSTRUCTOR_METHOD_NAME) {
      throw new CSRuleError("-1", ["Calling base constructor in a non-constructor method"], this.codePieceIndex);
    }
    this.compiler = new MethodBodyCompiler(methodBodyNode, assertNonNullOrUndefined(this.methodSignature), this.isStatic, this, baseConstructorCallNode);
    // this.addNameBinding(InternalBindingType.Method, this.methodSignature.toString(), this);
  }

  compileMethodBody() {
    this.methodBody = assertNonNullOrUndefined(this.compiler).compileMethodBody();
    this.compiler = null;
  }

  
}

class ExternalMethodMetadata extends ImplementedMethodMetadata {
  libraryName : string;

  fromParseTreeExternalMethod(node : ExternalMethodDefinitionContext) {
    this.fromParseTreeMethodMetadata(getChildNodeByTypeAssertExistsChild(node, MethodDefinitionContext) as MethodDefinitionContext)
    this.libraryName = 
    getDataFromTerminalNodeChild(
      getChildNodeByTypeAssertExistsChild(
      getChildNodeByTypeAssertExistsChild(
      getChildNodeByTypeAssertExistsChild(
        getChildNodeByTypeAssertExistsChild(
        node,
        DataAnnotationContext),
        DllImportStatementContext),
        ImportedDllNameContext),
        StringContext));
      this.libraryName = removeLastCharacter(removeFirstCharacter(this.libraryName));
  }

  /**
   * This function should not be called.
   * @param node
   */
  fromParseTree (node : ClassBodyMethodDefinitionContext) {
    assertNotReachHere();
  }

  /**
   * A dummy function, since the external method are implemented "externally", so it can't be compiled like a normally implemented method.
   * @returns 
   */
  compileMethodBody() {
    return;
  }
}

export { MethodMetadata, ImplementedMethodMetadata, ExternalMethodMetadata, MethodSignature, MethodParameter, MethodReturnTypeVoid }
