import { AssertionError } from '../common/CSInterpreterError'

/**
 * Throw an `AssertionError` if `obj` is `null` or `undefined`.
 *
 * @returns `obj` itself, if it's not `null` or `undefined`.
 */
function assertNonNullOrUndefined (obj: any): any {
  if (obj === null) {
    throw new AssertionError('NonNull', 'Object is null.')
  }
  if (obj === undefined) {
    throw new AssertionError('NonUndefined', 'Object is undefined.')
  }
  return obj
}

/**
 * Throw an `AssertionError` when called.
 */
function assertNotReachHere (): void {
  throw new AssertionError('NotReachHere', 'Code execution has reached an unexpected place.')
}

/**
 * Throw an `AssertionError` when `value` is false.
 */
function assertTrue (value: boolean): void {
  if (!value) {
    throw new AssertionError('True', 'Actual value is false.')
  }
}

export { assertNonNullOrUndefined, assertNotReachHere, assertTrue }
