import { assertTrue } from './Assertion'

/**
 * An class representing a general stack structure.
 */
class Stack<T> {
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
    // return this.stackTopIndex === -1
    return this.elementCount() === 0
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
   * Iterate every object in this stack.
   *
   * @param callbackFunction The callback function that the argument will be the object in the stack that is iterated. The return value of the callback function indicates whether the iteration should continue; if the return value of the callback function is `false`, the iteration will stop.
   * @param fromTopToBottom Iterate objects in the stack from top to bottom? (default is `false`, means that this function will iterate every object in the stack from bottom to top)
   */
  iterate (callbackFunction: (obj: T) => boolean, fromTopToBottom: boolean = false): void {
    if (fromTopToBottom) {
      for (let i = this.stackTopIndex; i >= 0; i--) {
        const shouldContinueIteration = callbackFunction(this.stack[i])
        if (!shouldContinueIteration) {
          break
        }
      }
    } else {
      for (let i = 0; i <= this.stackTopIndex; i++) {
        const shouldContinueIteration = callbackFunction(this.stack[i])
        if (!shouldContinueIteration) {
          break
        }
      }
    }
  }

  elementCount (): number {
    return this.stackTopIndex + 1
  }
}

export { Stack }
