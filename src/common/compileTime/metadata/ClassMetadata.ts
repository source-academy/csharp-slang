import { type MethodMetadata, ClassBodyMethodMetadata } from './MethodMetadata'
import { getCurrentProgram } from '../../Main'
import {
  type ClassDefinitionContext,
  ClassNameContext,
  ClassBaseListContext,
  ClassBodyContext,
  ClassBodyMethodDefinitionContext,
  FieldDefinitionContext,
  type ParserRuleContext
} from '../parser'
import { TypeSpecifier } from '../TypeSpecifier'
import { TypePath } from '../TypePath'
import { FieldMetadata } from './FieldMetadata'
import {
  iterateParseTreeNodeChildren,
  searchDataFromSingleChildNode,
  getChildNodeByTypeAssertExistsChild,
  getChildNodeByType
} from '../util/ParseTreeUtil'
import { NamespaceMetadata } from './NamespaceMetadata'
import { Scope, InternalBindingType } from '../Scope'
import { CSRuleError } from '../../CSInterpreterError'
import { assertNonNullOrUndefined, assertNotReachHere, assertTrue } from '../../../util/Assertion'
import { OBJECT_CLASS_PATH_AND_NAME } from '../../Constants'

class ClassMetadata extends Scope {
  /**
   * The name of the class.
   */
  name: string
  // namespace : NamespaceMetadata;
  /**
   * The methods that are directly in the class.
   */
  readonly methods: MethodMetadata[]
  /**
   * The `TypeSpecifier` for the base class of this class.
   */
  baseClassSpecifier: TypeSpecifier
  /**
   * Have this `ClassMetadata` finished post processing?
   *
   * This property is used by the `PostProcessClassMetadata` stage during compiling.
   */
  postProcessFinished: boolean
  /**
   * All the fields in this class, including the field directly in this class and all inherited fields.
   */
  readonly fields: FieldMetadata[]
  /**
   * The unique index of this `ClassMetadata` in `CSharpProgram.allClasses`
   */
  readonly classMetadataIndex: number
  /**
   * The total size (in bytes) of all fields in the runtime object of this class.
   */
  sizeOfObjectFields: number
  /**
   * Are the base class fields already appended to this `ClassMetadata`?
   *
   * This property is used by the `ProcessClassInheritanceInfomation` stage during compiling.
   */
  baseClassFieldsAppended: boolean

  /**
   * The constructor for the `ClassMetadata` class.
   *
   * You need to use method `fromParseTree` to fill in the data from a parse tree node.
   */
  constructor () {
    super(getCurrentProgram().getCurrentCodePieceIndexAssertExistsCodePiece())
    this.name = ''
    this.methods = []
    this.postProcessFinished = false
    this.fields = []
    this.classMetadataIndex = getCurrentProgram().addClassAndGetIndex(this)
    this.sizeOfObjectFields = 0
    this.baseClassFieldsAppended = false
  }

  /**
   * Fill in the data from a parse tree node that has a type of `ClassDefinitionContext`.
   *
   * You can NOT call this method for more than one time on the same `ClassMetadata` object.
   */
  fromParseTree (parseTreeNode: ClassDefinitionContext): void {
    assertTrue(this.name === '')
    this.name = searchDataFromSingleChildNode(parseTreeNode, ClassNameContext)
    const classBaseListNode = getChildNodeByType(parseTreeNode, ClassBaseListContext) as ClassBaseListContext
    this.fromParseTree_ClassBaseList(classBaseListNode)
    const classBodyNode = getChildNodeByTypeAssertExistsChild(parseTreeNode, ClassBodyContext) as ClassBodyContext
    this.fromParseTree_ClassBody(classBodyNode)
  }

  private fromParseTree_ClassBaseList (classBaseListNode: ClassBaseListContext | null): void {
    if (classBaseListNode === null) { // For a class without an explicit base list, the ClassBaseListContext node will not present under the ClassDefinitionContext node.
      this.baseClassSpecifier = new TypeSpecifier(this, OBJECT_CLASS_PATH_AND_NAME)
      return
    }
    // By C# rule CS1722, if the class has specified a base class, then the name of the base class should always be the first element in the class base list (before all interface names)
    // TODO:
    // after adding interface support, here I need to first check whether the first name in the base list is an interface name or a class name
    // if the first name in the base list is an interface name, then by C# rule CS1722, all names in the base list should be a namespace name, otherwise throw CS1722 error.
    // I also need to check whether the class has multiple base classes, if yes, throw CS1721 error.
    // For now, since there is currently no interface support, I just simply treat the first element in the class base list as the name of the base class and ignore all other elements in the class base list.
    this.baseClassSpecifier = new TypeSpecifier(this)
    this.baseClassSpecifier.fromParseTree_TypeIdentifierNode(assertNonNullOrUndefined(classBaseListNode.children)[0])
  }

  private fromParseTree_ClassBody (classBodyNode: ClassBodyContext): void {
    const callback = (node: ParserRuleContext): boolean => {
      if (node instanceof ClassBodyMethodDefinitionContext) {
        const newMethod = new ClassBodyMethodMetadata()
        this.addChildScope(newMethod)
        newMethod.fromParseTree(node)
        this.methods[this.methods.length] = newMethod
      } else if (node instanceof FieldDefinitionContext) {
        // todo: support static fields
        const newField = new FieldMetadata(this)
        this.fields[this.fields.length] = newField
        newField.fromParseTree(node)
      }
      return true
    }
    iterateParseTreeNodeChildren(classBodyNode, callback)
  }

  /**
   * Get a `TypePath` object that can represent this `ClassMetadata`.
   *
   * @returns A `TypePath` object that can represent this `ClassMetadata`.
   */
  getTypePath (): TypePath {
    return new TypePath(this.fullPathToString_Class())
  }

  /**
   * Get the full path of this class as a string, including the full namespace path and the class name.
   *
   * For example: `Namespace1.Namespace2.Namespace3.Class1`
   *
   * @returns The full path of this class as a string.
   */
  fullPathToString_Class (): string {
    if (this.parent instanceof NamespaceMetadata) {
      return this.parent.fullPathToString_Namespace() + '.' + this.name
    } else if (this.parent instanceof ClassMetadata) {
      // for nested classes
      return this.parent.fullPathToString_Class() + '+' + this.name
    }
    assertNotReachHere()
    return 'ERROR' // just for passing tsc
  }

  /**
   * Postprocess this `ClassMetadata` during compiling.
   *  - Bind methods based on method signatures to scope.
   *  - Calculate field sizes and offsets, and set `isReferenceField` property for all `FieldMetadata`.
   *  - Check for duplicated field and property names.
   *
   * This should only be called during compiling by `CSharpProgram`.
   */
  postProcess (): void {
    assertTrue(!this.postProcessFinished)
    // Because the method signature string can only be generated after all of the type specifiers in the method parameter list are matched to classes.
    // So I do the binding process of method signatures to class scopes here.
    this.bindMethodsToScope()

    this.calculateFieldSizesAndOffsetsAndSetIsReferenceFieldForAllFields()

    this.checkForDuplicatedFieldAndPropertyNames()

    this.postProcessFinished = true
  }

  private bindMethodsToScope (): void {
    assertTrue(!this.postProcessFinished)
    const len = this.methods.length
    for (let i = 0; i < len; i++) {
      const methodMetadata = this.methods[i]
      const bindingName = assertNonNullOrUndefined(methodMetadata.methodSignature).toString()
      try {
        this.addNameBinding(InternalBindingType.Method, bindingName, methodMetadata)
      } catch (e) {
        throw new CSRuleError('0111', [methodMetadata.fullPathAndNameToString()], methodMetadata.codePieceIndex)
      }
    }
  }

  private checkForDuplicatedFieldAndPropertyNames (): void {
    // todo: also need to check for duplicated property names together with fields names after adding class property support
    const fieldCount = this.fields.length
    for (let i = 0; i < fieldCount; i++) {
      for (let j = 0; j < fieldCount; j++) {
        if (i === j) {
          continue
        }
        if (this.fields[i].fieldName === this.fields[j].fieldName) {
          throw new CSRuleError('0102', [this.fullPathToString_Class(), this.fields[i].fieldName], this.codePieceIndex)
        }
      }
    }
  }

  private calculateFieldSizesAndOffsetsAndSetIsReferenceFieldForAllFields (): void {
    assertTrue(!this.postProcessFinished)
    let accumulatedFieldOffset = 0
    const len = this.fields.length
    for (let i = 0; i < len; i++) {
      const fieldMetadata = this.fields[i]
      fieldMetadata.calculateFieldSizeAndSetIsReferenceField()
      assertTrue(fieldMetadata.fieldOffset === -1)
      fieldMetadata.fieldOffset = accumulatedFieldOffset
      accumulatedFieldOffset += fieldMetadata.fieldSize
    }
    this.sizeOfObjectFields = accumulatedFieldOffset
  }
}

export { ClassMetadata }
