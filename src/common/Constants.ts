/**
 * The path for the "System" namespace.
 */
export const SYSTEM_NAMESPACE_PATH = 'System'
/**
 * The class path and name for the "object" class.
 */
export const OBJECT_CLASS_PATH_AND_NAME = SYSTEM_NAMESPACE_PATH + '.Object'
/**
 * The name for the root namespace in program metadata.
 */
export const ROOT_NAMESPACE_NAME = 'RootNamespace'
/**
 * The code piece name for the C# builtin core library.
 */
export const CORE_LIBRARY_CODE_PIECE_NAME = 'System.cs'
/**
 * Class names for C# primitive types.
 */
export enum PrimitiveClassNames {
  Boolean = 'Boolean',
  Byte = 'Byte',
  SByte = 'SByte',
  Int16 = 'Int16',
  UInt16 = 'UInt16',
  Int32 = 'Int32',
  UInt32 = 'UInt32',
  Int64 = 'Int64',
  UInt64 = 'UInt64',
  Char = 'Char',
  Double = 'Double',
  Single = 'Single',
  Decimal = 'Decimal',
  String = 'String',
  Object = 'Object'
}
/**
 * The placeholder name for nameless locals in CIL
 */
export const CIL_NAMELESS_LOCAL_PLACEHOLDER_NAME = '*NamelessLocal*'
/**
 * The initial size (in bytes) for runtime memory heap.
 */
export const RUNTIME_MEMORY_HEAP_INITIAL_SIZE_IN_BYTES = 10240
/**
 * 32-bit signed integer's maximum value
 */
export const INT32_MIN_VALUE = -2147483648
/**
 * 32-bit signed integer's minimum value
 */
export const INT32_MAX_VALUE = 2147483647

export const CONSTRUCTOR_METHOD_NAME = '.ctor'

export const INSTRUCTIONS_PER_AUTO_GC = 10

export const MAXIMUM_CALL_STACK_SIZE = 1024

export const OUTPUT_CONSOLE_LOGS = true
