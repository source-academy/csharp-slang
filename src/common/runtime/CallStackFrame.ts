import { type CILInstructionAddress } from '../cil/CILInstruction'
import { ArgumentLocal, RuntimeLocal } from './RuntimeLocal'
import { type CILMethodBody, type InstructionAddressPair } from '../cil/CILMethodBody'
import { assertTrue } from '../../util/Assertion'
import { RuntimeCILError } from '../CSInterpreterError'
import { RuntimeOperand } from './RuntimeContext'

/**
 * A class that represents a frame in the call stack.
 */
class CallStackFrame {
  // todo: add method arguments support
  /**
   * The saved program counter.
   */
  savedProgramCounter: CILInstructionAddress
  private readonly runtimeLocals: RuntimeLocal[]
  private readonly argumentLocals: ArgumentLocal[]
  private readonly methodBody: CILMethodBody
  readonly name : string

  /**
   * The constructor for the `CallStackFrame` class.
   *
   * @param methodBody The CIL method body for this `CallStackFrame`.
   * @param name The name of the frame
   * @param argumentArray The method arguments
   */
  constructor (methodBody: CILMethodBody, name : string, argumentArray : any[]) {
    assertTrue(methodBody.isInitialized())
    this.methodBody = methodBody
    this.savedProgramCounter = -1
    this.runtimeLocals = []
    const locals = methodBody.locals
    const localCount = locals.length
    for (let i = 0; i < localCount; i++) {
      const local = locals[i]
      this.runtimeLocals[i] = new RuntimeLocal(local)
    }
    this.name = name
    this.argumentLocals = []
    const argumentCount = argumentArray.length;
    for(let i = 0; i < argumentCount; i++) {
      this.argumentLocals[i] = new ArgumentLocal(argumentArray[i]);
    }
  }

  /**
   * Calls `this.methodBody.getNextInstructionAndAddress(startAddressExclusive)` and returns its value. Please refer to {@link CILMethodBody} for more information.
   *
   * @param startAddressExclusive Please refer to {@link CILMethodBody} for more information.
   * @returns Please refer to {@link CILMethodBody} for more information.
   */
  getNextInstructionAndAddress (startAddressExclusive: CILInstructionAddress): InstructionAddressPair {
    return this.methodBody.getNextInstructionAndAddress(startAddressExclusive)
  }

  private getRuntimeLocalByIndex (localIndex: number): RuntimeLocal {
    if (this.runtimeLocals[localIndex] === undefined) {
      throw new RuntimeCILError('Can not find local with index ' + localIndex)
    }
    return this.runtimeLocals[localIndex]
  }

  /**
   * Set the value for a runtime local in this call stack frame.
   *
   * @param localIndex The index of the local.
   * @param localValue The new value of the local.
   */
  setRuntimeLocalValue (localIndex: number, localValue: RuntimeOperand): void {
    this.getRuntimeLocalByIndex(localIndex).setValue(localValue)
  }

  /**
   * Get the value from a runtime local.
   *
   * @param localIndex The index of the local.
   */
  getRuntimeLocalValue (localIndex: number): RuntimeOperand {
    return this.getRuntimeLocalByIndex(localIndex).getValue()
  }

  /**
   * Iterate every argument local and runtime local in this call stack frame.
   *
   * @param callbackFunction The callback function that the argument will be the runtime local that is iterated.
   */
  iterateLocals (callbackFunction: (local: RuntimeLocal) => void): void {
    const argumentCount = this.argumentLocals.length
    for (let i = 0; i < argumentCount; i++) {
      callbackFunction(this.argumentLocals[i])
    }
    const runtimeLocalCount = this.runtimeLocals.length
    for (let i = 0; i < runtimeLocalCount; i++) {
      callbackFunction(this.runtimeLocals[i])
    }
  }

  setArgumentValue (argumentIndex: number, localValue: RuntimeOperand): void {
    this.argumentLocals[argumentIndex].setValue(localValue);
  }

  getArgumentValue (argumentIndex: number): any {
    return this.argumentLocals[argumentIndex].getValue();
  }
}

export { CallStackFrame }
