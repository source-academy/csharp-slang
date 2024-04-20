import { formatString } from '../util/StringUtil'
import { getCurrentProgram } from './Main'

class CSInterpreterError extends Error {
  constructor (message: string) {
    super('[C# Interpreter Error] ' + message)
  }
}

/**
 * CSRuntimeError (or its subtype errors) will be thrown when there is an error during running C# code.
 */
class CSRuntimeError extends CSInterpreterError {
  constructor (message: string) {
    super('Error in C# runtime: ' + message)
  }
}

class InternalError extends CSInterpreterError {
  constructor (message: string) {
    super(' [INTERNAL] ' + message)
  }
}

/**
 * CSMetadataError will be thrown when an internal error related to program metadata happens.
 *
 * It is a type of internal error.
 */
class CSMetadataError extends InternalError {
  constructor (message: string) {
    super('Error in C# code metadata: ' + message)
  }
}

/**
 * CSParseTreeToMetadataError will be thrown when an internal error happens while parsing parse tree to program metadata.
 *
 * It is a type of internal error.
 */
class CSParseTreeToMetadataError extends InternalError {
  constructor (message: string) {
    super('Error in building metadata from parse tree: ' + message)
  }
}

/**
 * AssertionError will be thrown when any assertion fails.
 */
class AssertionError extends InternalError {
  constructor (assertionName: string, message: string) {
    super('Assertion ' + assertionName + ' failed: ' + message)
  }
}

/**
 * CSRuleError will be thrown when there is an error or mistake in user's C# code.
 */
class CSRuleError extends CSInterpreterError {
  readonly errorID: string
  readonly values: string[]
  readonly codePieceIndex: number

  constructor (errorID: string, values: string[], codePieceIndex: number) {
    super('error CS' + errorID + ': ')
    this.codePieceIndex = codePieceIndex
    this.message = getCurrentProgram().getCodePieceNameByIndex(this.codePieceIndex) + ': ' + this.message
    let description = ''
    switch (errorID) {
      case '0019':
        description = "Operator '%val' cannot be applied to operands of type '%val' and '%val'"
        break
      case '0026':
        description = "Keyword 'this' is not valid in a static property, static method, or static field initializer"
        break
      case '0100':
        description = "The parameter name '%val' is a duplicate"
        break
      case '0101':
        description = "The namespace '%val' already contains a definition for '%val'"
        break
      case '0102':
        description = "The type '%val' already contains a definition for '%val'"
        break
      case '0103':
        description = "The name '%val' does not exist in the current context"
        break
      case '0111':
        description = "A member '%val' is already defined. Rename this member or use different parameter types"
        break
      case '0117':
        description = "'%val' does not contain a definition for '%val'"
        break
      case '0118':
        description = "'%val' is a 'namespace' but a 'type' was expected"
        break
      case '0118_2':
        description = "'%val' is a type but is used like a variable"
        break
      case '0120':
        description = "An object reference is required for the non-static field, method, or property '%val'"
        break
      case '0121':
        description = "The call is ambiguous between the following methods or properties: '%val' and '%val'"
        break
      case '0128':
        description = "A local variable or function named '%val' is already defined in this scope"
        break
      case '0136':
        description = "A local or parameter named '%val' cannot be declared in this scope because that name is used in an enclosing local scope to define a local or parameter"
        break
      case '0146':
        description = "Circular base class dependency involving '%val' and '%val'"
        break
      case '0176':
        description = "Member '%val' cannot be accessed with an instance reference; qualify it with a type name instead"
        break
      case '0234':
        description = "The type or namespace name '%val' does not exist in the namespace '%val'. Are you missing an assembly reference?"
        break
      case '0246':
        description = "The type or namespace name '%val' could not be found. Are you missing an assembly reference?"
        break
      case '1501':
        description = "No overload of method '%val' takes %val arguments"
        break
      case '1503':
        description = "Argument %val: cannot convert from '%val' to '%val'"
        break
      case '1520':
        description = 'Method must have a return type'
        break
      case '1955':
        description = "Non-invocable member '%val' cannot be used like a method."
        break
      case '-1':
        description = "TODO: Unspecified error. Error ID and description to be done. (In '%val')"
        break
      default:
        description = 'Unknown Error'
        break
    }
    this.errorID = errorID
    this.values = values
    this.message += formatString(description, values)
  }
}

/**
 * NameBindingError will be thrown when an internal error related to name bindings happens.
 *
 * It is a type of internal error.
 */
class NameBindingError extends InternalError {
  readonly name: string
  readonly reason: string
  constructor (name: string, reason: string) {
    super('NameBindingError: ' + reason + ', name: ' + name)
    this.name = name
    this.reason = reason
  }
}

/**
 * DuplicatedCodePieceNameError will be thrown when there are two code pieces with the same name.
 */
class DuplicatedCodePieceNameError extends CSInterpreterError {
  constructor (codePieceName: string) {
    super("A code piece with name '" + codePieceName + "' already exists.")
  }
}

/**
 * CILError (or its subtype errors) will be thrown when an internal error related to CIL happens.
 *
 * It is a type of internal error.
 */
class CILError extends InternalError {
  constructor (message: string) {
    super('[CIL Error] ' + message)
  }
}

class NonInternalCILError extends CSRuntimeError {
  constructor (message: string) {
    super('[CIL Error] ' + message)
  }
}

/**
 * RuntimeCILError will be thrown when there is an error during running CIL code.
 *
 * It is a type of internal error.
 */
class RuntimeCILError extends CILError {
  constructor (message: string) {
    super('[Runtime] ' + message)
  }
}

class NonInternalRuntimeCILError extends NonInternalCILError {
  constructor (message: string) {
    super('[Runtime] ' + message)
  }
}

/**
 * OutOfHeapMemoryError will be thrown when failing to allocate heap memory due to space.
 */
class OutOfHeapMemoryError extends NonInternalRuntimeCILError {
  constructor (allocationSize: number) {
    super('Out of heap memory. Trying to allocate ' + allocationSize + ' byte(s).')
  }
}

class NotSupportedError extends CSInterpreterError {
  constructor (message: string) {
    super('This feature is currently not supported in this C# interpreter: ' + message)
  }
}

export {
  CSMetadataError,
  CSRuntimeError,
  AssertionError,
  CSParseTreeToMetadataError,
  CSRuleError,
  NameBindingError,
  DuplicatedCodePieceNameError,
  CILError,
  RuntimeCILError,
  OutOfHeapMemoryError,
  NotSupportedError
}
