import { EvaluationStack } from './EvaluationStack'
import { CallStack } from './CallStack'
import { CallStackFrame } from './CallStackFrame'
import { ObjectHeap } from './heap/ObjectHeap'
import { CILMethodBody } from '../cil/CILMethodBody'
import { type CILInstructionAddress } from '../cil/CILInstruction'
import { CILOperationCodes } from '../cil/CILOperationCodes'
import { assertNonNullOrUndefined, assertTrue } from '../../util/Assertion'
import { RuntimeCILError } from '../CSInterpreterError'
import { RuntimeOperand } from './RuntimeOperand'
import { log, logWarn } from '../../util/Logger'

class RuntimeContext {
  private readonly evaluationStack: EvaluationStack
  private readonly callStack: CallStack
  private readonly heap: ObjectHeap
  private currentCallStackFrame: CallStackFrame
  private programCounter: CILInstructionAddress

  /**
   * The constructor for the `RuntimeContext` class.
   */
  constructor () {
    this.evaluationStack = new EvaluationStack()
    this.callStack = new CallStack()
    this.heap = new ObjectHeap()
    this.pushInitialInternalCallStackFrame()
  }

  private callMethod (methodBody: CILMethodBody): void { // todo: add method arguments support
    assertNonNullOrUndefined(this.currentCallStackFrame)
    this.currentCallStackFrame.savedProgramCounter = this.programCounter
    const newCallStackFrame = new CallStackFrame(methodBody)
    this.callStack.push(newCallStackFrame)
    this.currentCallStackFrame = newCallStackFrame
    this.programCounter = -1
  }

  private pushInitialInternalCallStackFrame (): void {
    assertTrue(this.callStack.isEmpty())
    const internalCallMethodBody = new CILMethodBody()
    internalCallMethodBody.initializeAsEmpty()
    const internalCallStackFrame = new CallStackFrame(internalCallMethodBody)
    this.callStack.push(internalCallStackFrame)
    this.currentCallStackFrame = internalCallStackFrame
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
    this.callMethod(tmp)
    while (this.currentCallStackFrame.getNextInstructionAndAddress(this.programCounter).instruction !== null) {
      this.executeSingleInstruction()
    }
    if (!this.evaluationStack.isEmpty()) {
      logWarn('There is/are operand(s) left in the evaluation stack.')
    }
    return this
  }
  // [DEVELOPMENT ONLY CODE] End

  private pushOperand (operand: any, isReference: boolean = false): void {
    this.evaluationStack.push(new RuntimeOperand(operand, isReference))
  }

  private popOperand (): any {
    if (this.evaluationStack.isEmpty()) {
      throw new RuntimeCILError('Trying to pop an operand from an empty evaluation stack')
    }
    return this.evaluationStack.pop().val
  }

  /**
   * Executes the next single CIL instruction from the current call stack frame.
   */
  executeSingleInstruction (): void {
    assertNonNullOrUndefined(this.currentCallStackFrame)
    const nextInstructionAndAddress = this.currentCallStackFrame.getNextInstructionAndAddress(this.programCounter)
    this.programCounter = nextInstructionAndAddress.address
    const instruction = assertNonNullOrUndefined(nextInstructionAndAddress.instruction)
    const operationCode = instruction.operationCode
    log('Execute CIL instruction: ' + operationCode + ' (at 0x' + (nextInstructionAndAddress.address).toString(16) + ')')
    switch (operationCode) {
      case CILOperationCodes.nop:
        break
      case CILOperationCodes.ldc_i4_s:
      case CILOperationCodes.ldc_i4: // todo: Currently I just directly treat 'ldc.i4.s' and 'ldc.i4' as the same operation code
        {
          const int32Value = parseInt(instruction.instructionArguments[0])
          assertTrue(!Number.isNaN(int32Value))
          this.pushOperand(int32Value)
        }
        break
      case CILOperationCodes.ldloc_s:
        {
          const localIndex = parseInt(instruction.instructionArguments[0])
          assertTrue(!Number.isNaN(localIndex))
          this.pushOperand(this.currentCallStackFrame.getRuntimeLocalValue(localIndex))
        }
        break
      case CILOperationCodes.stloc_s:
        {
          const localIndex = parseInt(instruction.instructionArguments[0])
          assertTrue(!Number.isNaN(localIndex))
          const newValue = this.popOperand()
          this.currentCallStackFrame.setRuntimeLocalValue(localIndex, newValue)
        }
        break
      case CILOperationCodes.add: // todo: For now I just support adding numbers. Need to support operator overriding and adding objects.
        {
          const number1 = this.popOperand()
          const number2 = this.popOperand()
          assertTrue(typeof (number1) === 'number' && typeof (number2) === 'number')
          this.pushOperand(number1 + number2)
        }
        break
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
    this.callStack.iterate(callbackFunction)
  }

  /**
   * Iterate every `RuntimeOperand` in the evaluation stack (from bottom to top).
   *
   * @param callbackFunction The callback function that the argument will be the `RuntimeOperand` in the evaluation stack that is iterated.
   */
  iterateEvaluationStack (callbackFunction: (runtimeOperand: RuntimeOperand) => void): void {
    this.evaluationStack.iterate(callbackFunction)
  }

  /**
   * Collect the garbage in the heap, using Mark-and-Sweep algorithm.
   */
  collectGarbage (): void {
    this.heap.collectGarbage(this)
  }
}

export { RuntimeContext }
