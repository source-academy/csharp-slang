import { assertTrue } from "../../../util/Assertion";
import { bytesToInt32LittleEndian, int32ToBytesLittleEndian } from "../../../util/BinaryUtil";
import { RuntimeCILError } from "../../CSInterpreterError";
import { INT32_MAX_VALUE, INT32_MIN_VALUE, PrimitiveClassNames, SYSTEM_NAMESPACE_PATH } from "../../Constants";
import { getCurrentProgram } from "../../Main";
import { primitiveTypeToInternalTypeName } from "../../compileTime/TypePath";
import { ObjectStructure } from "./ObjectHeap";

type TypescriptTypesThoseCanBeUsedAsCSharpPrimitiveTypes = number | string;
//const OBJECT_SIZE_INT32 = ObjectStructure.objectHeaderTotalSize + 4;
const OBJECT_SIZE_INT32 = 5 + 4;

function writeObjectHeader(array: Uint8Array, primitiveTypeName : string) : void{
    const classMetadataIndex = getCurrentProgram().primitiveClassNamesToClassMetadataIndexesMapping[primitiveTypeToInternalTypeName(primitiveTypeName)];
    const classMetadataIndexBytes = int32ToBytesLittleEndian(classMetadataIndex);
    classMetadataIndexBytes.forEach((byte, index) => {array[ObjectStructure.classMetadataIndex_Index + index] = byte;});
    array[ObjectStructure.objectGCMark_Index] = 0;
}

function getPrimitiveObjectType(fullObjectBinaryOrHeaderBinary : Uint8Array) : PrimitiveClassNames {
    assertTrue(fullObjectBinaryOrHeaderBinary.length >= ObjectStructure.objectHeaderTotalSize);
    const classMetadataIndex = bytesToInt32LittleEndian(fullObjectBinaryOrHeaderBinary.slice(ObjectStructure.classMetadataIndex_Index, ObjectStructure.classMetadataIndex_Index + ObjectStructure.classMetadataIndex_Size));
    const primitiveTypeName = getCurrentProgram().classMetadataIndexesToPrimitiveClassNamesMapping[classMetadataIndex];
    if(primitiveTypeName === undefined) {
        throw new RuntimeCILError("getPrimitiveObjectType: The object is not a primitive object!");
    }
    return primitiveTypeName;
}

function makeInt32Object(x : number) : Uint8Array {
    assertTrue(Number.isSafeInteger(x));
    assertTrue(x >= INT32_MIN_VALUE && x <= INT32_MAX_VALUE)
    const result = new Uint8Array(OBJECT_SIZE_INT32);
    writeObjectHeader(result, "int");
    const integerBytes = int32ToBytesLittleEndian(x);
    integerBytes.forEach((byte, index) => {result[ObjectStructure.objectHeaderTotalSize + index] = byte;});
    return result;
}

function getJavascriptNumberValueFromInt32Object(int32Obj : Uint8Array) : number{
    // assertTrue(getPrimitiveObjectType(int32Obj) === PrimitiveClassNames.Int32);
    assertTrue(int32Obj.length === OBJECT_SIZE_INT32); // Use this assertion instead of the assertion above to enhance efficiency.
    return bytesToInt32LittleEndian(int32Obj.slice(ObjectStructure.objectHeaderTotalSize, OBJECT_SIZE_INT32));
}

function int32HandleOverflow(x : number) : number {
    if(x > INT32_MAX_VALUE) {
        return (x - 2147483648) % 4294967296 - 2147483648;
    }
    if(x < INT32_MIN_VALUE) {
        return (x + 4294967296) % 4294967296;
    }
    return x;
}

function int32BinaryOperation(leftInt32Object : Uint8Array, rightInt32Object : Uint8Array, operation : (left : number, right : number) => number) {
    assertTrue(leftInt32Object.length === ObjectStructure.objectHeaderTotalSize + 4);
    assertTrue(rightInt32Object.length === ObjectStructure.objectHeaderTotalSize + 4);
    const leftNumber = getJavascriptNumberValueFromInt32Object(leftInt32Object);
    const rightNumber = getJavascriptNumberValueFromInt32Object(rightInt32Object);
    const resultNumber = int32HandleOverflow(operation(leftNumber, rightNumber));
    return makeInt32Object(resultNumber);
}

function makeStringObject(str : string) : Uint8Array {
    const length = str.length;
    const result = new Uint8Array(ObjectStructure.objectHeaderTotalSize + 4 + length);
    writeObjectHeader(result, "string");
    const lengthBytes = int32ToBytesLittleEndian(length);
    lengthBytes.forEach((byte, index) => {result[ObjectStructure.objectHeaderTotalSize + index] = byte;});
    for(let i = 0; i < length; i++) {
        result[ObjectStructure.objectHeaderTotalSize + 4 + i] = str.charCodeAt(i);
    }
    return result;
}

function stringObjectToJavascriptString(stringObject : Uint8Array) : string {
    const stringLength = bytesToInt32LittleEndian(stringObject.slice(ObjectStructure.objectHeaderTotalSize, ObjectStructure.objectHeaderTotalSize + 4));
    assertTrue(ObjectStructure.objectHeaderTotalSize + 4 + stringLength === stringObject.length);
    const stringBinary = stringObject.slice(ObjectStructure.objectHeaderTotalSize + 4, ObjectStructure.objectHeaderTotalSize + 4 + stringLength);
    let result = "";
    stringBinary.forEach(char => result += String.fromCharCode(char));
    return result;
}

function makePrimitiveObject(primitiveTypeName : string, value : TypescriptTypesThoseCanBeUsedAsCSharpPrimitiveTypes) : Uint8Array {
    switch(primitiveTypeName) {
        case "int":
            {
                return makeInt32Object(value as number);
            }
        case "string":
            {
                return makeStringObject(value as string);
            }
        default:
            throw new RuntimeCILError("Unknown primitive type: " + primitiveTypeName);
    }
}

export {
    makePrimitiveObject,
    getPrimitiveObjectType, 
    int32BinaryOperation,
    getJavascriptNumberValueFromInt32Object,
    makeStringObject,
    stringObjectToJavascriptString,
    TypescriptTypesThoseCanBeUsedAsCSharpPrimitiveTypes,
    OBJECT_SIZE_INT32
};