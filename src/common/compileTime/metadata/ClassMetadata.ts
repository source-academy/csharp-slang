import { MethodMetadata, ImplementedMethodMetadata, MethodSignature, ExternalMethodMetadata } from './MethodMetadata'
import { getCurrentProgram } from '../../Main'
import {
  type ClassDefinitionContext,
  ClassNameContext,
  ClassBaseListContext,
  ClassBodyContext,
  ClassBodyMethodDefinitionContext,
  FieldDefinitionContext,
  type ParserRuleContext,
  ExternalMethodDefinitionContext
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
import { CONSTRUCTOR_METHOD_NAME, OBJECT_CLASS_PATH_AND_NAME } from '../../Constants'

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
   * The total size (in bytes) of all fields in the runtime object of this class (after the whole compiling process is done, this variable should also include the size of the fields inherited from base classes).
   */
  sizeOfObjectFields: number
  /**
   * Are the base class fields already appended to this `ClassMetadata`?
   *
   * This property is used by the `ProcessClassInheritanceInfomation` stage during compiling.
   */
  baseClassFieldsAppended: boolean

  methodTableGenerated: boolean

  /**
   * The complete method table that can be called on the class, including static methods, instance methods directly implemented in the class and inherited instance methods from the base class.
   */
  readonly completeMethodTable : Record<string, ImplementedMethodMetadata[]> = {};

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
        const newMethod = new ImplementedMethodMetadata()
        this.addChildScope(newMethod)
        newMethod.fromParseTree(node)
        this.methods[this.methods.length] = newMethod
      } else if (node instanceof ExternalMethodDefinitionContext) {
        const newMethod = new ExternalMethodMetadata()
        this.addChildScope(newMethod)
        newMethod.fromParseTreeExternalMethod(node)
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
   *  - Calculate field offsets.
   *  - Check for duplicated field and property names.
   *  - Check for methods with duplicated method signatures defined in this class.
   *
   * This should only be called during compiling by `CSharpProgram`.
   */
  postProcess (): void {
    assertTrue(!this.postProcessFinished)
    // Because the method signature string can only be generated after all of the type specifiers in the method parameter list are matched to classes.
    // So I do the binding process of method signatures to class scopes here.
    //this.bindMethodsToScope()

    this.calculateFieldOffsetsForAllFields()

    this.checkForDuplicatedFieldAndPropertyNames()

    this.checkForDuplicatedMethodSignatures();

    this.postProcessFinished = true
  }

  private checkForDuplicatedMethodSignatures (): void {
    assertTrue(!this.postProcessFinished)
    const temp = this.methods.map(method => method.methodSignature?.toString());
    const len = temp.length
    for (let i = 0; i < len; i++) {
      if(temp.indexOf(temp[i]) !== i) {
        throw new CSRuleError('0111', [this.methods[i].fullPathAndNameToString()], this.methods[i].codePieceIndex)
      }
    }
  }

  /*private bindMethodsToScope (): void {
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
  }*/

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

  private calculateFieldOffsetsForAllFields (): void {
    assertTrue(!this.postProcessFinished)
    assertTrue(!this.baseClassFieldsAppended)
    let accumulatedFieldOffset = 0
    const len = this.fields.length
    for (let i = 0; i < len; i++) {
      const fieldMetadata = this.fields[i]
      assertTrue(fieldMetadata.fieldOffset === -1)
      fieldMetadata.fieldOffset = accumulatedFieldOffset
      accumulatedFieldOffset += fieldMetadata.fieldSize
    }
    this.sizeOfObjectFields = accumulatedFieldOffset
  }

  generateMethodTable() {
    if(this.methodTableGenerated) {
      return;
    }
    const baseClass : ClassMetadata = assertNonNullOrUndefined(this.baseClassSpecifier.matchedClass);
    if(baseClass === this) {
      assertTrue(this.fullPathToString_Class() === OBJECT_CLASS_PATH_AND_NAME);
    }
    else if (!baseClass.methodTableGenerated) {
      baseClass.generateMethodTable();
    }
    for (const methodName in baseClass.completeMethodTable) {
      const baseClassOverloadings = baseClass.completeMethodTable[methodName];
      const baseClassOverloadingCount = baseClassOverloadings.length;
      for (let i = 0; i < baseClassOverloadingCount; i++) {
        const overloading = baseClassOverloadings[i];
        // Skip static methods and constructors in the base class
        if(overloading.isStatic || overloading.methodSignature?.name === CONSTRUCTOR_METHOD_NAME){
          continue;
        }
        if(this.completeMethodTable[methodName] === undefined) {
          this.completeMethodTable[methodName] = [];
        }
        const overloadings = this.completeMethodTable[methodName];
        overloadings[overloadings.length] = overloading;
      }
    }

    const methodCount = this.methods.length;
    for(let i = 0; i < methodCount; i++) {
      if(!(this.methods[i] instanceof ImplementedMethodMetadata)) {
        continue;
      }
      const methodMetadata : ImplementedMethodMetadata = this.methods[i] as ImplementedMethodMetadata;
      const methodName : string = assertNonNullOrUndefined(methodMetadata.methodSignature?.name);
      if(this.completeMethodTable[methodName] === undefined) {
        this.completeMethodTable[methodName] = [];
        this.completeMethodTable[methodName][0] = methodMetadata;
        continue;
      }
      const methodSignatureString = methodMetadata.methodSignature?.toString();
      const overloadings = this.completeMethodTable[methodName];
      const overloadingCount = overloadings.length;
      let isOverridingMethod : boolean = false;
      for(let i = 0; i < overloadingCount; i++) {
        const existingOverloading = overloadings[i];
        if(existingOverloading.methodSignature?.toString() === methodSignatureString) {
          if(methodMetadata.isStatic || methodMetadata.methodSignature?.name === CONSTRUCTOR_METHOD_NAME) {
            throw new CSRuleError("-1", ["(Trying to use a static method / constructor to override other method(s))"], this.codePieceIndex);
          }
          assertTrue(!existingOverloading.isStatic && methodMetadata.methodSignature?.name !== CONSTRUCTOR_METHOD_NAME);
          overloadings[i] = methodMetadata; // Here is method overriding: replace the existing virtual method with the same method signature from the base class with the overriding method in the current class.
          isOverridingMethod = true;
          break;
        }
      }
      if(!isOverridingMethod) {
        overloadings[overloadings.length] = methodMetadata;
      }
    }
    
    for (const methodName in this.completeMethodTable) {
      const overloadings = this.completeMethodTable[methodName];
      const overloadingCount = overloadings.length;
      for (let i = 0; i < overloadingCount; i++) {
        const overloading = overloadings[i]
        const bindingName = assertNonNullOrUndefined(overloading.methodSignature).toString()
        this.addNameBinding(InternalBindingType.Method, bindingName, overloading)
      }
    }

    this.methodTableGenerated = true;
    return;
  }

  compileCIL() : void {
    const len = this.methods.length;
    for(let i = 0; i < len; i++) {
      if(this.methods[i] instanceof ImplementedMethodMetadata) {
        (this.methods[i] as ImplementedMethodMetadata).compileMethodBody();
      }
      //todo: compile properties to cil
    }
  }

  findBestOverloadedMethod(methodName : string, argumentTypes : ClassMetadata[], isStaticMethodCall : boolean, codePieceIndex : number) : ImplementedMethodMetadata {
    // TODO : correctly handling "null" as C# method argument type
    
    type OverloadedMethod = {
      methodMetadata : ImplementedMethodMetadata | null;
      score : number;
    }

    // for reporting CS1503 error
    type FailedOverloadedMethod = {
      score : number; // should always be Infinity to mark this is a "FailedOverloadedMethod".
      argumentNumber: number;
      expectedParameterTypeString: string;
      actualArgumentTypeString: string;
    }

    const overloadings : ImplementedMethodMetadata[] = this.completeMethodTable[methodName];
    if(overloadings === undefined) {
      throw new CSRuleError("0117", [this.name, methodName], codePieceIndex);
    }

    const argumentCount = argumentTypes.length;
    const overloadingCount = overloadings.length;
    const overloadingsWithTheRightNumberOfArguments : (OverloadedMethod | FailedOverloadedMethod)[] = [];
    for(let i = 0; i < overloadingCount; i++) {
      const overloading = overloadings[i];
      const methodSignature : MethodSignature = assertNonNullOrUndefined(overloading.methodSignature);
      const parameterList = methodSignature.parameterList;
      const parameterCount = parameterList.length;
      if(parameterCount !== argumentCount) {
        // TODO: consider the situation of optional argument
        continue;
      }
      overloadingsWithTheRightNumberOfArguments[overloadingsWithTheRightNumberOfArguments.length] = { methodMetadata: overloading, score: 0};
    }

    const overloadingWithTheRightNumberOfArgumentsCount = overloadingsWithTheRightNumberOfArguments.length;
    if(overloadingWithTheRightNumberOfArgumentsCount === 0) {
      throw new CSRuleError("1501", [methodName, argumentCount.toString()], codePieceIndex);
    }
    
    for(let i = 0; i < argumentCount; i++) {
      const scoreboard : OverloadedMethod[] = [];
      for(let j = 0; j < overloadingWithTheRightNumberOfArgumentsCount; j++) {
        if(overloadingsWithTheRightNumberOfArguments[j].score === Infinity) {
          continue;
        }
        assertTrue((overloadingsWithTheRightNumberOfArguments[j] as any).argumentNumber === undefined);
        const overloading : OverloadedMethod = overloadingsWithTheRightNumberOfArguments[j] as OverloadedMethod;
        const methodSignature : MethodSignature = assertNonNullOrUndefined(assertNonNullOrUndefined(overloading.methodMetadata).methodSignature);
        const parameterList = methodSignature.parameterList;
        const argumentType : ClassMetadata = argumentTypes[i]
        const parameterType : ClassMetadata = assertNonNullOrUndefined(parameterList[i].type.matchedClass);
        const typeScore = argumentType.getBaseClassHeight(parameterType);
        if(typeScore === -1) { // stop considering the overloading method in all upcoming iterations because (at least) one of its parameter type is neither the corresponding argument type nor a base type of the corresponding argument type.
          overloadingsWithTheRightNumberOfArguments[j] = {score: Infinity, argumentNumber: i + 1, expectedParameterTypeString: parameterType.fullPathToString_Class(), actualArgumentTypeString: argumentType.fullPathToString_Class()};
          continue;
        }
        overloading.score += typeScore;
        // TODO : Correct logic for CS0121 error
        /*if(scoreboard[overloading.score] !== undefined) {
          throw new CSRuleError("0121", [assertNonNullOrUndefined(assertNonNullOrUndefined(scoreboard[overloading.score].methodMetadata).methodSignature).toString_ParameterTypeWithoutNamespacePath(), methodSignature.toString_ParameterTypeWithoutNamespacePath()], codePieceIndex);
        }*/
        scoreboard[overloading.score] = overloading;
      }
    }

    let result : OverloadedMethod = { methodMetadata: null, score: Infinity};
    let areAllMethodsStatic : boolean = true;
    let areAllMethodsInstance : boolean = true;
    for(let i = 0; i < overloadingWithTheRightNumberOfArgumentsCount; i++){
      if(overloadingsWithTheRightNumberOfArguments[i].score === Infinity) {
        continue;
      }
      const overloading : OverloadedMethod = assertNonNullOrUndefined(overloadingsWithTheRightNumberOfArguments[i]);
      if(overloading.score < result.score) {
        result = overloading;
      }
      if(overloading.methodMetadata?.isStatic) {
        areAllMethodsInstance = false;
      }
      else {
        areAllMethodsStatic = false;
      }
    }

    if(result.methodMetadata === null) {
      const methodInErrorReporting : FailedOverloadedMethod = overloadingsWithTheRightNumberOfArguments[0] as FailedOverloadedMethod;
      throw new CSRuleError("1503", [methodInErrorReporting.argumentNumber.toString(), methodInErrorReporting.actualArgumentTypeString, methodInErrorReporting.expectedParameterTypeString], codePieceIndex);
    }

    if(isStaticMethodCall && areAllMethodsInstance) {
      for(let i = 0; i < overloadingWithTheRightNumberOfArgumentsCount; i++){
        if(overloadingsWithTheRightNumberOfArguments[i].score === Infinity) {
          continue;
        }
        const overloading : OverloadedMethod = assertNonNullOrUndefined(overloadingsWithTheRightNumberOfArguments[i]);
        throw new CSRuleError("0120", [this.name + overloading.methodMetadata?.methodSignature?.toString_ParameterTypeWithoutNamespacePath()], codePieceIndex);
      }
      assertNotReachHere();
    }

    if(!isStaticMethodCall && areAllMethodsStatic) {
      for(let i = 0; i < overloadingWithTheRightNumberOfArgumentsCount; i++){
        if(overloadingsWithTheRightNumberOfArguments[i].score === Infinity) {
          continue;
        }
        const overloading : OverloadedMethod = assertNonNullOrUndefined(overloadingsWithTheRightNumberOfArguments[i]);
        throw new CSRuleError("0176", [this.name + overloading.methodMetadata?.methodSignature?.toString_ParameterTypeWithoutNamespacePath()], codePieceIndex);
      }
      assertNotReachHere();
    }
    
    return result.methodMetadata;
  }

  /**
   * Get the distance from this class to a base class of this class.
   * @param baseClass A base class of this class.
   * @returns The distance from this class to the base class.
   *  - `-1` if the `baseClass` argument is actually **not** a base class of this class.
   *  - `0` if the `baseClass` argument is exactly this class.
   *  - `1` if the `baseClass` argument is the **direct** ancestor of this class, and so on.
   */
  getBaseClassHeight(baseClass : ClassMetadata) : number {
    const recursiveHelper = (currentBaseClass : ClassMetadata, currentHeight : number) : number => {
      if(currentBaseClass === baseClass) {
        return currentHeight;
      }
      if(currentBaseClass.fullPathToString_Class() === OBJECT_CLASS_PATH_AND_NAME){
        return -1;
      }
      return recursiveHelper(assertNonNullOrUndefined(currentBaseClass.baseClassSpecifier.matchedClass), currentHeight + 1);
    }
    return recursiveHelper(this, 0);
  }
}

export { ClassMetadata }
