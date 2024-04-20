import { type CSharpContext, createNewContext } from './CSharpContext'
import { type CSharpProgram } from './compileTime/CSharpProgram'
import { assertNonNullOrUndefined } from '../util/Assertion'
import { type RuntimeContext } from './runtime/RuntimeContext'

let currentContext: CSharpContext

/**
 * Run user C# code.
 *
 * @param rawCode The C# code to run.
 * @param useNewContext Should use a new context to run the code?
 */
export function runUserCSharpCode (rawCode: string, useNewContext = true): void {
  initialize(useNewContext)
  addUserCSharpCodePieces([['UserCode.cs', rawCode]])
  compileAndRun()
}

/**
 * Initialize the evaluator.
 *
 * @param useNewContext Should use a new context?
 */
export function initialize (useNewContext: boolean = true): void {
  if (useNewContext) {
    currentContext = createNewContext()
    currentContext.initialize()
  }
}

/**
 * Compile all code code pieces that have been added to the evaluator and run the program.
 */
export function compileAndRun (): void {
  assertNonNullOrUndefined(currentContext)
  currentContext.compileAndRun()
}

/**
 * Add code pieces with unique code piece names and contents (code) into the evaluator.
 *
 * @param arr An array of code pieces. It should be an array of array in this format: [ ["CodePieceName1.cs", "//code"], ["CodePieceName2.cs", "//code"], ... ]
 */
export function addUserCSharpCodePieces (arr: string[][]): void {
  assertNonNullOrUndefined(currentContext)
  const len = arr.length
  for (let i = 0; i < len; i++) {
    currentContext.addUserCodePiece(arr[i][0], arr[i][1])
  }
}

/**
 * Get the current program.
 *
 * @returns The current program.
 */
export function getCurrentProgram (): CSharpProgram {
  assertNonNullOrUndefined(currentContext)
  return currentContext.program
}

export function getCurrentRuntimeContext (): RuntimeContext {
  assertNonNullOrUndefined(currentContext)
  return currentContext.runtimeContext
}

export function getStandardOutput (): string {
  assertNonNullOrUndefined(currentContext)
  return currentContext.getStandardOutput()
}
