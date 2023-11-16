import { assertTrue } from '../../util/Assertion'

/**
 * An abstract class representing a general stack structure.
 */
abstract class Stack<T> {
  private readonly stack: T[]
  private stackTopIndex: number

  /**
   * The constructor for the `Stack` class.
   */
  constructor () {
    this.stack = []
    this.stackTopIndex = -1
  }

  /**
   * Returns `true` if this stack is empty, `false` otherwise.
   *
   * @returns `true` if this stack is empty, `false` otherwise.
   */
  isEmpty (): boolean {
    assertTrue(this.stackTopIndex >= -1)
    return this.stackTopIndex === -1
  }

  /**
   * Push a new object to the top of this stack.
   *
   * @param obj The new object.
   */
  push (obj: T): void {
    this.stackTopIndex++
    this.stack[this.stackTopIndex] = obj
  }

  /**
   * Pop the topmost object from this stack. You can NOT pop from an empty stack.
   *
   * @returns The popped object.
   */
  pop (): T {
    assertTrue(!this.isEmpty())
    const obj = this.stack[this.stackTopIndex]
    this.stackTopIndex--
    return obj
  }

  /**
   * Get the topmost object from this stack without popping it.
   *
   * @returns The topmost object.
   */
  peek (): T {
    assertTrue(!this.isEmpty())
    return this.stack[this.stackTopIndex]
  }

  /**
   * Clear this stack.
   */
  clear (): void {
    this.stackTopIndex = -1
  }

  /**
   * Iterate every object in this stack (from bottom to top).
   *
   * @param callbackFunction The callback function that the argument will be the object in the stack that is iterated.
   */
  iterate (callbackFunction: (obj: T) => void): void {
    for (let i = 0; i <= this.stackTopIndex; i++) {
      callbackFunction(this.stack[i])
    }
  }
}

export { Stack }
