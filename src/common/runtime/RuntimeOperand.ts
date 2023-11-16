import { assertNonNullOrUndefined } from '../../util/Assertion'

/**
 * A class representing a runtime operand in runtime locals or evaluation stack.
 */
class RuntimeOperand {
  /**
   * The value of the operand
   */
  readonly val: any
  /**
   * Is the operand value a reference to an object?
   */
  readonly isReference: boolean

  /**
   * The constructor for the `RuntimeOperand` class.
   *
   * @param val The value of the operand.
   * @param isReference Is the operand value a reference to an object?
   */
  constructor (val: any, isReference: boolean) {
    assertNonNullOrUndefined(val)
    this.val = val
    this.isReference = isReference
  }
}

export { RuntimeOperand }
