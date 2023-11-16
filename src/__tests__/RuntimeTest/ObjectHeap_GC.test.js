const TestConstantsModule = require('../../__tests__util/TestConstants');
const RuntimeContextModule = require("../../" + TestConstantsModule.BUILD_OUTPUT_DIR_RELATED_TO_SRC + '/common/runtime/RuntimeContext');
const MemoryHeapModule = require("../../" + TestConstantsModule.BUILD_OUTPUT_DIR_RELATED_TO_SRC + '/common/runtime/heap/MemoryHeap');
const ConstantsModule = require("../../" + TestConstantsModule.BUILD_OUTPUT_DIR_RELATED_TO_SRC + '/common/Constants');
const RuntimeOperandModule = require("../../" + TestConstantsModule.BUILD_OUTPUT_DIR_RELATED_TO_SRC + '/common/runtime/RuntimeOperand');

let testRuntimeContext = null;
let testObjectHeap = null;
let object1 = MemoryHeapModule.NULL_POINTER;
let object2 = MemoryHeapModule.NULL_POINTER;
let object3 = MemoryHeapModule.NULL_POINTER;
let object4 = MemoryHeapModule.NULL_POINTER;
let object5 = MemoryHeapModule.NULL_POINTER;

const dummyClassMetadata = {
	classMetadataIndex: 0,
	sizeOfObjectFields: 19,
	fields: [// "fieldType" values are not being used in object heap
	{
		fieldType: null,
		fieldSize: 4,
		fieldOffset: 0,
		fieldName: "a",
		isReferenceField: true,
	},
	{
		fieldType: null,
		fieldSize: 4,
		fieldOffset: 4,
		fieldName: "b",
		isReferenceField: true,
	},
	{
		fieldType: null,
		fieldSize: 4,
		fieldOffset: 8,
		fieldName: "c",
		isReferenceField: false,
	},
	{
		fieldType: null,
		fieldSize: 4,
		fieldOffset: 12,
		fieldName: "d",
		isReferenceField: false,
	},
	]
}

class CallStackFrameStub {
	runtimeLocals = [];
	iterateRuntimeLocals (callbackFunction) {
      const localCount = this.runtimeLocals.length;
      for (let i = 0; i < localCount; i++) {
        callbackFunction(this.runtimeLocals[i]);
      }
    }
}

class RuntimeLocalStub {
  storedValueOperand = new RuntimeOperandModule.RuntimeOperand(MemoryHeapModule.NULL_POINTER, true);

  getValue () {
    return this.storedValueOperand.val;
  }

  getIsReference () {
    return this.storedValueOperand.isReference;
  }

  setValue (newValue, isReference)  {
    this.storedValueOperand = new RuntimeOperandModule.RuntimeOperand(newValue, isReference);
  }
}

test("Create a new runtime context for all test cases.", () => {
	testRuntimeContext = new RuntimeContextModule.RuntimeContext();
	testObjectHeap = testRuntimeContext.heap;
});

test('Create a new object (object1) in the object heap with dummy class metadata and verify object1 has an address of zero.', () => {
	object1 = testObjectHeap.createNewObjectInstance(dummyClassMetadata);
	expect(object1).toBe(0);
});

test('Verify object1 is not marked.', () => {
	expect(testObjectHeap.isObjectMarked(object1)).toBe(false);
});

test('Run mark method and verify object1 is not marked.', () => {
	testObjectHeap.markReachableObjects(testRuntimeContext);
	expect(testObjectHeap.isObjectMarked(object1)).toBe(false);
});

test('Run sweep method and verify memory for object1 is freed in MemoryHeap.', () => {
	testObjectHeap.sweepUnreachableObjects();
	expect(testObjectHeap.memoryHeap.dynamicPartitioningLinkedListHead.size).toBe(ConstantsModule.RUNTIME_MEMORY_HEAP_INITIAL_SIZE_IN_BYTES);
});

test('Create a new object (object2) in the object heap with dummy class metadata and verify object2 has an address of zero.', () => {
	object2 = testObjectHeap.createNewObjectInstance(dummyClassMetadata);
	expect(object2).toBe(0);
});

test('Verify object2 is not marked.', () => {
	expect(testObjectHeap.isObjectMarked(object2)).toBe(false);
});

test('Push object2 to the evaluation stack as an operand and run mark method. Verify object2 is marked.', () => {
	testRuntimeContext.evaluationStack.push(new RuntimeOperandModule.RuntimeOperand(object2, true));
	testObjectHeap.markReachableObjects(testRuntimeContext);
	expect(testObjectHeap.isObjectMarked(object2)).toBe(true);
});

test('Run sweep method and verify memory for object2 is not freed in MemoryHeap.', () => {
	testObjectHeap.sweepUnreachableObjects();
	expect(testObjectHeap.memoryHeap.dynamicPartitioningLinkedListHead.allocated).toBe(true);
	expect(testObjectHeap.memoryHeap.dynamicPartitioningLinkedListHead.nextNode.allocated).toBe(false);
});

test('Pop object2 from the evaluation stack and run mark method. Verify object2 is not marked.', () => {
	testRuntimeContext.evaluationStack.pop();
	testObjectHeap.markReachableObjects(testRuntimeContext);
	expect(testObjectHeap.isObjectMarked(object2)).toBe(false);
});

test('Run sweep method and verify memory for object2 is freed in MemoryHeap.', () => {
	testObjectHeap.sweepUnreachableObjects();
	expect(testObjectHeap.memoryHeap.dynamicPartitioningLinkedListHead.size).toBe(ConstantsModule.RUNTIME_MEMORY_HEAP_INITIAL_SIZE_IN_BYTES);
});

test('Create a new object (object3) in the object heap with dummy class metadata and verify object3 has an address of zero.', () => {
	object3 = testObjectHeap.createNewObjectInstance(dummyClassMetadata);
	expect(object3).toBe(0);
});

test('Verify object3 is not marked.', () => {
	expect(testObjectHeap.isObjectMarked(object3)).toBe(false);
});

test('Assign object3 to a runtime local within a call stack frame and run mark method. Verify object3 is marked.', () => {
	callStackFrameStub = new CallStackFrameStub();
	runtimeLocalStub = new RuntimeLocalStub();
	runtimeLocalStub.setValue(object3, true);
	callStackFrameStub.runtimeLocals[0] = runtimeLocalStub;
	testRuntimeContext.callStack.push(callStackFrameStub);
	testObjectHeap.markReachableObjects(testRuntimeContext);
	expect(testObjectHeap.isObjectMarked(object3)).toBe(true);
});

test('Run sweep method and verify memory for object3 is not freed in MemoryHeap.', () => {
	testObjectHeap.sweepUnreachableObjects();
	expect(testObjectHeap.memoryHeap.dynamicPartitioningLinkedListHead.allocated).toBe(true);
	expect(testObjectHeap.memoryHeap.dynamicPartitioningLinkedListHead.nextNode.allocated).toBe(false);
});

test('Create a new object (object4) and assign object4 to the \'a\' field of object3. Verify object3 and object4 are both not marked.', () => {
	object4 = testObjectHeap.createNewObjectInstance(dummyClassMetadata);
	testObjectHeap.writeObjectField(object3, 'a', new Uint8Array([object4, 0, 0, 0]));
	expect(testObjectHeap.isObjectMarked(object3)).toBe(false);
	expect(testObjectHeap.isObjectMarked(object4)).toBe(false);
});

test('Run mark method. Verify object3 and object4 are both marked.', () => {
	testObjectHeap.markReachableObjects(testRuntimeContext);
	expect(testObjectHeap.isObjectMarked(object3)).toBe(true);
	expect(testObjectHeap.isObjectMarked(object4)).toBe(true);
});

test('Run sweep method and verify memory for both object3 and object4 is not freed in MemoryHeap.', () => {
	testObjectHeap.sweepUnreachableObjects();
	expect(testObjectHeap.memoryHeap.dynamicPartitioningLinkedListHead.allocated).toBe(true);
	expect(testObjectHeap.memoryHeap.dynamicPartitioningLinkedListHead.nextNode.allocated).toBe(true);
	expect(testObjectHeap.memoryHeap.dynamicPartitioningLinkedListHead.nextNode.nextNode.allocated).toBe(false);
});

test('Assign object3 to the \'a\' field of object4 (create circular reference). Verify object3 and object4 are both not marked.', () => {
	testObjectHeap.writeObjectField(object4, 'a', new Uint8Array([object3, 0, 0, 0]));
	expect(testObjectHeap.isObjectMarked(object3)).toBe(false);
	expect(testObjectHeap.isObjectMarked(object4)).toBe(false);
});

test('Run mark method. Verify object3 and object4 are both marked.', () => {
	testObjectHeap.markReachableObjects(testRuntimeContext);
	expect(testObjectHeap.isObjectMarked(object3)).toBe(true);
	expect(testObjectHeap.isObjectMarked(object4)).toBe(true);
});

test('Run sweep method and verify memory for both object3 and object4 is not freed in MemoryHeap.', () => {
	testObjectHeap.sweepUnreachableObjects();
	expect(testObjectHeap.memoryHeap.dynamicPartitioningLinkedListHead.allocated).toBe(true);
	expect(testObjectHeap.memoryHeap.dynamicPartitioningLinkedListHead.nextNode.allocated).toBe(true);
	expect(testObjectHeap.memoryHeap.dynamicPartitioningLinkedListHead.nextNode.nextNode.allocated).toBe(false);
});

test('Break the reference from the runtime local to object3. Run mark method. Verify object3 and object4 are both not marked.', () => {
	testRuntimeContext.callStack.peek().runtimeLocals[0].setValue(MemoryHeapModule.NULL_POINTER, true);
	testObjectHeap.markReachableObjects(testRuntimeContext);
	expect(testObjectHeap.isObjectMarked(object3)).toBe(false);
	expect(testObjectHeap.isObjectMarked(object4)).toBe(false);
});

test('Run sweep method and verify memory for both circular-referenced object3 and object4 is freed in MemoryHeap.', () => {
	testObjectHeap.sweepUnreachableObjects();
	expect(testObjectHeap.memoryHeap.dynamicPartitioningLinkedListHead.allocated).toBe(false);
	expect(testObjectHeap.memoryHeap.dynamicPartitioningLinkedListHead.nextNode).toBeNull();
});

test('Create a new object (object5) and assign object5 to the \'a\' field of object5 itself (referencing to itself). Verify object5 is not marked.', () => {
	object5 = testObjectHeap.createNewObjectInstance(dummyClassMetadata);
	testObjectHeap.writeObjectField(object5, 'a', new Uint8Array([object5, 0, 0, 0]));
	expect(testObjectHeap.isObjectMarked(object5)).toBe(false);
});

test('Run mark method. Verify object5 is not marked.', () => {
	testObjectHeap.markReachableObjects(testRuntimeContext);
	expect(testObjectHeap.isObjectMarked(object5)).toBe(false);
});

test('Run sweep method and verify memory for object5 is freed in MemoryHeap.', () => {
	testObjectHeap.sweepUnreachableObjects();
	expect(testObjectHeap.memoryHeap.dynamicPartitioningLinkedListHead.allocated).toBe(false);
	expect(testObjectHeap.memoryHeap.dynamicPartitioningLinkedListHead.nextNode).toBeNull();
});