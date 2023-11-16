import { type CILOperationCodes, type CILOperationCodeArgument } from './CILOperationCodes'

type CILInstructionAddress = number

/**
 * A class that represents a single CIL instruction.
 */
class CILInstruction {
  /**
   * The CIL operation code.
   */
  readonly operationCode: CILOperationCodes
  /**
   * An array of the instruction's arguments.
   */
  readonly instructionArguments: readonly CILOperationCodeArgument[]

  /**
   * @param operationCode The CIL operation code.
   * @param instructionArguments An array of the instruction's arguments.
   */
  constructor (operationCode: CILOperationCodes, instructionArguments: CILOperationCodeArgument[]) {
    this.operationCode = operationCode
    this.instructionArguments = instructionArguments
  }
}

export { CILInstruction, type CILInstructionAddress }
