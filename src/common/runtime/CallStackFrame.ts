import { type CILInstructionAddress } from '../cil/CILInstruction'
import { RuntimeLocal } from './RuntimeLocal'
import { type CILMethodBody, type InstructionAddressPair } from '../cil/CILMethodBody'
import { assertTrue } from '../../util/Assertion'
import { RuntimeCILError } from '../CSInterpreterError'

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
  private readonly methodBody: CILMethodBody

  /**
   * The constructor for the `CallStackFrame` class.
   *
   * @param methodBody The CIL method body for this `CallStackFrame`.
   */
  constructor (methodBody: CILMethodBody) {
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
   * @param isReference Is the new value a reference to an object?
   */
  setRuntimeLocalValue (localIndex: number, localValue: any, isReference: boolean = false): void {
    this.getRuntimeLocalByIndex(localIndex).setValue(localValue, isReference)
  }

  /**
   * Get the value from a runtime local.
   *
   * @param localIndex The index of the local.
   */
  getRuntimeLocalValue (localIndex: number): any {
    return this.getRuntimeLocalByIndex(localIndex).getValue()
  }

  /**
   * Iterate every runtime local in this call stack frame.
   *
   * @param callbackFunction The callback function that the argument will be the runtime local that is iterated.
   */
  iterateRuntimeLocals (callbackFunction: (local: RuntimeLocal) => void): void {
    const localCount = this.runtimeLocals.length
    for (let i = 0; i < localCount; i++) {
      callbackFunction(this.runtimeLocals[i])
    }
  }
}

export { CallStackFrame }
