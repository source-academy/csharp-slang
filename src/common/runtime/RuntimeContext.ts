import { EvaluationStack } from './EvaluationStack'
import { CallStack } from './CallStack'
import { CallStackFrame } from './CallStackFrame'
import { ObjectHeap, RuntimeObjectAddress, checkForNullReference } from './heap/ObjectHeap'
import { CILMethodBody } from '../cil/CILMethodBody'
import { CILInstruction, type CILInstructionAddress } from '../cil/CILInstruction'
import { CILOperationCodes } from '../cil/CILOperationCodes'
import { assertNonNullOrUndefined, assertNotReachHere, assertTrue } from '../../util/Assertion'
import { CSRuntimeError, RuntimeCILError } from '../CSInterpreterError'
import { log, logVerbose, logWarn } from '../../util/Logger'
import { getCurrentProgram } from '../Main'
import { ExternalMethodMetadata, ImplementedMethodMetadata, MethodMetadata, MethodSignature } from '../compileTime/metadata/MethodMetadata'
import { ExternalLibraryStorage } from './ExternalLibraryStorage'
import { bytesToInt32LittleEndian, int32ToBytesLittleEndian } from '../../util/BinaryUtil'
import { int32BinaryOperation } from './heap/PrimitiveValueHandler'
import { INSTRUCTIONS_PER_AUTO_GC, MAXIMUM_CALL_STACK_SIZE } from '../Constants'
import { NULL_POINTER } from './heap/MemoryHeap'

const INTERNAL_CALL_STACK_FRAME_NAME = "<internal>";

type RuntimeOperand = RuntimeObjectAddress;

class RuntimeContext {
  private readonly evaluationStack: EvaluationStack
  private readonly callStack: CallStack
  private readonly heap: ObjectHeap
  private currentCallStackFrame: CallStackFrame
  private programCounter: CILInstructionAddress
  private externalLibraryStorage : ExternalLibraryStorage;
  private standardOutput : string;
  private isRunning : boolean;
  private autoGC_Counter : number;

  /**
   * The constructor for the `RuntimeContext` class.
   */
  constructor () {
    this.evaluationStack = new EvaluationStack()
    this.callStack = new CallStack()
    this.heap = new ObjectHeap()
    this.externalLibraryStorage = new ExternalLibraryStorage();
    this.isRunning = false;
  }

  private callMethod (methodBody: CILMethodBody, frameName : string, argumentArray : RuntimeOperand[]): void {
    if(this.callStack.elementCount() === MAXIMUM_CALL_STACK_SIZE) {
      throw new CSRuntimeError("Operation caused a stack overflow. (Current maximum call stack size is " + MAXIMUM_CALL_STACK_SIZE + ")");
    }
    assertTrue(this.currentCallStackFrame !== undefined || frameName === INTERNAL_CALL_STACK_FRAME_NAME)
    if(this.currentCallStackFrame !== undefined) {
      this.currentCallStackFrame.savedProgramCounter = this.programCounter
    }
    const newCallStackFrame = new CallStackFrame(methodBody, frameName, argumentArray)
    this.callStack.push(newCallStackFrame)
    this.currentCallStackFrame = newCallStackFrame
    this.programCounter = -1
  }

  private popCallStackFrame() : void {
    // TODO : handle return values
    this.callStack.pop();
    if(this.callStack.isEmpty()) {
      this.isRunning = false;
    }
    else {
      this.currentCallStackFrame = this.callStack.peek();
      this.programCounter = this.currentCallStackFrame.savedProgramCounter;
    }
  }

  private pushInitialInternalCallStackFrame (): void {
    assertTrue(this.callStack.isEmpty())
    const internalCallMethodBody = new CILMethodBody()
    internalCallMethodBody.initializeAsEmpty()
    const mainMethodPath = "MainNamespace.MainClass::Main()";
    internalCallMethodBody.addInstruction(0, CILOperationCodes.call, ["class", "void", mainMethodPath]);
    this.callMethod(internalCallMethodBody, INTERNAL_CALL_STACK_FRAME_NAME, []);
  }

  // [DEVELOPMENT ONLY CODE]
  /**
   * A development-only method that is used to test parsing raw CIL strings.
   * **DEVELOPMENT-ONLY METHOD, SHOULD BE REMOVED IN PRODUCTION**
   *
   * @param str The raw CIL string used for testing.
   */
  development_parseRawCILString (str: string): CILMethodBody {
    const tmp = new CILMethodBody()
    tmp.parseFromRawCILString(str)
    return tmp
  }

  /**
   * A development-only method that is used to test parsing and running raw CIL strings.
   * **DEVELOPMENT-ONLY METHOD, SHOULD BE REMOVED IN PRODUCTION**
   *
   * @param str The raw CIL string used for testing.
   */
  development_parseAndRunCILString (str: string): RuntimeContext {
    this.evaluationStack.clear()
    this.callStack.clear()
    this.pushInitialInternalCallStackFrame()
    const tmp = new CILMethodBody()
    tmp.parseFromRawCILString(str)
    this.callMethod(tmp, "frame" ,[])
    while (this.currentCallStackFrame.getNextInstructionAndAddress(this.programCounter).instruction !== null) {
      this.executeSingleInstruction()
    }
    if (!this.evaluationStack.isEmpty()) {
      logWarn('There is/are operand(s) left in the evaluation stack.')
    }
    return this
  }
  // [DEVELOPMENT ONLY CODE] End

  private pushOperand (operand: RuntimeOperand) : void {
    logVerbose("[RuntimeContext] Push operand: " + operand);
    this.evaluationStack.push(operand);
  }

  private popOperand (): RuntimeOperand {
    if (this.evaluationStack.isEmpty()) {
      throw new RuntimeCILError('Trying to pop an operand from an empty evaluation stack')
    }
    const result = this.evaluationStack.pop();
    logVerbose("[RuntimeContext] Pop operand: " + result);
    return result;
  }

  /**
   * Executes the next single CIL instruction from the current call stack frame.
   */
  executeSingleInstruction (): void {
    assertNonNullOrUndefined(this.currentCallStackFrame)
    const nextInstructionAndAddress = this.currentCallStackFrame.getNextInstructionAndAddress(this.programCounter)
    this.programCounter = nextInstructionAndAddress.address
    const instruction = assertNonNullOrUndefined(nextInstructionAndAddress.instruction) as CILInstruction
    const operationCode = instruction.operationCode
    log('%c Execute CIL instruction: ' + operationCode + " " + instruction.instructionArguments.join(" ") +' (at ' + this.currentCallStackFrame.name + ' : <0x' + (nextInstructionAndAddress.address).toString(16) + '>)', "background: #b3e6ff")
    switch (operationCode) {
      case CILOperationCodes.nop:
        break
      case CILOperationCodes.ldc_i4_s:
      case CILOperationCodes.ldc_i4: // todo: Currently I just directly treat 'ldc.i4.s' and 'ldc.i4' as the same operation code
        {
          const int32Value = parseInt(instruction.instructionArguments[0])
          assertTrue(Number.isSafeInteger(int32Value))
          this.pushOperand(this.heap.createPrimitiveObject("int", int32Value))
        }
        break
      case CILOperationCodes.ldloc_s:
      case CILOperationCodes.ldloc:
        {
          const localIndex = parseInt(instruction.instructionArguments[0])
          assertTrue(!Number.isNaN(localIndex))
          this.pushOperand(this.currentCallStackFrame.getRuntimeLocalValue(localIndex))
        }
        break
      case CILOperationCodes.stloc_s:
      case CILOperationCodes.stloc:
        {
          const localIndex = parseInt(instruction.instructionArguments[0])
          assertTrue(!Number.isNaN(localIndex))
          const newValue = this.popOperand()
          this.currentCallStackFrame.setRuntimeLocalValue(localIndex, newValue)
        }
        break
      // todo: For now I just support numbers. Need to support operator overriding on objects.
      case CILOperationCodes.add:
      case CILOperationCodes.sub:
      case CILOperationCodes.mul:
      case CILOperationCodes.div:
      case CILOperationCodes.rem:
        {
          const number2 = this.heap.readPrimitiveObject(this.popOperand())
          const number1 = this.heap.readPrimitiveObject(this.popOperand())
          // TODO : different number types
          const binaryOperation = operationCode === CILOperationCodes.add
                        ? (left : number, right : number) : number => left + right
                        : operationCode === CILOperationCodes.sub
                        ? (left : number, right : number) : number => left - right
                        : operationCode === CILOperationCodes.mul
                        ? (left : number, right : number) : number => left * right
                        : operationCode === CILOperationCodes.div
                        ? (left : number, right : number) : number => Math.floor(left / right)
                        : operationCode === CILOperationCodes.rem
                        ? (left : number, right : number) : number => left % right
                        : (left : number, right : number) : number => { throw new RuntimeCILError("Unknown binary operation"); };
          const result = int32BinaryOperation(number1, number2, binaryOperation);
          this.pushOperand(this.heap.createObjectFromBinary(result))
        }
        break
      case CILOperationCodes.ldstr:
        {
          const str = instruction.instructionArguments[0];
          this.pushOperand(this.heap.createPrimitiveObject("string", str));
        }
        break
      case CILOperationCodes.ldarg:
          {
            const argumentIndex = parseInt(instruction.instructionArguments[0])
            assertTrue(!Number.isNaN(argumentIndex))
            this.pushOperand(this.currentCallStackFrame.getArgumentValue(argumentIndex))
          }
          break
      case CILOperationCodes.starg:
        {
          const argumentIndex = parseInt(instruction.instructionArguments[0])
          assertTrue(!Number.isNaN(argumentIndex))
          const newValue = this.popOperand()
          this.currentCallStackFrame.setArgumentValue(argumentIndex, newValue)
        }
        break
      case CILOperationCodes.newobj:
        {
          const constructorMethodPath = instruction.instructionArguments[2]
          const [classPath, constructorMethodSignature] = constructorMethodPath.split("::");
          const classMetadata = getCurrentProgram().getClassMetadataByCILTypePath(classPath);
          const newObjectAddress = this.heap.createNewObjectInstance(classMetadata);

          // The constructor can be treated as a special kind of method: it can not be overriden (like a static call), but its first argument is the "this" pointer (like an instance call)
          const methodMetadataBinding = classMetadata.getBindingByNameLocally(constructorMethodSignature);
          if(methodMetadataBinding === null) {
            throw new RuntimeCILError("newobj: unable to find method with method signature [" + constructorMethodSignature + "] in class [" + classPath + "]");
          }
          const methodMetadata = methodMetadataBinding.value;
          const parameterCount = assertNonNullOrUndefined(methodMetadata.methodSignature).parameterList.length;
          const argumentArray : RuntimeOperand[] = [];
          for(let i = 0; i < parameterCount; i++) {
            const arg = this.popOperand();
            argumentArray.splice(0, 0, arg);
          }
          argumentArray.splice(0, 0, newObjectAddress);
          this.callMethod(methodMetadata.methodBody, constructorMethodSignature, argumentArray);
          this.pushOperand(newObjectAddress);
        }
        break
      case CILOperationCodes.call:
        {
          // if call type is "instance", then this call should be a base call
          const [callType, returnType, methodPath] = instruction.instructionArguments;
          const [classPath, methodSignature] = methodPath.split("::");
          const classMetadata = getCurrentProgram().getClassMetadataByCILTypePath(classPath);
          const methodMetadataBinding = classMetadata.getBindingByNameLocally(methodSignature);
          if(methodMetadataBinding === null) {
            throw new RuntimeCILError("call (class/base): Unable to find method with method signature [" + methodSignature + "] in class [" + classPath + "]");
          }
          const methodMetadata = methodMetadataBinding.value;
          if(callType === "class") {
            // static call
            if(methodMetadata instanceof ImplementedMethodMetadata) {
              const parameterCount = assertNonNullOrUndefined(methodMetadata.methodSignature).parameterList.length;
              const argumentArray : RuntimeOperand[] = [];
              for(let i = 0; i < parameterCount; i++) {
                const arg = this.popOperand();
                argumentArray.splice(0, 0, arg);
              }
              if(methodMetadata instanceof ExternalMethodMetadata) {
                const libraryName = methodMetadata.libraryName;
                const externalFunction = this.externalLibraryStorage.getFunction(libraryName, methodSignature);
                const returnValue = externalFunction(argumentArray);
                if(returnValue !== undefined) {
                  this.pushOperand(returnValue);
                }
              }
              else {
                this.callMethod(methodMetadata.methodBody, methodSignature, argumentArray);
              }
            }
            else {
              // TODO : throw error
              throw new RuntimeCILError("Trying to call something that is not a valid ImplementedMethodMetadata.");
            }
          }
          else {
            // base call
            if(!(methodMetadata instanceof ImplementedMethodMetadata)) {
              throw new RuntimeCILError("Trying to call something that is not a valid ImplementedMethodMetadata.");
            }
            const parameterCount = assertNonNullOrUndefined(methodMetadata.methodSignature).parameterList.length;
            const argumentArray : RuntimeOperand[] = [];
            for(let i = 0; i < parameterCount + 1; i++) { // parameterCount "+ 1" for the "this" argument of the base (instance) call.
              const arg = this.popOperand();
              argumentArray.splice(0, 0, arg);
            }
            assertTrue(argumentArray[0] !== NULL_POINTER);
            this.callMethod(methodMetadata.methodBody, methodSignature, argumentArray);
          }
          
        }
        break;
      case CILOperationCodes.callvirt:
        {
          const [callType, returnType, methodPath] = instruction.instructionArguments;
          assertTrue(callType === "instance");
          const [compileTimeTypeClassPath, methodSignature] = methodPath.split("::");
          const compileTimeTypeClassMetadata = getCurrentProgram().getClassMetadataByCILTypePath(compileTimeTypeClassPath);
          const compileTimeMethodBinding = compileTimeTypeClassMetadata.getBindingByNameLocally(methodSignature);
          if(compileTimeMethodBinding === null) {
            throw new RuntimeCILError("call (virtual): Unable to find compile-time method with method signature [" + methodSignature + "] in class [" + compileTimeTypeClassPath + "]");
          }
          const numberOfArguments = (compileTimeMethodBinding.value as MethodMetadata).methodSignature?.parameterList.length as number;
          const argumentArray : RuntimeOperand[] = [];
          for(let i = 0; i < numberOfArguments; i++) {
            const arg = this.popOperand();
            argumentArray.splice(0, 0, arg);
          }
          const objectAddressOperand = this.popOperand();
          checkForNullReference(objectAddressOperand);
          argumentArray.splice(0, 0, objectAddressOperand);
          const objectAddress = objectAddressOperand;
          const runtimeTypeClassMetadataIndex = this.heap.getClassMetadataIndex(objectAddress);
          const runtimeTypeClassMetadata = getCurrentProgram().getClassMetadataByIndex(runtimeTypeClassMetadataIndex);
          const targetVirtualMethodBinding = runtimeTypeClassMetadata.getBindingByNameLocally(methodSignature);
          if(targetVirtualMethodBinding === null) {
            throw new RuntimeCILError("call (virtual): Unable to find runtime method with method signature [" + methodSignature + "] in class [" + runtimeTypeClassMetadata.fullPathToString_Class() + "]");
          }
          const targetVirtualMethod = targetVirtualMethodBinding.value;
          this.callMethod(targetVirtualMethod.methodBody, methodSignature, argumentArray);
        }
        break;
      case CILOperationCodes.ret:
        {
          this.popCallStackFrame();
        }
        break;
      case CILOperationCodes.ldfld:
        {
          const objectAddress = this.popOperand();
          checkForNullReference(objectAddress);
          const fieldName = instruction.instructionArguments[2].split("::")[1];
          const fieldValue = bytesToInt32LittleEndian(this.heap.readObjectField(objectAddress, fieldName));
          this.pushOperand(fieldValue);
        }
        break;
      case CILOperationCodes.stfld:
        {
          const fieldValue = int32ToBytesLittleEndian(this.popOperand());
          const objectAddress = this.popOperand();
          checkForNullReference(objectAddress);
          const fieldName = instruction.instructionArguments[2].split("::")[1];
          this.heap.writeObjectField(objectAddress, fieldName, fieldValue);
        }
        break;
      case CILOperationCodes.ldnull:
        {
          this.pushOperand(NULL_POINTER);
        }
        break;
      default:
        throw new RuntimeCILError('Unknown operation code: ' + operationCode)
    }
  }

  /**
   * Iterate every `CallStackFrame` in the call stack (from bottom to top).
   *
   * @param callbackFunction The callback function that the argument will be the `CallStackFrame` in the call stack that is iterated.
   */
  iterateCallStack (callbackFunction: (callStackFrame: CallStackFrame) => void): void {
    const callback = (frame : CallStackFrame) : boolean => {
      callbackFunction(frame);
      return true;
    }
    this.callStack.iterate(callback)
  }

  /**
   * Iterate every `RuntimeOperand` in the evaluation stack (from bottom to top).
   *
   * @param callbackFunction The callback function that the argument will be the `RuntimeOperand` in the evaluation stack that is iterated.
   */
  iterateEvaluationStack (callbackFunction: (runtimeOperand: RuntimeOperand) => void): void {
    const callback = (operand : RuntimeOperand) : boolean => {
      callbackFunction(operand);
      return true;
    }
    this.evaluationStack.iterate(callback)
  }

  /**
   * Collect the garbage in the heap, using Mark-and-Sweep algorithm.
   */
  collectGarbage (): void {
    this.heap.collectGarbage(this)
  }

  run () : void {
    assertTrue(!this.isRunning);
    log("Begin running the program");
    this.standardOutput = "";
    this.evaluationStack.clear()
    this.callStack.clear()
    this.pushInitialInternalCallStackFrame()
    this.autoGC_Counter = 0
    this.isRunning = true;

    while(this.isRunning){
      while (this.currentCallStackFrame.getNextInstructionAndAddress(this.programCounter).instruction !== null) {
        this.executeSingleInstruction()
        this.autoGC_Counter++
        if(this.autoGC_Counter === INSTRUCTIONS_PER_AUTO_GC) {
          this.autoGC_Counter = 0
          log("%c [GC] Run auto garbage collection", "background: #99ff99");
          this.collectGarbage();
        }
      }
      this.popCallStackFrame();
    }
    
    if (!this.evaluationStack.isEmpty()) {
      logWarn('There is/are operand(s) left in the evaluation stack.')
    }
    log("Program finished running")
    return;
  }

  writeToStandardOutput(content : string) : void {
    log("%c [STDOUT] " + content, "background: #ffd480");
    this.standardOutput += content;
  }

  getStandardOutput() : string {
    return this.standardOutput;
  }

  getHeap() : ObjectHeap {
    return this.heap;
  }
}

export { RuntimeContext, RuntimeOperand }
