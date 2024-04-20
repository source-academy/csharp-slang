import { CSharpProgram } from './compileTime/CSharpProgram'
import { RuntimeContext } from './runtime/RuntimeContext'
import { assertNonNullOrUndefined } from '../util/Assertion'
import csharpCoreLibraryCode from '../generated-builtinCSharpLibraries/CoreLibrary.cs'
import { CORE_LIBRARY_CODE_PIECE_NAME } from './Constants'

// [DEVELOPMENT ONLY CODE]
import { MemoryHeap } from './runtime/heap/MemoryHeap'
// [DEVELOPMENT ONLY CODE] End

/**
 * The main class for C# evaluator's context, containing program information and runtime context.
 */
export class CSharpContext {
  readonly program: CSharpProgram
  readonly runtimeContext: RuntimeContext

  constructor () {
    this.program = new CSharpProgram()
    this.runtimeContext = new RuntimeContext()

    // [DEVELOPMENT ONLY CODE] Exposing the context here for testing them in browser's console
    if ((globalThis as any).test_csharp_context === undefined) {
      (globalThis as any).test_csharp_context = []
    }
    (globalThis as any).test_csharp_context[(globalThis as any).test_csharp_context.length] = this;
    (globalThis as any).TestMemoryHeapClass = MemoryHeap
    // [DEVELOPMENT ONLY CODE] End
  }

  /**
 * Add one user code piece into the context.
 *
 * @param codePieceName The name for the code piece.
 * @param userCode The user's C# code.
 */
  addUserCodePiece (codePieceName: string, userCode: string): void {
    this.program.addCodePiece(codePieceName, userCode)
    // log("UserCodeMetadata generated:");
    // log(this.userCodeMetadata);
    // log(this.userCodeMetadata.getClassMetadata("UserCode.MainClass"));
    // todo
  }

  /**
 * Initialize the context.
 */
  initialize (): void {
    this.addBuiltinLibraries()
  }

  /**
 * Compile all code code pieces that have been added to the evaluator and run the program.
 */
  compileAndRun (): void {
    assertNonNullOrUndefined(this.program)
    this.program.compile()
    this.run()
  }

  private addBuiltinLibraries (): void {
    assertNonNullOrUndefined(this.program)
    this.program.addCodePiece(CORE_LIBRARY_CODE_PIECE_NAME, csharpCoreLibraryCode)
    // todo: add other builtin libraries here
  }

  private run (): void {
    this.runtimeContext.run()
  }

  getStandardOutput (): string {
    return this.runtimeContext.getStandardOutput()
  }
}

/**
 * Create a new evaluator context.
 *
 * @returns The newly created evaluator context.
 */
export function createNewContext (): CSharpContext {
  const retVal = new CSharpContext()
  // Todo
  return retVal
}
