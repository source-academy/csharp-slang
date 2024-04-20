import { type CILLocal, type CILLocalName } from '../cil/CILLocal'
import { assertNonNullOrUndefined, assertTrue } from '../../util/Assertion'
import { RuntimeOperand } from './RuntimeContext'
import { type ClassMetadata } from '../compileTime/metadata/ClassMetadata'
import { NULL_POINTER } from './heap/MemoryHeap'

/**
 * A class that represents a runtime local in the call stack frame.
 */
class RuntimeLocal {
  /**
   * The type of the local.
   */
  readonly type: ClassMetadata
  /**
   * The name of the local.
   */
  readonly name: CILLocalName
  protected storedValueOperand: RuntimeOperand

  /**
   * The constructor for the `RuntimeLocal` class.
   *
   * @param local The CILLocal that the new runtime local will be based on.
   */
  constructor (local: CILLocal | null) {
    if(local === null) {
      assertTrue(this instanceof ArgumentLocal);
      return;
    }
    this.type = local.type
    this.name = local.name
    this.storedValueOperand = NULL_POINTER
  }

  /**
   * Get the stored value in the runtime local.
   *
   * @returns The stored value in the runtime local.
   */
  getValue (): RuntimeOperand {
    assertNonNullOrUndefined(this.storedValueOperand)
    return this.storedValueOperand
  }

  /**
   * Set the stored value of the runtime local.
   *
   * @param newValue The new value for the runtime local.
   */
  setValue (newValue: RuntimeOperand): void {
    this.storedValueOperand = newValue
  }
}

class ArgumentLocal extends RuntimeLocal {

  constructor(operand : RuntimeOperand) {
    super(null);
    this.storedValueOperand = operand;
  }
}

export { RuntimeLocal, ArgumentLocal }
