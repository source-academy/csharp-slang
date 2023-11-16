const TestConstantsModule = require('../../__tests__util/TestConstants');
const MemoryHeapModule = require("../../" + TestConstantsModule.BUILD_OUTPUT_DIR_RELATED_TO_SRC + '/common/runtime/heap/MemoryHeap');
const ObjectHeapModule = require("../../" + TestConstantsModule.BUILD_OUTPUT_DIR_RELATED_TO_SRC + '/common/runtime/heap/ObjectHeap');
const ConstantsModule = require("../../" + TestConstantsModule.BUILD_OUTPUT_DIR_RELATED_TO_SRC + '/common/Constants');
const CSInterpreterErrorModule = require("../../" + TestConstantsModule.BUILD_OUTPUT_DIR_RELATED_TO_SRC + '/common/CSInterpreterError');

let testObjectHeap = null;
let objectAddress = MemoryHeapModule.NULL_POINTER;

const dummyClassMetadata = {
	classMetadataIndex: 0,
	sizeOfObjectFields: 19,
	fields: [// "fieldType" values are not being used in object heap
	{
		fieldType: null,
		fieldSize: 1,
		fieldOffset: 0,
		fieldName: "a",
		isReferenceField: false,
	},
	{
		fieldType: null,
		fieldSize: 2,
		fieldOffset: 1,
		fieldName: "b",
		isReferenceField: false,
	},
	{
		fieldType: null,
		fieldSize: 4,
		fieldOffset: 3,
		fieldName: "c",
		isReferenceField: false,
	},
	{
		fieldType: null,
		fieldSize: 8,
		fieldOffset: 7,
		fieldName: "d",
		isReferenceField: false,
	},
	]
}

test("Create a new object heap for all test cases", () => {
	testObjectHeap = new ObjectHeapModule.ObjectHeap();
})

test('Create a new object in the object heap with dummy class metadata', () => {
	objectAddress = testObjectHeap.createNewObjectInstance(dummyClassMetadata);
	expect(objectAddress).toBe(0);
});

test('Initial value for field \'a\' is zero', () => {
	expect(testObjectHeap.readObjectField(objectAddress, 'a').toString()).toBe(new Uint8Array([0]).toString());
});

test('Initial value for field \'b\' is zero', () => {
	expect(testObjectHeap.readObjectField(objectAddress, 'b').toString()).toBe(new Uint8Array([0, 0]).toString());
});

test('Initial value for field \'c\' is zero', () => {
	expect(testObjectHeap.readObjectField(objectAddress, 'c').toString()).toBe(new Uint8Array([0, 0, 0, 0]).toString());
});

test('Initial value for field \'d\' is zero', () => {
	expect(testObjectHeap.readObjectField(objectAddress, 'd').toString()).toBe(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]).toString());
});

test('Write 1 byte to field \'a\'', () => {
	testObjectHeap.writeObjectField(objectAddress, 'a', new Uint8Array([1]));
});

test('Read 1 byte from field \'a\'', () => {
	expect(testObjectHeap.readObjectField(objectAddress, 'a').toString()).toBe(new Uint8Array([1]).toString());
});

test('Write 2 bytes to field \'b\'', () => {
	testObjectHeap.writeObjectField(objectAddress, 'b', new Uint8Array([1, 2]));
});

test('Read 2 bytes from field \'b\'', () => {
	expect(testObjectHeap.readObjectField(objectAddress, 'b').toString()).toBe(new Uint8Array([1, 2]).toString());
});

test('Write 4 bytes to field \'c\'', () => {
	testObjectHeap.writeObjectField(objectAddress, 'c', new Uint8Array([1, 2, 3, 4]));
});

test('Read 4 bytes from field \'c\'', () => {
	expect(testObjectHeap.readObjectField(objectAddress, 'c').toString()).toBe(new Uint8Array([1, 2, 3, 4]).toString());
});


test('Write 8 bytes to field \'d\'', () => {
	testObjectHeap.writeObjectField(objectAddress, 'd', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
});

test('Read 8 bytes from field \'d\'', () => {
	expect(testObjectHeap.readObjectField(objectAddress, 'd').toString()).toBe(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).toString());
});

test('Read from non-existent field \'e\' throw error', () => {
	expect(() => testObjectHeap.readObjectField(objectAddress, 'e')).toThrow(CSInterpreterErrorModule.RuntimeCILError);
});

test('Write to non-existent field \'e\' throw error', () => {
	expect(() => testObjectHeap.writeObjectField(objectAddress, 'e', [1, 2, 3, 4])).toThrow(CSInterpreterErrorModule.RuntimeCILError);
});

test('Write 5 bytes to field \'c\' throw error', () => {
	expect(() => testObjectHeap.writeObjectField(objectAddress, 'c', new Uint8Array([1, 2, 3, 4, 5]))).toThrow(CSInterpreterErrorModule.RuntimeCILError);
});

test('Write 7 bytes to field \'d\' throw error', () => {
	expect(() => testObjectHeap.writeObjectField(objectAddress, 'd', new Uint8Array([1, 2, 3, 4, 5, 6, 7]))).toThrow(CSInterpreterErrorModule.RuntimeCILError);
});

