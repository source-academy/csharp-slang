import { type CILLocal, type CILLocalName } from '../cil/CILLocal'
import { assertNonNullOrUndefined } from '../../util/Assertion'
import { RuntimeOperand } from './RuntimeOperand'
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
  private storedValueOperand: RuntimeOperand

  /**
   * The constructor for the `RuntimeLocal` class.
   *
   * @param local The CILLocal that the new runtime local will be based on.
   */
  constructor (local: CILLocal) {
    this.type = local.type
    this.name = local.name
    this.storedValueOperand = new RuntimeOperand(NULL_POINTER, true)
  }

  /**
   * Get the stored value in the runtime local.
   *
   * @returns The stored value in the runtime local.
   */
  getValue (): any {
    assertNonNullOrUndefined(this.storedValueOperand)
    return this.storedValueOperand.val
  }

  /**
   * Is the stored value in the runtime local a reference to an object?
   *
   * @returns `true` if the stored value in the runtime local is a reference to an object and `false` otherwise.
   */
  getIsReference (): boolean {
    assertNonNullOrUndefined(this.storedValueOperand)
    return this.storedValueOperand.isReference
  }

  /**
   * Set the stored value of the runtime local.
   *
   * @param newValue The new value for the runtime local.
   * @param isReference Is the new value a reference to an object?
   */
  setValue (newValue: any, isReference: boolean): void {
    this.storedValueOperand = new RuntimeOperand(newValue, isReference)
  }
}

export { RuntimeLocal }
