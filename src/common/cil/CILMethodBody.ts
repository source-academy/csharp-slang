import { CILInstruction, type CILInstructionAddress } from './CILInstruction'
import { CILLocal } from './CILLocal'
// import { log, logWarn } from '../../util/Logger'
import { assertTrue } from '../../util/Assertion'
import { CILError } from '../CSInterpreterError'
import { SYSTEM_NAMESPACE_PATH, PrimitiveClassNames, CIL_NAMELESS_LOCAL_PLACEHOLDER_NAME } from '../Constants'
import { getCurrentProgram } from '../Main'
import { removeFirstCharacter, removeLastCharacter } from '../../util/StringUtil'
import { CILOperationCodes } from './CILOperationCodes'

const LOCALS_INIT_HEADER = '.locals init ('
const LOCALS_INIT_END = ')'

export const INTERNAL_PARAMETER_NAME_FOR_THIS_REFERENCE = "this"

type CILTypePath = string

/**
 * An interface that represents a pair of `CILInstruction` and `CILInstructionAddress`
 *
 * `instruction` can be `null`.
 */
interface InstructionAddressPair {
  instruction: CILInstruction | null
  address: CILInstructionAddress
}

/**
 * A class that represents a method body in CIL.
 */
class CILMethodBody {
  /**
   * The CIL instructions in this method body.
   */
  readonly instructionList: CILInstruction[]
  /**
   * The information for the locals that will be created (as `RuntimeLocal`) when calling this method body.
   */
  readonly locals: CILLocal[]
  private initialized: boolean
  private cumulativeInstructionAddress = -1
  constructor () {
    this.instructionList = []
    this.locals = []
    this.initialized = false
  }

  /**
   * Parse raw CIL strings to this `CILMethodBody`.
   *
   * When calling this method, this `CILMethodBody` must haven't been initialized.
   *
   * @param str The raw CIL code string.
   */
  parseFromRawCILString (str: string): void {
    assertTrue(!this.isInitialized())
    this.initialized = true
    const lines = str.split('\n')
    const lineCount = lines.length
    let lineIndex = 0
    let currentLine = ''

    const initLocals = (): void => {
      assertTrue(currentLine === LOCALS_INIT_HEADER)
      moveToNextLine()
      /*
        init local lines should be similar to:
        [0] bool,
        [0] bool variableName,
        [0] class NamespaceA.ClassA variableName,
      */
      while (currentLine !== LOCALS_INIT_END) {
        let localInitLine = currentLine
        if (localInitLine[localInitLine.length - 1] === ',') {
          assertTrue(peekNextLine() !== LOCALS_INIT_END)
          localInitLine = removeLastCharacter(localInitLine)
        } else {
          assertTrue(peekNextLine() === LOCALS_INIT_END)
        }
        const splited = primitiveTypeLocalToClassTypeAndSplit(localInitLine)
        const localID = parseInt(removeLastCharacter(removeFirstCharacter(splited[0])))
        assertTrue(!Number.isNaN(localID))
        assertTrue(splited[1] === 'class')
        const localType = getCurrentProgram().getClassMetadataByCILTypePath(splited[2])
        const localName = splited[3]
        assertTrue(this.locals[localID] === undefined)
        this.locals[localID] = new CILLocal(localType, localName)
        moveToNextLine()
      }
      assertTrue(currentLine === LOCALS_INIT_END)
    }

    while (lineIndex < lineCount) {
      if (currentLine === LOCALS_INIT_HEADER) {
        initLocals()
        moveToNextLine()
        continue
      }
      if (currentLine === '') {
        moveToNextLine()
        continue
      }
      const tmp = currentLine.split(': ')
      const addressStr = tmp[0]
      assertTrue(addressStr.length === 7)
      assertTrue(addressStr[0] === 'I' && addressStr[1] === 'L' && addressStr[2] === '_')
      const instruction = makeInstruction(tmp[1])
      const address = parseInt('0x' + addressStr.slice(3))
      assertTrue(!Number.isNaN(address))
      assertTrue(address > this.cumulativeInstructionAddress)
      assertTrue(this.instructionList[address] === undefined)
      this.instructionList[address] = instruction
      this.cumulativeInstructionAddress = address
      moveToNextLine()
    }

    function moveToNextLine (): void {
      if (lineIndex >= lineCount) {
        throw new CILError('[Parse From String] Unexpected end of code.')
      }
      lineIndex++
      if (lineIndex < lineCount) {
        currentLine = lines[lineIndex].trim()
      } else {
        assertTrue(lineIndex === lineCount)
      }
    }

    function peekNextLine (): string {
      moveToNextLine()
      const nextLine = currentLine
      lineIndex--
      return nextLine
    }
  }

  /**
   * Get whether this `CILMethodBody` is initialized or not.
   */
  isInitialized (): boolean {
    return this.initialized
  }

  /**
   * Initialize the `CILMethodBody` to an empty `CILMethodBody`.
   *
   * When calling this method, this `CILMethodBody` must haven't been initialized.
   */
  initializeAsEmpty (): void {
    assertTrue(!this.isInitialized())
    this.initialized = true
  }

  /**
   * Get the maximum instruction address of this `CILMethodBody`.
   *
   * When calling this method, this `CILMethodBody` must have been initialized.
   */
  getMaximumAddress (): CILInstructionAddress {
    assertTrue(this.isInitialized())
    return this.cumulativeInstructionAddress
  }

  /**
   * Get the next instruction that is nearest to a given address. Use this method to get the address for the next instruction within this `CILMethodBody` because sometimes the instruction addresses in CIL may not be continuous.
   *
   * When calling this method, this `CILMethodBody` must have been initialized.
   *
   * @param startAddressExclusive The address for starting looking for the nearest next address (exclusive for the instruction exactly at this address).
   * @returns An InstructionAddressPair. If there is no next instruction, this method will return `{ instruction: null, address: this.getMaximumAddress() + 1 }`.
   */
  getNextInstructionAndAddress (startAddressExclusive: CILInstructionAddress): InstructionAddressPair {
    assertTrue(this.isInitialized())
    const maximumAddress = this.getMaximumAddress()
    for (let i = startAddressExclusive + 1; i <= maximumAddress; i++) {
      if (this.instructionList[i] !== undefined) {
        return { instruction: this.instructionList[i], address: i }
      }
    }
    return { instruction: null, address: this.getMaximumAddress() + 1 }
  }

  addInstruction (address : CILInstructionAddress, operationCode : CILOperationCodes, instructionArguments : string[]) : void {
    assertTrue(this.isInitialized());
    assertTrue(this.instructionList[address] === undefined);
    this.instructionList[address] = new CILInstruction(operationCode, instructionArguments);
    if(address > this.cumulativeInstructionAddress) {
      this.cumulativeInstructionAddress = address;
    }
  }
}

function primitiveTypeLocalToClassTypeAndSplit (localInitInstructionStr: string): string[] {
  const splited = localInitInstructionStr.split(' ')
  assertTrue(splited.length >= 2 && splited.length <= 4)
  if (splited.length === 4) {
    /* If localInitInstructionStr already has a local type that is specified by class path and name, directly return the splitted array
       For example:
       [0] class NamespaceA.ClassA variableA,
    */
    assertTrue(splited[1] === 'class')
    return splited
  }
  const result = [splited[0], 'class', '', splited.length === 2 ? CIL_NAMELESS_LOCAL_PLACEHOLDER_NAME : splited[2]]
  const primitiveLocalTypeName = splited[1]
  const internalTypeName = primitiveLocalTypeToInternalTypeName(primitiveLocalTypeName)
  assertTrue(internalTypeName !== 'UNKNOWN_TYPE')
  result[2] = SYSTEM_NAMESPACE_PATH + '.' + internalTypeName
  return result
}

function primitiveLocalTypeToInternalTypeName (primitiveLocalType: string): string {
  switch (primitiveLocalType) {
    case 'bool':
      return PrimitiveClassNames.Boolean
    case 'uint8':
      return PrimitiveClassNames.Byte
    case 'int8':
      return PrimitiveClassNames.SByte
    case 'int16':
      return PrimitiveClassNames.Int16
    case 'uint16':
      return PrimitiveClassNames.UInt16
    case 'int32':
      return PrimitiveClassNames.Int32
    case 'uint32':
      return PrimitiveClassNames.UInt32
    case 'int64':
      return PrimitiveClassNames.Int64
    case 'uint64':
      return PrimitiveClassNames.UInt64
    case 'char':
      return PrimitiveClassNames.Char
    case 'float64':
      return PrimitiveClassNames.Double
    case 'float32':
      return PrimitiveClassNames.Single
    case 'string':
      return PrimitiveClassNames.String
    case 'object':
      return PrimitiveClassNames.Object
  }
  return 'UNKNOWN_TYPE'
}

function makeInstruction (instructionStr: string): CILInstruction {
  const splited = instructionStr.split(' ')
  let operationCode: CILOperationCodes = CILOperationCodes[splited[0].replaceAll('.', '_') as keyof typeof CILOperationCodes]
  if (operationCode === undefined) {
    throw new CILError('Unknown operation code: ' + splited[0])
  }
  const len = splited.length
  const instructionArguments = []
  const originalOperationCode = operationCode
  switch (operationCode) {
    case CILOperationCodes.ldloc_0:
    case CILOperationCodes.ldloc_1:
    case CILOperationCodes.ldloc_2:
    case CILOperationCodes.ldloc_3:
      operationCode = CILOperationCodes.ldloc_s
      break
    case CILOperationCodes.stloc_0:
    case CILOperationCodes.stloc_1:
    case CILOperationCodes.stloc_2:
    case CILOperationCodes.stloc_3:
      operationCode = CILOperationCodes.stloc_s
      break
    case CILOperationCodes.ldc_i4_0:
    case CILOperationCodes.ldc_i4_1:
    case CILOperationCodes.ldc_i4_2:
    case CILOperationCodes.ldc_i4_3:
    case CILOperationCodes.ldc_i4_4:
    case CILOperationCodes.ldc_i4_5:
    case CILOperationCodes.ldc_i4_6:
    case CILOperationCodes.ldc_i4_7:
    case CILOperationCodes.ldc_i4_8:
      operationCode = CILOperationCodes.ldc_i4_s
      break
  }
  if (operationCode !== originalOperationCode) {
    const tmp = splited[0].split('.')
    instructionArguments[instructionArguments.length] = tmp[tmp.length - 1]
  }

  for (let i = 1; i < len; i++) {
    let currentArgument = splited[i]
    if (i === 2 && (
      operationCode === CILOperationCodes.newobj ||
operationCode === CILOperationCodes.call
    )) {
      if (splited[1] === 'instance' && currentArgument !== 'void' && currentArgument !== 'class') {
        currentArgument = primitiveLocalTypeToInternalTypeName(currentArgument)
        instructionArguments[instructionArguments.length] = 'class'
      }
    }

    instructionArguments[instructionArguments.length] = currentArgument
  }

  return new CILInstruction(operationCode, instructionArguments)
}

export { CILMethodBody, type CILTypePath, type InstructionAddressPair }
