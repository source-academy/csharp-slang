import { assertNonNullOrUndefined, assertNotReachHere, assertTrue } from "../../util/Assertion";
import { logWarn } from "../../util/Logger";
import { CILMethodBody, INTERNAL_PARAMETER_NAME_FOR_THIS_REFERENCE } from "../cil/CILMethodBody";
import { CILOperationCodes } from "../cil/CILOperationCodes";
import { ImplementedMethodMetadata, MethodMetadata, MethodParameter, MethodReturnTypeVoid, MethodSignature } from "./metadata/MethodMetadata";
import { CodeBlockContext, InstructionListContext, MethodBodyContext, ParseTree, TerminalNode, AdditiveExprContext, BaseValueContext, ExpressionContext, NumberContext, ReturnStatementContext, EvaluationChainContext, InstructionContext, MethodCallContext, MethodNameContext, MultiplicativeExprContext, ObjectReferenceIdentifierContext, ParameterListContext, ParentheseExpressionContext, StatementContext, OperandContext, LocalVariableDefinitionContext, LocalVariableNameContext, LocalVariableTypeContext, TypeSpecifierContext, VariableIdentifierContext, StringContext, NewObjectContext, TypeIdentifierContext, FieldOrPropertyAccessContext, AssignmentContext, FieldOrPropertyNameContext, BaseConstructorCallContext } from "./parser";
import { getChildNodeByTypeAssertExistsChild, getDataFromTerminalNodeChild, iterateParseTreeNodeChildren, searchDataFromSingleChildNode } from "./util/ParseTreeUtil";
import { Scope } from "./Scope";
import { CSRuleError, NameBindingError } from "../CSInterpreterError";
import { ClassMetadata } from "./metadata/ClassMetadata";
import { getCurrentProgram } from "../Main";
import { CONSTRUCTOR_METHOD_NAME, PrimitiveClassNames, SYSTEM_NAMESPACE_PATH } from "../Constants";
import { Stack } from "../../util/Stack";
import { primitiveTypeToInternalTypeName } from "./TypePath";
import { TypeSpecifier } from "./TypeSpecifier";
import { removeFirstCharacter, removeLastCharacter } from "../../util/StringUtil";
import { CILLocal } from "../cil/CILLocal";
import { CILInstruction } from "../cil/CILInstruction";
import { FieldMetadata } from "./metadata/FieldMetadata";

class MethodBodyCompiler {
    private result : CILMethodBody;
    private isStatic : boolean;
    private methodSignature : MethodSignature;
    private methodBodyNode : MethodBodyContext;
    private scope : Scope;

    //private argumentNameToIndexMapping : Record<string, number> = {};
    //private indexToArgumentNameMapping : Record<number, string> = {};

    private cilAddressCounter : number;
    private localIndexCounter : number;

    private codeBlockStack : Stack<CompileTimeCodeBlockScope>; // todo
    private operandTypeStack : Stack<OperandType>;

    private baseConstructorCallNode : BaseConstructorCallContext | null;
    
    constructor(methodBodyNode : MethodBodyContext, methodSignature : MethodSignature, isStatic : boolean, scope : Scope, baseConstructorCallNode : BaseConstructorCallContext | null) {
        this.methodBodyNode = methodBodyNode;
        this.methodSignature = methodSignature;
        this.isStatic = isStatic;
        this.scope = scope;
        this.baseConstructorCallNode = baseConstructorCallNode;
        this.codeBlockStack = new Stack<CompileTimeCodeBlockScope>();
        this.operandTypeStack = new Stack<OperandType>();
    }

    public compileMethodBody() : CILMethodBody {
        this.result = new CILMethodBody();
        this.result.initializeAsEmpty();
        //this.argumentNameToIndexMapping = {};
        //this.indexToArgumentNameMapping = {};
        this.cilAddressCounter = 0;
        this.localIndexCounter = 0;
        this.codeBlockStack.clear();
        this.operandTypeStack.clear();

        const rootScope = new CompileTimeCodeBlockScope();
        this.codeBlockStack.push(rootScope);
        if (!this.isStatic) {
          // If the method is not a static method, then the parameter with index 0 is always the "this" reference.
          const ownerClass = this.getOwnerClass();
          assertTrue(ownerClass instanceof ClassMetadata); // TODO : For now, I don't consider the local function feature in C#, so the parent of a method should be its owner class.
          rootScope.addNewVariable(new CompileTimeVariable(INTERNAL_PARAMETER_NAME_FOR_THIS_REFERENCE, ownerClass, EnumCompileTimeVariablePlace.Argument, 0));
          //this.argumentNameToIndexMapping[INTERNAL_PARAMETER_NAME_FOR_THIS_REFERENCE] = 0;
          //this.indexToArgumentNameMapping[0] = INTERNAL_PARAMETER_NAME_FOR_THIS_REFERENCE;
        }
        const parameterList : MethodParameter[] = assertNonNullOrUndefined(this.methodSignature).parameterList;
        const parameterCount : number = parameterList.length;
        for (let i = 0; i < parameterCount; i++) {
          const parameter : MethodParameter = parameterList[i];
          const cilArgumentIndex = this.isStatic ? i : i + 1;
          const name = parameter.name;
          const type = assertNonNullOrUndefined(parameter.type.matchedClass);
          if(rootScope.getVariable(name) !== null) {
            // TODO : Actually, the check for duplicated parameter names should be in method declaration compiler, not in method body compiler
            // This is because in C#, abstract methods or a method declarations in interfaces, which don't have method body, can also have CS0100 error if there are duplicated parameter names in the method declarations.
            throw new CSRuleError("0100", [name], this.scope.codePieceIndex);
          }
          rootScope.addNewVariable(new CompileTimeVariable(name, type, EnumCompileTimeVariablePlace.Argument, cilArgumentIndex));
          //this.argumentNameToIndexMapping[parameter.name] = index;
          //this.indexToArgumentNameMapping[index] = parameter.name;
        }
        if(this.baseConstructorCallNode !== null) {
          this.compileBaseConstructorCall();
        }
        const codeBlockNode : CodeBlockContext = getChildNodeByTypeAssertExistsChild(this.methodBodyNode, CodeBlockContext) as CodeBlockContext;
        this.compileCodeBlock(codeBlockNode);
        this.codeBlockStack.pop();
        assertTrue(this.codeBlockStack.isEmpty());
        return this.result;
      }
    
      private compileCodeBlock(node : CodeBlockContext) : void {
        this.codeBlockStack.push(new CompileTimeCodeBlockScope());
        const callback = (node : ParseTree) : boolean => {
            if(node instanceof TerminalNode) {
                return true;
            }
            else if(node instanceof InstructionListContext) {
                this.compileInstructionList(node);
            }
            else if(node instanceof CodeBlockContext) {
                this.compileCodeBlock(node);
            }
            return true;
        }
        iterateParseTreeNodeChildren(node, callback);
        this.codeBlockStack.pop();
      }

      private compileInstructionList(node : InstructionListContext) : void {
        const callback = (childNode : ParseTree) : boolean => {
            if(childNode instanceof InstructionContext) {
                this.compileInstruction(childNode);
            }
            else{
              logWarn("Unknown child node " + childNode.toString() + " (" + childNode.constructor.name + ")");
            }
            return true;
        }
        iterateParseTreeNodeChildren(node, callback);
      }

      private compileInstruction(node : InstructionContext) : void {
        const childNode = assertNonNullOrUndefined(node.children)[0];
        if(childNode instanceof ReturnStatementContext) {
            this.compileReturnStatement(childNode);
        }
        else if(childNode instanceof StatementContext) {
          this.compileStatement(childNode);
        }
        else if(childNode instanceof LocalVariableDefinitionContext) {
          this.compileLocalVariableDefinition(childNode);
        }
        else {
          logWarn("Unknown child node " + childNode.toString() + " (" + childNode.constructor.name + ")");
        }
        return;
      }

      private compileReturnStatement(node : ReturnStatementContext) : void {
        const expressionNode : ExpressionContext = getChildNodeByTypeAssertExistsChild(node, ExpressionContext) as ExpressionContext;
        this.compileExpression(expressionNode);
        // TODO : type-checking
        this.addInstructionAtEnd(CILOperationCodes.ret, []);
      }

      private compileExpression(node : ExpressionContext) : void {
        const childNode = assertNonNullOrUndefined(node.children)[0];
        if(childNode instanceof NumberContext) {
          this.compileNumberLiteral(childNode);
        }
        else if(childNode instanceof AdditiveExprContext) {
          this.compileAdditiveExpression(childNode);
        }
        else if(childNode instanceof VariableIdentifierContext) {
          this.compileVariableIdentifier(childNode);
        }
        else {
          logWarn("Unknown child node " + childNode.toString() + " (" + childNode.constructor.name + ")");
        }
      }

      // TODO: Here I treat all integers as System.Int32 and all decimal numbers as System.Double. Need to distinguish different type of numbers, for example, "long", "float", etc.
      private compileNumberLiteral(node : NumberContext) : void {
        let numberStr : string = getDataFromTerminalNodeChild(node);
        numberStr = numberStr.toLowerCase().replaceAll("_", ""); // remove all digit separators
        let primitiveNumberType : string = "";
        if(numberStr.indexOf(".") !== -1) {
          // TODO: float type, decimal type
          /*if(numberStr.indexOf("f") === numberStr.length - 1) {
            primitiveNumberType = "float";
            numberStr = numberStr.replaceAll("f", "");
          }
          else{*/
          primitiveNumberType = "double";
          //}
        }
        else {
          primitiveNumberType = "int";
          // TODO: other integer types
        }
        assertTrue(primitiveNumberType !== "");
        const radix : number = numberStr.indexOf("0x") === 0 ? 16 : 10;
        const num : number = Number.parseInt(numberStr, radix);
        const operationCode = primitiveNumberType === "double"
                              ? CILOperationCodes.ldc_r8
                              : primitiveNumberType === "int"
                              ? CILOperationCodes.ldc_i4
                              : assertNotReachHere();
        const numberType = getCurrentProgram().getClassMetadataByFullPathString_Cached(SYSTEM_NAMESPACE_PATH + "." + primitiveTypeToInternalTypeName(primitiveNumberType), this.scope.codePieceIndex);
        this.pushRegularOperandType(numberType);
        this.addInstructionAtEnd(operationCode as CILOperationCodes, [num.toString()]);
      }

      private compileAdditiveExpressionOperand(node : ParseTree) : void {
        if(node instanceof BaseValueContext){
          this.compileBaseValue(node);
        }
        else if (node instanceof MultiplicativeExprContext) {
          this.compileMultiplicativeExpression(node);
        }
        else {
          assertNotReachHere();
        }
      }

      private compileBaseValue(node : BaseValueContext) : void {
        const childNode = assertNonNullOrUndefined(node.children)[0];
        if(childNode instanceof NumberContext) {
            this.compileNumberLiteral(childNode);
        }
        else if(childNode instanceof ParentheseExpressionContext) {
          this.compileParentheseExpression(childNode);
        }
        else if(childNode instanceof OperandContext) {
          this.compileOperand(childNode);
        }
        else {
          logWarn("Unknown child node " + childNode.toString() + " (" + childNode.constructor.name + ")");
        }
        // TODO: other child types
      }

      private compileOperand(node : OperandContext) : void {
        const childNode = assertNonNullOrUndefined(node.children)[0];
        if(childNode instanceof EvaluationChainContext) {
            this.compileEvaluationChain(childNode);
        }
        else if(childNode instanceof VariableIdentifierContext) {
          this.compileVariableIdentifier(childNode);
        }
        else {
          logWarn("Unknown child node " + childNode.toString() + " (" + childNode.constructor.name + ")");
        }
        // TODO: other child types
      }

      private compileAdditiveExpression(node : AdditiveExprContext) : void {
        let operator : string = "";
            const callback = (theChildNode : ParseTree, index : number) : boolean => {
                if (index === 0) {
                  this.compileAdditiveExpressionOperand(theChildNode);
                }
                else if (index % 2 === 1) {
                  operator = theChildNode.toString();
                }
                else {
                  const cilAddressBeforeCompilingTheSecondOperand = this.cilAddressCounter;
                  this.compileAdditiveExpressionOperand(theChildNode);
                  const stringType = getCurrentProgram().getClassMetadataByFullPathString_Cached(SYSTEM_NAMESPACE_PATH + "." + PrimitiveClassNames.String, this.scope.codePieceIndex);
                  const secondOperandType = this.popRegularOperand();
                  const firstOperandType = this.popRegularOperand();
                  if(firstOperandType === stringType || secondOperandType === stringType) {
                    if(operator !== "+") {
                      throw new CSRuleError("0019", [operator, firstOperandType.fullPathToString_Class(), secondOperandType.fullPathToString_Class()], this.scope.codePieceIndex);
                    }
                    this.pushRegularOperandType(stringType);
                    if(firstOperandType !== stringType) {
                      this.addInstructionAtAddress(CILOperationCodes.callvirt, ["instance", stringType.fullPathToString_Class(), firstOperandType.fullPathToString_Class() + "::" + "ToString()"], cilAddressBeforeCompilingTheSecondOperand);
                    }
                    if(secondOperandType !== stringType) {
                      this.addInstructionAtEnd(CILOperationCodes.callvirt, ["instance", stringType.fullPathToString_Class(), secondOperandType.fullPathToString_Class() + "::" + "ToString()"]);
                    }
                    this.addInstructionAtEnd(CILOperationCodes.call, ["class", stringType.fullPathToString_Class(), stringType.fullPathToString_Class() + "::Concat(" + stringType.fullPathToString_Class() + "," + stringType.fullPathToString_Class() + ")"]);
                    operator = "";
                  }
                  else {
                    switch(operator) {
                      case "+":
                        this.addInstructionAtEnd(CILOperationCodes.add, []);
                        break;
                      case "-":
                        this.addInstructionAtEnd(CILOperationCodes.sub, []);
                        break;
                      default:
                        assertNotReachHere();
                    }
                    operator = "";
                    const doubleType = getCurrentProgram().getClassMetadataByFullPathString_Cached(SYSTEM_NAMESPACE_PATH + "." + PrimitiveClassNames.Double, this.scope.codePieceIndex)
                    const int32Type = getCurrentProgram().getClassMetadataByFullPathString_Cached(SYSTEM_NAMESPACE_PATH + "." + PrimitiveClassNames.Int32, this.scope.codePieceIndex);
                    if(firstOperandType === doubleType || secondOperandType === doubleType) {
                      this.pushRegularOperandType(doubleType);
                    }
                    else {
                      // TODO: other number types
                      this.pushRegularOperandType(int32Type);
                    }
                  }
                }
                return true;
            }
            iterateParseTreeNodeChildren(node, callback);
            assertTrue(operator === "");
      }

      private compileMultiplicativeExpression(node : MultiplicativeExprContext) : void {
        let operator : string = "";
            const callback = (childNode : ParseTree, index : number) : boolean => {
                if (index === 0) {
                  this.compileBaseValue(childNode as BaseValueContext);
                }
                else if (index % 2 === 1) {
                  operator = childNode.toString();
                }
                else {
                  this.compileBaseValue(childNode as BaseValueContext);
                  switch(operator) {
                      case "*":
                        this.addInstructionAtEnd(CILOperationCodes.mul, []);
                        break;
                      case "/":
                        this.addInstructionAtEnd(CILOperationCodes.div, []);
                        break;
                      case "%":
                        this.addInstructionAtEnd(CILOperationCodes.rem, []);
                        break;
                      default:
                        assertNotReachHere();
                  }
                  operator = "";
                  const secondOperandType = this.popRegularOperand();
                  const firstOperandType = this.popRegularOperand();
                  const doubleType = getCurrentProgram().getClassMetadataByFullPathString_Cached(SYSTEM_NAMESPACE_PATH + "." + PrimitiveClassNames.Double, this.scope.codePieceIndex)
                  const int32Type = getCurrentProgram().getClassMetadataByFullPathString_Cached(SYSTEM_NAMESPACE_PATH + "." + PrimitiveClassNames.Int32, this.scope.codePieceIndex);
                  if(firstOperandType === doubleType || secondOperandType === doubleType) {
                    this.pushRegularOperandType(doubleType);
                  }
                  else {
                    // TODO: other number types
                    this.pushRegularOperandType(int32Type);
                  }
                }
                return true;
            }
            iterateParseTreeNodeChildren(node, callback);
            assertTrue(operator === "");
      }

      private compileParentheseExpression(node : ParentheseExpressionContext) : void {
        const expressionNode = assertNonNullOrUndefined(node.children)[1];
        this.compileExpression(expressionNode);
      }

      private lookupIdentifier(name : string) : any {
        let nameBindingResult : any = null;
        // First lookup the given name in code block stack
        nameBindingResult = this.lookupIdentifierInCodeBlockStack(name);
        if(nameBindingResult !== null) {
          return nameBindingResult;
        }
        // Then lookup the given name in a wider range (class scope, etc)
        try {
          try {
            nameBindingResult = this.scope.lookupValueByNameAndType(name, undefined)
          }
          catch (e : any) {
            assertTrue(e instanceof NameBindingError);
            nameBindingResult = getCurrentProgram().getClassWithUsingsInCodePiece(name, this.scope.codePieceIndex);
          }
        }
        catch (e : any){
          assertTrue(e instanceof CSRuleError);
          assertTrue(e.errorID === "0246");
          throw new CSRuleError("0103", [name], this.scope.codePieceIndex);
        }
        return nameBindingResult;
      }

      private lookupIdentifierInCodeBlockStack(name : string) : CompileTimeVariable | null {
        let result : CompileTimeVariable | null = null;
        const callback = (codeBlock : CompileTimeCodeBlockScope) : boolean => {
          result = codeBlock.getVariable(name)
          if(result !== null) {
            return false;
          }
          return true;
        }
        this.codeBlockStack.iterate(callback, true);
        return result;
      }

      private compileStatement(node : StatementContext) : void {
        const childNode = assertNonNullOrUndefined(node.children)[0];
        if(childNode instanceof EvaluationChainContext) {
          this.compileEvaluationChain(childNode);
        }
        else if(childNode instanceof AssignmentContext) {
          this.compileAssignment(childNode);
        }
        else {
          logWarn("Unknown child node " + childNode.toString() + " (" + childNode.constructor.name + ")");
        }
        // TODO: other child types
      }

      private compileEvaluationChain(node : EvaluationChainContext) : void {
        const callback = (childNode : ParseTree, index : number) : boolean => {
          if(childNode instanceof ObjectReferenceIdentifierContext) {
            this.compileObjectReferenceIdentifierInEvaluationChain(childNode, index === 0);
          }
          else if(childNode instanceof MethodCallContext) {
            this.compileMethodCall(childNode);
          }
          else if (childNode instanceof StringContext) {
            this.compileStringLiteral(childNode);
          }
          else if (childNode instanceof NewObjectContext) {
            this.compileNewObject(childNode);
          }
          else if (childNode instanceof FieldOrPropertyAccessContext) {
            this.compileFieldOrPropertyAccess(childNode);
          }
          else {
            logWarn("Unknown child node " + childNode.toString() + " (" + childNode.constructor.name + ")");
          }
          // TODO: other child types
          return true;
        }
        iterateParseTreeNodeChildren(node, callback);
      }

      private compileObjectReferenceIdentifierInEvaluationChain(node : ObjectReferenceIdentifierContext, isAtTheBeginningOfEvaluationChain : boolean) : void {
        let identifierName : string = getDataFromTerminalNodeChild(node);
        let isBaseCall = false;
        if(identifierName === "null") {
          if(isAtTheBeginningOfEvaluationChain) {
            this.addInstructionAtEnd(CILOperationCodes.ldnull, []);
            this.operandTypeStack.push(new NullReferenceOperandType());
            return;
          }
          else {
            //TODO: here may need an error report?
          }
        }
        else if (identifierName === "this") {
          if(this.isStatic) {
            throw new CSRuleError("0026", [], this.scope.codePieceIndex);
          }
        }
        else if (identifierName === "base") {
          isBaseCall = true;
          identifierName = "this";
        }
        // TODO: lookup for reference identifier
        const nameBindingResult = this.lookupIdentifier(identifierName);
        if(nameBindingResult instanceof ClassMetadata) {
          if(isAtTheBeginningOfEvaluationChain) {
            this.operandTypeStack.push(new StaticMethodCallOperandType(nameBindingResult));
          }
          else {
            //todo: error reporting
          }
          
        }
        else if (nameBindingResult instanceof CompileTimeVariable){
          this.compileLoadCompileTimeVariable(nameBindingResult);
        }
        else {
          assertNotReachHere();
        }
        if(isBaseCall) {
          this.operandTypeStack.push(new BaseMethodCallOperandType());
        }
        
      }

      private compileParameterList(parameterListNode : ParameterListContext) : ClassMetadata[] {
        let parameterCount = 0;
        const iterateParameterList = (childNode : ParseTree, index : number) : boolean => {
          if(childNode instanceof ExpressionContext) {
            this.compileExpression(childNode);
            parameterCount++;
          }
          return true;
        }
        iterateParseTreeNodeChildren(parameterListNode, iterateParameterList);
        const argumentTypes : ClassMetadata[] = [];
        for(let i = 0; i < parameterCount; i++) {
          const argumentType = this.popRegularOperand();
          argumentTypes.splice(0, 0, argumentType);
        }
        return argumentTypes;
      }

      private compileMethodCall(node : MethodCallContext) : void {
        const parameterListNode = getChildNodeByTypeAssertExistsChild(node, ParameterListContext) as ParameterListContext;
        const argumentTypes = this.compileParameterList(parameterListNode);
        const methodName = searchDataFromSingleChildNode(node, MethodNameContext);
        const typeStackTop = this.operandTypeStack.peek();
        const METHOD_CALL_TYPE_STATIC = 0;
        const METHOD_CALL_TYPE_BASE = 1;
        const METHOD_CALL_TYPE_VIRTUAL = 2;
        const methodCallType : number = typeStackTop.type === EnumOperandType.StaticMethodCall ? METHOD_CALL_TYPE_STATIC : typeStackTop.type === EnumOperandType.BaseMethodCall ? METHOD_CALL_TYPE_BASE : typeStackTop.type === EnumOperandType.Regular ? METHOD_CALL_TYPE_VIRTUAL : assertNotReachHere() as any;
        if(methodCallType === METHOD_CALL_TYPE_STATIC || methodCallType === METHOD_CALL_TYPE_BASE) {
          this.operandTypeStack.pop();
        }
        let methodMetadata : ImplementedMethodMetadata | null = null;
        const classMetadata = methodCallType === METHOD_CALL_TYPE_STATIC ? (typeStackTop as StaticMethodCallOperandType).fromClass as ClassMetadata : methodCallType === METHOD_CALL_TYPE_BASE ? assertNonNullOrUndefined(this.getOwnerClass().baseClassSpecifier.matchedClass) as ClassMetadata : this.popRegularOperand();
        if(methodCallType === METHOD_CALL_TYPE_STATIC) {
          const testWhetherTheGivenNameIsNotAMethod = classMetadata.getBindingByNameLocally(methodName);
          if(testWhetherTheGivenNameIsNotAMethod !== null) {
            if(!(testWhetherTheGivenNameIsNotAMethod.value instanceof MethodMetadata)){
              throw new CSRuleError("1955", [classMetadata.name + "." + methodName], this.scope.codePieceIndex);
            } //TODO: class fields are not in the name binding of the class metadata
            assertNotReachHere(); // A name binding's value is still a method even though the name of the binding (method signature) doesn't contain any parenthese? That's impossible.
          }
        }
        else {
          //todo: instance method call check
        }
        methodMetadata = classMetadata.findBestOverloadedMethod(methodName, argumentTypes, methodCallType === METHOD_CALL_TYPE_STATIC, this.scope.codePieceIndex);
        const returnType = assertNonNullOrUndefined(methodMetadata.returnType)
        const isVoidReturnType = returnType instanceof MethodReturnTypeVoid
        // In real CIL instruction arguments for "callvirt", the class path before "::HereIsVirtualMethodName(...)" should be the path to the class where the instance method is initially defined (for example, calling ToString() on ANY object will lead to a CIL argument of System.Object::ToString() since ToString() is initially defined in System.Object, no matter whether the class of the object instance overrides ToString() or not)
        // But currently in the interpreter, the class path in "callvirt" instruction is used for locating a sample MethodMetadata for getting the number of arguments in the method.
        // Since a series of overriding methods all have the same method signature and number of arguments, the virtual machine can get the correct number of argument with the MethodMetadata of any overriding method in the series.
        // As a result, in this interpreter, unlike real CIL, there's no need to force classFullPath to be the class path of the class where the method is initially defined, instead, classFullPath here is the path of the compile-time type for the object where the instance method is called.
        const classFullPath = classMetadata.fullPathToString_Class();
        const operationCode = methodCallType === METHOD_CALL_TYPE_VIRTUAL ? CILOperationCodes.callvirt : CILOperationCodes.call;
        this.addInstructionAtEnd(operationCode, [methodCallType === METHOD_CALL_TYPE_STATIC ? "class" : "instance", isVoidReturnType ? "void" : returnType.type.toString(), classFullPath + "::" + assertNonNullOrUndefined(methodMetadata.methodSignature).toString()]);
        if(!isVoidReturnType) {
          this.pushRegularOperandType(assertNonNullOrUndefined(methodMetadata?.returnType?.type?.matchedClass));
        }
      }

      private compileLocalVariableDefinition(node : LocalVariableDefinitionContext) : void {
        const name = getDataFromTerminalNodeChild(getChildNodeByTypeAssertExistsChild(node, LocalVariableNameContext));
        if(this.codeBlockStack.peek().getVariable(name) !== null) {
          throw new CSRuleError("0128", [name], this.scope.codePieceIndex);
        }
        if(this.lookupIdentifierInCodeBlockStack(name) !== null) {
          throw new CSRuleError("0136", [name], this.scope.codePieceIndex);
        }
        const typeSpecifierNode = getChildNodeByTypeAssertExistsChild(getChildNodeByTypeAssertExistsChild(node, LocalVariableTypeContext), TypeSpecifierContext) as TypeSpecifierContext;
        const typeSpecifier : TypeSpecifier = new TypeSpecifier(this.scope);
        typeSpecifier.fromParseTree(typeSpecifierNode);
        typeSpecifier.matchClass();
        const type : ClassMetadata = assertNonNullOrUndefined(typeSpecifier.matchedClass);
        const variable = new CompileTimeVariable(name, type, EnumCompileTimeVariablePlace.Local, this.localIndexCounter);
        this.localIndexCounter++;
        const currentCodeBlock = this.codeBlockStack.peek();
        currentCodeBlock.addNewVariable(variable);
        assertTrue(this.result.locals[variable.cilIndex] === undefined);
        this.result.locals[variable.cilIndex] = new CILLocal(type, name);

        const hasAssignmentAfterDefinition = assertNonNullOrUndefined(node.children).length > 2;
        if(hasAssignmentAfterDefinition) {
          assertTrue(assertNonNullOrUndefined(node.children)[2].getText() === "=");
          const childNode = assertNonNullOrUndefined(node.children)[3];
          if(childNode instanceof ExpressionContext) {
            this.compileExpression(childNode);
            // TODO : assignment type checking
            this.addInstructionAtEnd(CILOperationCodes.stloc, [variable.cilIndex.toString()]);
          }
          // TODO : arrayInitializer
        }
      }

      private compileVariableIdentifier(node : VariableIdentifierContext) : void {
        const name = getDataFromTerminalNodeChild(node);
        const variable = this.lookupIdentifier(name);
        if(!(variable instanceof CompileTimeVariable)) {
          // TODO : error reporting
          throw new CSRuleError("-1", ["MethodBodyCompiler.compileVariableIdentifier"], this.scope.codePieceIndex);
        }
        this.pushRegularOperandType(variable.variableType);
        const operationCode = variable.variablePlace === EnumCompileTimeVariablePlace.Argument ? CILOperationCodes.ldarg : CILOperationCodes.ldloc;
        this.addInstructionAtEnd(operationCode, [variable.cilIndex.toString()]);
      }

      private compileStringLiteral(node : StringContext) : void {
        const str = removeLastCharacter(removeFirstCharacter(getDataFromTerminalNodeChild(node)));
        this.operandTypeStack.push(new RegularOperandType(getCurrentProgram().getClassMetadataByFullPathString_Cached(SYSTEM_NAMESPACE_PATH + "." + primitiveTypeToInternalTypeName("string"), this.scope.codePieceIndex)));
        this.addInstructionAtEnd(CILOperationCodes.ldstr, [str]);
      }

      private compileNewObject(node : NewObjectContext) : void {
        const typeIdentifierNode = getChildNodeByTypeAssertExistsChild(node, TypeIdentifierContext) as TypeIdentifierContext;
        const typeSpecifier : TypeSpecifier = new TypeSpecifier(this.scope);
        typeSpecifier.fromParseTree_TypeIdentifierNode(typeIdentifierNode);
        typeSpecifier.matchClass();
        const classOfNewObject = assertNonNullOrUndefined(typeSpecifier.matchedClass) as ClassMetadata;
        const argumentTypes = this.compileParameterList(getChildNodeByTypeAssertExistsChild(node, ParameterListContext) as ParameterListContext);
        const constructorMethodMetadata = classOfNewObject.findBestOverloadedMethod(CONSTRUCTOR_METHOD_NAME, argumentTypes, false, this.scope.codePieceIndex);
        assertTrue(constructorMethodMetadata.returnType === null);
        this.addInstructionAtEnd(CILOperationCodes.newobj, ["instance", "void", classOfNewObject.fullPathToString_Class() + "::" + assertNonNullOrUndefined(constructorMethodMetadata.methodSignature).toString()]);
        this.pushRegularOperandType(classOfNewObject);
      }

      private compileAssignment(node : AssignmentContext) : void {
        // todo: object property assignment
        const operandNode = assertNonNullOrUndefined(node.children)[0];
        const expressionNode = assertNonNullOrUndefined(node.children)[2];
        assertTrue(operandNode instanceof OperandContext);
        assertTrue(expressionNode instanceof ExpressionContext);
        this.compileOperand(operandNode);
        let assignmentOperationCode : CILOperationCodes = CILOperationCodes.nop;
        const previousInstruction = this.getInstructionAtEnd();
        // convert the different kinds of load instructions after compiling operand into the corresponding store instructions
        switch(previousInstruction.operationCode){
          case CILOperationCodes.ldloc:
            assignmentOperationCode = CILOperationCodes.stloc;
            break;
          case CILOperationCodes.ldarg:
            assignmentOperationCode = CILOperationCodes.starg;
            break;
          case CILOperationCodes.ldfld:
            assignmentOperationCode = CILOperationCodes.stfld;
            break;
          default:
            assertNotReachHere();
        }
        this.removeInstructionAtEnd(); // remove the load instruction (because assignment needs a store instruction instead of a load instruction)
        this.operandTypeStack.pop();
        this.compileExpression(expressionNode);
        this.addInstructionAtEnd(assignmentOperationCode, previousInstruction.instructionArguments as string[]);
      }

      private compileFieldOrPropertyAccess(node : FieldOrPropertyAccessContext) : void {
        const name = getDataFromTerminalNodeChild(getChildNodeByTypeAssertExistsChild(node, FieldOrPropertyNameContext));
        const fromClass = this.popRegularOperand();
        let field : FieldMetadata | null = null;
        const fieldCount = fromClass.fields.length;
        for(let i = 0; i < fieldCount; i++) {
          if(fromClass.fields[i].fieldName === name) {
            field = fromClass.fields[i];
            break;
          }
        }
        if(field !== null) {
          const fieldType : ClassMetadata = assertNonNullOrUndefined(field.fieldType.matchedClass);
          const fieldCILPath = fromClass.fullPathToString_Class() + "::" + field.fieldName;
          this.addInstructionAtEnd(CILOperationCodes.ldfld, ["class", fieldType.fullPathToString_Class(), fieldCILPath]);
          this.pushRegularOperandType(fieldType);
        }
        else {
          // TODO: property access
          // TODO: error reporting
          throw new CSRuleError("-1", ["MethodBodyCompiler.compileFieldOrPropertyAccess"], this.scope.codePieceIndex);
        }
      }

      private compileLoadCompileTimeVariable(compileTimeVariable : CompileTimeVariable) : void {
        const operationCode = compileTimeVariable.variablePlace === EnumCompileTimeVariablePlace.Argument ? CILOperationCodes.ldarg : CILOperationCodes.ldloc;
        this.pushRegularOperandType(compileTimeVariable.variableType);
        this.addInstructionAtEnd(operationCode, [compileTimeVariable.cilIndex.toString()]);
      }

      private compileBaseConstructorCall() : void {
        const node = assertNonNullOrUndefined(this.baseConstructorCallNode);
        const parameterListNode = getChildNodeByTypeAssertExistsChild(node, ParameterListContext) as ParameterListContext;
        this.compileLoadCompileTimeVariable(this.lookupIdentifier("this") as CompileTimeVariable); // load the "this" argument for calling the base constructor
        const argumentTypes = this.compileParameterList(parameterListNode);
        const baseClass = assertNonNullOrUndefined(this.getOwnerClass().baseClassSpecifier.matchedClass) as ClassMetadata;
        const constructorMethodMetadata = baseClass.findBestOverloadedMethod(CONSTRUCTOR_METHOD_NAME, argumentTypes, false, this.scope.codePieceIndex);
        assertTrue(constructorMethodMetadata.returnType === null);
        const classFullPath = baseClass.fullPathToString_Class();
        this.addInstructionAtEnd(CILOperationCodes.call, ["instance", "void", classFullPath + "::" + assertNonNullOrUndefined(constructorMethodMetadata.methodSignature).toString()]);
      }



      private addInstructionAtEnd(operationCode : CILOperationCodes, instructionArguments : string[]) {
        this.result.addInstruction(this.cilAddressCounter, operationCode, instructionArguments);
        this.cilAddressCounter++;
      }

      private getInstructionAtEnd() : CILInstruction {
        assertTrue(this.cilAddressCounter > 0);
        return this.result.instructionList[this.cilAddressCounter - 1];
      }

      private addInstructionAtAddress(operationCode : CILOperationCodes, instructionArguments : string[], address : number) : void {
        const instruction = new CILInstruction(operationCode, instructionArguments);
        if(this.result.instructionList[address] === undefined) {
          this.result.instructionList[address] = instruction;
          return;
        }
        this.result.instructionList.splice(address, 0, instruction);
        this.cilAddressCounter++;
      }

      private removeInstructionAtEnd() : void {
        assertTrue(this.cilAddressCounter > 0);
        this.cilAddressCounter--;
        (this.result.instructionList[this.cilAddressCounter] as any) = undefined;
      }

      private pushRegularOperandType(classMetadata : ClassMetadata) : void {
        this.operandTypeStack.push(new RegularOperandType(classMetadata));
      }

      private popRegularOperand() : ClassMetadata {
        const result = this.operandTypeStack.pop();
        // TODO: for now, if the popped operand type is a null reference, the assert will fail here.
        assertTrue(result.type === EnumOperandType.Regular);
        return (result as RegularOperandType).classMetadata;
      }

      private getOwnerClass() : ClassMetadata {
        // TODO: for now, I don't consider the local function feature of C#, so the parent scope of the method should be its owner class
        return this.scope.parent as ClassMetadata;
      }
}

enum EnumOperandType {
  Regular,
  StaticMethodCall,
  BaseMethodCall,
  NullReference,
}

abstract class OperandType {
  readonly type : EnumOperandType;
  constructor(type : EnumOperandType) {
    this.type = type;
  }
}

class RegularOperandType extends OperandType {
  readonly classMetadata : ClassMetadata;
  constructor(classMetadata : ClassMetadata) {
    super(EnumOperandType.Regular);
    this.classMetadata = classMetadata;
  }
}

class StaticMethodCallOperandType extends OperandType {
  readonly fromClass : ClassMetadata;
  constructor(fromClass : ClassMetadata) {
    super(EnumOperandType.StaticMethodCall);
    this.fromClass = fromClass;
  }
}

class BaseMethodCallOperandType extends OperandType {
  constructor() {
    super(EnumOperandType.BaseMethodCall);
  }
}

class NullReferenceOperandType extends OperandType {
  constructor() {
    super(EnumOperandType.NullReference);
  }
}

class CompileTimeCodeBlockScope {
  private variables : Record<string, CompileTimeVariable>;
  
  constructor() {
    this.variables = {}
  }

  addNewVariable(variable : CompileTimeVariable) : void {
    const name = variable.name;
    assertTrue(this.getVariable(name) === null);
    this.variables[name] = variable;
  }

  getVariable(name : string) : CompileTimeVariable | null {
    const result = this.variables[name];
    return result !== undefined ? result : null;
  }
}

class CompileTimeVariable {
  readonly name : string;
  readonly variableType : ClassMetadata;
  readonly variablePlace : EnumCompileTimeVariablePlace;
  readonly cilIndex : number;
  
  constructor(name : string, variableType : ClassMetadata, variablePlace : EnumCompileTimeVariablePlace, cilIndex : number) {
    this.name = name;
    this.variableType = variableType;
    this.variablePlace = variablePlace;
    this.cilIndex = cilIndex;
  }
}

enum EnumCompileTimeVariablePlace {
  Argument,
  Local,
}



export { MethodBodyCompiler };