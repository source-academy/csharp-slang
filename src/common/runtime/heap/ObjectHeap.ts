import { MemoryHeap, NULL_POINTER } from './MemoryHeap'
import { type ClassMetadata } from '../../compileTime/metadata/ClassMetadata'
import { int32ToBytesLittleEndian, bytesToInt32LittleEndian } from '../../../util/BinaryUtil'
import { formatString } from '../../../util/StringUtil'
import { log, logVerbose } from '../../../util/Logger'
import { assertNonNullOrUndefined, assertNotReachHere, assertTrue } from '../../../util/Assertion'
import { CSRuntimeError, NotSupportedError, RuntimeCILError } from '../../CSInterpreterError'
import { type RuntimeContext } from '../RuntimeContext'
import { type CallStackFrame } from '../CallStackFrame'
import { type RuntimeLocal } from '../RuntimeLocal'
import { type RuntimeOperand } from '../RuntimeContext'
import { OBJECT_SIZE_INT32, TypescriptTypesThoseCanBeUsedAsCSharpPrimitiveTypes, getPrimitiveObjectType, makePrimitiveObject } from './PrimitiveValueHandler'
import { PrimitiveClassNames } from '../../Constants'
import { getCurrentProgram } from '../../Main'

type ClassMetadataIndex = number
type FieldOffset = number
type FieldSize = number
type RuntimeObjectAddress = number

const ObjectStructure = {
  classMetadataIndex_Index: 0,
  classMetadataIndex_Size: 4,
  objectGCMark_Index: 4, // Object GC Mark: 1 = reachable, 0 = not reachable (will be collected)
  objectGCMark_Size: 1,
  objectFields_Index: 5,
  objectHeaderTotalSize: 5
}

const MESSAGE_FIELD_READ_WRITE_FAILED = "Failed to %val from field '%val' for object at %val (class metadata index = %val). Reason: %val"
const MESSAGE_REASON_FIELD_NOT_FOUND = 'Field not found.'
const MESSAGE_REASON_INVALID_DATA_LENGTH = 'Data length is different from field size.'

class FieldInfo {
  fieldOffset: FieldOffset
  fieldSize: FieldSize

  constructor (fieldOffset: FieldOffset, fieldSize: FieldSize) {
    this.fieldOffset = fieldOffset
    this.fieldSize = fieldSize
  }
}

/**
 * A class that represents an object heap, that can manage the memory heap in object level.
 */
class ObjectHeap {
  private readonly memoryHeap: MemoryHeap
  private readonly cachedClassFieldInfo: Record<ClassMetadataIndex, Record<string, FieldInfo>>
  private readonly allObjectAddresses: Array<RuntimeObjectAddress | null>

  /**
   * The constructor for the `ObjectHeap` class.
   */
  constructor () {
    this.memoryHeap = new MemoryHeap()
    this.cachedClassFieldInfo = {}
    this.allObjectAddresses = []
  }

  /**
   * Create a new object instance in the memory heap from the given class metadata.
   *
   * @param classMetadata The class metadata that is used to create the new object.
   * @returns The address for the newly created object.
   */
  createNewObjectInstance (classMetadata: ClassMetadata): RuntimeObjectAddress {
    const classMetadataIndex = classMetadata.classMetadataIndex
    const address = this.memoryHeap.malloc(ObjectStructure.objectHeaderTotalSize + classMetadata.sizeOfObjectFields)
    this.memoryHeap.write(address + ObjectStructure.classMetadataIndex_Index, int32ToBytesLittleEndian(classMetadataIndex))
    this.setObjectMark(address, false)
    this.memoryHeap.write(address + ObjectStructure.objectFields_Index, new Uint8Array(classMetadata.sizeOfObjectFields)) // Set all bytes for object fields to zeros.
    this.cacheClassFieldInfo(classMetadata)
    this.addNewObjectAddressIntoArray(address)
    logVerbose("[ObjectHeap] Created a new object at memory heap address " + address);
    return address
  }

  /**
   * Read data from a field of an object.
   *
   * @param objectAddress The address for an runtime object in the memory heap.
   * @param fieldName The name of the target field. The field with this name must exists in the runtime object.
   * @returns The data in the field, represented in an array of bytes. The array will have the same length as the target field's size.
   */
  readObjectField (objectAddress: RuntimeObjectAddress, fieldName: string): Uint8Array {
    const classMetadataIndex = this.getClassMetadataIndex(objectAddress)
    const fieldInfo = this.getClassFieldInfoArray(classMetadataIndex)[fieldName]
    if (fieldInfo === undefined) {
      throw new RuntimeCILError(formatString(MESSAGE_FIELD_READ_WRITE_FAILED, ['read', fieldName, objectAddress.toString(), classMetadataIndex.toString(), MESSAGE_REASON_FIELD_NOT_FOUND]))
    }
    const fieldOffset = fieldInfo.fieldOffset
    const fieldSize = fieldInfo.fieldSize
    logVerbose("[ObjectHeap] Read object field " + fieldName + " in object " + objectAddress);
    return this.memoryHeap.read(objectAddress + ObjectStructure.objectFields_Index + fieldOffset, fieldSize)
  }

  /**
   * Write data to a field of an object.
   *
   * @param objectAddress The address for an runtime object in the memory heap.
   * @param fieldName The name of the target field. The field with this name must exists in the runtime object.
   * @returns The data that will be written to the field, represented in an array of bytes. The array must have the same length as the target field's size.
   */
  writeObjectField (objectAddress: RuntimeObjectAddress, fieldName: string, data: Uint8Array): void {
    const classMetadataIndex = this.getClassMetadataIndex(objectAddress)
    const fieldInfo = this.getClassFieldInfoArray(classMetadataIndex)[fieldName]
    if (fieldInfo === undefined) {
      throw new RuntimeCILError(formatString(MESSAGE_FIELD_READ_WRITE_FAILED, ['write', fieldName, objectAddress.toString(), classMetadataIndex.toString(), MESSAGE_REASON_FIELD_NOT_FOUND]))
    }
    const fieldOffset = fieldInfo.fieldOffset
    const fieldSize = fieldInfo.fieldSize
    if (data.length !== fieldSize) {
      throw new RuntimeCILError(formatString(MESSAGE_FIELD_READ_WRITE_FAILED, ['write', fieldName, objectAddress.toString(), classMetadataIndex.toString(), MESSAGE_REASON_INVALID_DATA_LENGTH]))
    }
    logVerbose("[ObjectHeap] Write object field " + fieldName + " in object " + objectAddress);
    this.memoryHeap.write(objectAddress + ObjectStructure.objectFields_Index + fieldOffset, data)
  }

  private cacheClassFieldInfo (classMetadata: ClassMetadata): void {
    if (this.cachedClassFieldInfo[classMetadata.classMetadataIndex] !== undefined) {
      // If the data is already cached before, then no need to cache again.
      return
    }
    const fieldCount = classMetadata.fields.length
    const fieldInfoRecord: Record<string, FieldInfo> = {}
    for (let i = 0; i < fieldCount; i++) {
      const fieldMetadata = classMetadata.fields[i]
      const fieldName = fieldMetadata.fieldName
      const fieldOffset = fieldMetadata.fieldOffset
      const fieldSize = fieldMetadata.fieldSize
      fieldInfoRecord[fieldName] = new FieldInfo(fieldOffset, fieldSize)
    }
    this.cachedClassFieldInfo[classMetadata.classMetadataIndex] = fieldInfoRecord
  }

  private getClassFieldInfoArray (classMetadataIndex: ClassMetadataIndex): Record<string, FieldInfo> {
    assertNonNullOrUndefined(this.cachedClassFieldInfo[classMetadataIndex])
    return this.cachedClassFieldInfo[classMetadataIndex]
  }

  private addNewObjectAddressIntoArray (address: RuntimeObjectAddress): void {
    const len = this.allObjectAddresses.length
    for (let i = 0; i < len; i++) {
      if (this.allObjectAddresses[i] === null) {
        this.allObjectAddresses[i] = address
        return
      }
    }
    this.allObjectAddresses[len] = address
  }

  /**
   * Collect the garbage in the heap, using Mark-and-Sweep algorithm.
   *
   * @param runtimeContext The runtime context that owns this `ObjectHeap`
   */
  collectGarbage (runtimeContext: RuntimeContext): void {
    this.markReachableObjects(runtimeContext)
    this.sweepUnreachableObjects()
  }

  private markReachableObjects (runtimeContext: RuntimeContext): void {
    const callStackIterationCallbackFunction = (callStackFrame: CallStackFrame): void => {
      const callStackFrameIterationCallbackFunction = (runtimeLocal: RuntimeLocal): void => {
        /*if (!runtimeLocal.getIsReference()) {
          return
        }*/
        const val = runtimeLocal.getValue()
        if (val === NULL_POINTER) {
          return
        }
        this.dfsReachableObjects(val)
      }
      callStackFrame.iterateLocals(callStackFrameIterationCallbackFunction)
    }
    const evaluationStackIterationCallbackFunction = (runtimeOperand: RuntimeOperand): void => {
      /*if (!runtimeOperand.isReference) {
        return
      }*/
      const val = runtimeOperand
      if (val === NULL_POINTER) {
        return
      }
      this.dfsReachableObjects(val)
    }
    runtimeContext.iterateCallStack(callStackIterationCallbackFunction)
    runtimeContext.iterateEvaluationStack(evaluationStackIterationCallbackFunction)
  }

  private dfsReachableObjects (objectAddress: RuntimeObjectAddress): void {
    if(objectAddress === NULL_POINTER) {
      return;
    }
    const classMetadataIndex = bytesToInt32LittleEndian(this.memoryHeap.read(objectAddress, ObjectStructure.classMetadataIndex_Size))
    if (this.isObjectMarked(objectAddress)) {
      return
    }
    this.setObjectMark(objectAddress, true)
    if((globalThis as any).isUnitTest_ObjectHeap === undefined) { // In the unit test environment for ObjectHeap, calling getCurrentProgram() will lead to an error, thus failing the test cases.
      if(getCurrentProgram().isPrimitiveType(classMetadataIndex)) {
        return // Primitive type objects don't have regular fields
      }
    }
    const fieldInfoArray = this.getClassFieldInfoArray(classMetadataIndex)
    for (const fieldName in fieldInfoArray) {
      const fieldInfo = fieldInfoArray[fieldName]
      /*if (!fieldInfo.isReference) {
        continue
      }*/
      const referencedObjectAddress = bytesToInt32LittleEndian(this.memoryHeap.read(objectAddress + ObjectStructure.objectFields_Index + fieldInfo.fieldOffset, fieldInfo.fieldSize))
      this.dfsReachableObjects(referencedObjectAddress)
    }
  }

  private sweepUnreachableObjects (): void {
    const len = this.allObjectAddresses.length
    for (let i = 0; i < len; i++) {
      const address = this.allObjectAddresses[i]
      if (address === null) {
        continue
      }
      if (!this.isObjectMarked(address)) {
        if((globalThis as any).isUnitTest_ObjectHeap === undefined) { // In the unit test environment for ObjectHeap, calling getCurrentProgram() will lead to an error, thus failing the test cases.
          log('%c [GC] Collecting unreachable object at address ' + address + '   (' + getCurrentProgram().getClassMetadataByIndex(this.getClassMetadataIndex(address)).fullPathToString_Class() + ')', "background: #99ff99")
        }
        // dispose the object
        // todo: calling the destructor method in the object
        this.memoryHeap.free(address)
        this.allObjectAddresses[i] = null
      } else {
        this.setObjectMark(address, false) // unmark the object
      }
    }
  }

  private isObjectMarked (objectAddress: RuntimeObjectAddress): boolean {
    return this.memoryHeap.read(objectAddress + ObjectStructure.objectGCMark_Index, ObjectStructure.objectGCMark_Size)[0] === 1
  }

  private setObjectMark (objectAddress: RuntimeObjectAddress, marked: boolean): void {
    this.memoryHeap.write(objectAddress + ObjectStructure.objectGCMark_Index, (marked ? new Uint8Array([1]) : new Uint8Array([0])))
  }

  public getClassMetadataIndex(objectAddress : RuntimeObjectAddress) : number {
    return bytesToInt32LittleEndian(this.memoryHeap.read(objectAddress, ObjectStructure.classMetadataIndex_Size))
  }

  /*public directlyWriteToMemoryHeap(address : MemoryHeapAddress, data : Uint8Array) {
    this.memoryHeap.write(address, data);
  }*/

  public createPrimitiveObject(primitiveTypeName : string, value : TypescriptTypesThoseCanBeUsedAsCSharpPrimitiveTypes) : RuntimeObjectAddress {
    const primitiveObjectBinary = makePrimitiveObject(primitiveTypeName, value);
    const address = this.memoryHeap.malloc(primitiveObjectBinary.length);
    this.memoryHeap.write(address, primitiveObjectBinary);
    this.addNewObjectAddressIntoArray(address);
    logVerbose("[ObjectHeap] Created a new primitive object " + primitiveTypeName + " at memory heap address " + address);
    return address;
  }

  public readPrimitiveObject(address : RuntimeObjectAddress) : Uint8Array {
    const primitiveObjectType = getPrimitiveObjectType(this.memoryHeap.read(address, ObjectStructure.objectHeaderTotalSize));
    logVerbose("[ObjectHeap] Read primitive object " + primitiveObjectType + " at memory heap address " + address);
    switch(primitiveObjectType) {
      case PrimitiveClassNames.Int32:
        return this.readInt32(address);
      case PrimitiveClassNames.String:
        return this.readString(address);
      default:
        throw new NotSupportedError("ObjectHeap.readPrimitiveObject: The primitive type " + primitiveObjectType + " is currently not supported.")
    }
  }

  private readInt32(address : RuntimeObjectAddress) : Uint8Array {
    return this.memoryHeap.read(address, OBJECT_SIZE_INT32);
  }
  private readString(address : RuntimeObjectAddress) : Uint8Array {
    const stringLength = bytesToInt32LittleEndian(this.memoryHeap.read(address + ObjectStructure.objectHeaderTotalSize, 4));
    const totalSize = ObjectStructure.objectHeaderTotalSize + 4 + stringLength;
    return this.memoryHeap.read(address, totalSize);
  }

  public createObjectFromBinary(binary : Uint8Array) : RuntimeObjectAddress {
    const size = binary.length;
    assertTrue(size > ObjectStructure.objectHeaderTotalSize);
    const address = this.memoryHeap.malloc(size);
    this.memoryHeap.write(address, binary);
    this.addNewObjectAddressIntoArray(address);
    logVerbose("[ObjectHeap] Created a new object from binary at memory heap address " + address);
    return address;
  }
}

function checkForNullReference(address : RuntimeObjectAddress) : void {
  if(address === NULL_POINTER) {
    throw new CSRuntimeError("(NullReference) Object reference not set to an instance of an object.");
  }
}

export { ObjectHeap, ObjectStructure, RuntimeObjectAddress, checkForNullReference }
