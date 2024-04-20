import { NotSupportedError } from '../../CSInterpreterError';
import { PrimitiveClassNames, SYSTEM_NAMESPACE_PATH } from '../../Constants';
import { getCurrentProgram, getCurrentRuntimeContext } from '../../Main';
import { primitiveTypeToInternalTypeName } from '../../compileTime/TypePath';
import { RuntimeObjectAddress, checkForNullReference } from '../heap/ObjectHeap';
import { getJavascriptNumberValueFromInt32Object, getPrimitiveObjectType, stringObjectToJavascriptString } from '../heap/PrimitiveValueHandler';
import { AbstractExternalLibrary } from './AbstractExternalLibrary';

class NativeLibrary extends AbstractExternalLibrary {
    constructor() {
        super();
        this.functions["Native_WriteToStandardOutput(" + SYSTEM_NAMESPACE_PATH + "." + primitiveTypeToInternalTypeName("string") + ")"] = (args : RuntimeObjectAddress[]) => writeToStandoutOutput(args[0]);
        this.functions["Native_PrimitiveObjectToString(" + SYSTEM_NAMESPACE_PATH + "." + primitiveTypeToInternalTypeName("object") + ")"] = (args : RuntimeObjectAddress[]) => nativePrimitiveObjectToString(args[0]);
        this.functions["Native_VirtualMachineDebugBreak()"] = () => { debugger; };
        this.functions["Native_ConcatenateStrings(" + SYSTEM_NAMESPACE_PATH + "." + primitiveTypeToInternalTypeName("string") + "," + SYSTEM_NAMESPACE_PATH + "." + primitiveTypeToInternalTypeName("string") + ")"] = (args : RuntimeObjectAddress[]) : RuntimeObjectAddress => concatenateStrings(args[0], args[1]);
        this.functions["Native_GetObjectTypeFullPath(" + SYSTEM_NAMESPACE_PATH + "." + primitiveTypeToInternalTypeName("object") + ")"] = (args : RuntimeObjectAddress[]) => getObjectTypeFullPath(args[0]);
        this.functions["Native_ObjectAddressToInt32(" + SYSTEM_NAMESPACE_PATH + "." + primitiveTypeToInternalTypeName("object") + ")"] = (args : RuntimeObjectAddress[]) => objectAddressToInt32(args[0]);
    }
}

function writeToStandoutOutput(stringObjectAddress : RuntimeObjectAddress) {
    checkForNullReference(stringObjectAddress);
    const heap = getCurrentRuntimeContext().getHeap();
    const content = stringObjectToJavascriptString(heap.readPrimitiveObject(stringObjectAddress));
    getCurrentRuntimeContext().writeToStandardOutput(content);
}

function nativePrimitiveObjectToString(objectAddress : RuntimeObjectAddress) : RuntimeObjectAddress {
    checkForNullReference(objectAddress);
    const heap = getCurrentRuntimeContext().getHeap();
    const objectBinary = heap.readPrimitiveObject(objectAddress);
    const primitiveObjectType = getPrimitiveObjectType(objectBinary);
    switch(primitiveObjectType) {
      case PrimitiveClassNames.Int32:
        return int32ToString(objectBinary);
      case PrimitiveClassNames.String:
        return objectAddress;
      default:
        throw new NotSupportedError("NativeLibrary.nativePrimitiveObjectToString: The primitive type " + primitiveObjectType + " is currently not supported.")
    }
}

function int32ToString(objectBinary : Uint8Array) : RuntimeObjectAddress {
    const heap = getCurrentRuntimeContext().getHeap();
    const numberJavascriptString = getJavascriptNumberValueFromInt32Object(objectBinary).toString();
    return heap.createPrimitiveObject("string", numberJavascriptString);
}

function getObjectTypeFullPath(address : RuntimeObjectAddress) : RuntimeObjectAddress{
    checkForNullReference(address);
    const heap = getCurrentRuntimeContext().getHeap();
    const classMetadataIndex = heap.getClassMetadataIndex(address);
    return heap.createPrimitiveObject("string", getCurrentProgram().getClassMetadataByIndex(classMetadataIndex).fullPathToString_Class());
}

function concatenateStrings(stringAddress1 : RuntimeObjectAddress, stringAddress2 : RuntimeObjectAddress) {
    checkForNullReference(stringAddress1);
    checkForNullReference(stringAddress2);
    const heap = getCurrentRuntimeContext().getHeap();
    const string1 = stringObjectToJavascriptString(heap.readPrimitiveObject(stringAddress1));
    const string2 = stringObjectToJavascriptString(heap.readPrimitiveObject(stringAddress2));
    const resultString = string1 + string2;
    return heap.createPrimitiveObject("string", resultString);
}

function objectAddressToInt32(address : RuntimeObjectAddress) : RuntimeObjectAddress {
    const heap = getCurrentRuntimeContext().getHeap();
    return heap.createPrimitiveObject("int", address);
}

export { NativeLibrary };
