const TestConstantsModule = require('../../__tests__util/TestConstants');
const MemoryHeapModule = require("../../" + TestConstantsModule.BUILD_OUTPUT_DIR_RELATED_TO_SRC + '/common/runtime/heap/MemoryHeap');
const ConstantsModule = require("../../" + TestConstantsModule.BUILD_OUTPUT_DIR_RELATED_TO_SRC + '/common/Constants');
const CSInterpreterErrorModule = require("../../" + TestConstantsModule.BUILD_OUTPUT_DIR_RELATED_TO_SRC + '/common/CSInterpreterError');

let testMemoryHeap = null;

const checkIsInitialDynamiPartitioningLinkedList = () => {
	const firstNode  = testMemoryHeap.dynamicPartitioningLinkedListHead;
	expect(firstNode.allocated).toBe(false);
	expect(firstNode.startAddress).toBe(0);
	expect(firstNode.size).toBe(ConstantsModule.RUNTIME_MEMORY_HEAP_INITIAL_SIZE_IN_BYTES);
	expect(firstNode.nextNode).toBe(null);
	expect(firstNode.previousNode).toBe(null);
};

test('Create test memory heap', () => {
	testMemoryHeap = new MemoryHeapModule.MemoryHeap();
	expect(typeof(testMemoryHeap)).toBe('object');
});

test('Check initial dynamic partitioning linked list', checkIsInitialDynamiPartitioningLinkedList);

test('Allocate 8 bytes from memory heap', () => {
	expect(testMemoryHeap.malloc(8)).toBe(0)
});

test('Allocate 8 bytes from memory heap', () => {
	expect(testMemoryHeap.malloc(8)).toBe(8)
});

test('Allocate 4 bytes from memory heap', () => {
	expect(testMemoryHeap.malloc(4)).toBe(16)
});

test('Allocate 1024 bytes from memory heap', () => {
	expect(testMemoryHeap.malloc(1024)).toBe(20)
});

test('Allocate too much bytes from memory heap throw error', () => {
	expect(() => testMemoryHeap.malloc(ConstantsModule.RUNTIME_MEMORY_HEAP_INITIAL_SIZE_IN_BYTES + 1)).toThrow(CSInterpreterErrorModule.OutOfHeapMemoryError)
});

test('Allocate 0 byte return NULL_POINTER', () => {
	expect(testMemoryHeap.malloc(0)).toBe(MemoryHeapModule.NULL_POINTER);
});

test('Free allocated memory region at start address 0', () => {
	testMemoryHeap.free(0);
});

test('Free allocated memory region at start address 16', () => {
	testMemoryHeap.free(16);
});

test('Free allocated memory region at start address 8', () => {
	testMemoryHeap.free(8);
});

test('There are exactly 3 nodes in the dynamic partitioning linked list', () => {
	expect(testMemoryHeap.dynamicPartitioningLinkedListHead.nextNode.nextNode.nextNode).toBe(null);
});

test('Allocate 20 bytes from the 20 bytes memory region that is just freed', () => {
	expect(testMemoryHeap.malloc(20)).toBe(0);
});

test('There are exactly 3 nodes in the dynamic partitioning linked list', () => {
	expect(testMemoryHeap.dynamicPartitioningLinkedListHead.nextNode.nextNode.nextNode).toBe(null);
});

test('Free allocated memory region at start address 0', () => {
	testMemoryHeap.free(0);
});

test('Allocate 15 bytes from the 20 bytes memory region that is just freed', () => {
	expect(testMemoryHeap.malloc(15)).toBe(0);
});

test('Allocate 3 bytes from the 20 bytes memory region that is just freed', () => {
	expect(testMemoryHeap.malloc(3)).toBe(15);
});

test('Allocate 1 byte from the 20 bytes memory region that is just freed', () => {
	expect(testMemoryHeap.malloc(1)).toBe(18);
});

test('There are exactly 6 nodes in the dynamic partitioning linked list', () => {
	expect(testMemoryHeap.dynamicPartitioningLinkedListHead // 1st node
		.nextNode // 2nd node
		.nextNode // 3rd node
		.nextNode // 4th node
		.nextNode // 5th node
		.nextNode // 6th node
		.nextNode).toBe(null);
});

test('Check allocation status, start address and size for every node in the dynamic partitioning linked list', () => {
	const firstNode  = testMemoryHeap.dynamicPartitioningLinkedListHead;
	const secondNode = firstNode.nextNode;
	const thirdNode  = secondNode.nextNode;
	const fourthNode = thirdNode.nextNode;
	const fifthNode  = fourthNode.nextNode;
	const sixthNode  = fifthNode.nextNode;
	expect(firstNode.allocated).toBe(true);
	expect(firstNode.startAddress).toBe(0);
	expect(firstNode.size).toBe(15);
	expect(secondNode.allocated).toBe(true);
	expect(secondNode.startAddress).toBe(15);
	expect(secondNode.size).toBe(3);
	expect(thirdNode.allocated).toBe(true);
	expect(thirdNode.startAddress).toBe(18);
	expect(thirdNode.size).toBe(1);
	expect(fourthNode.allocated).toBe(false);
	expect(fourthNode.startAddress).toBe(19);
	expect(fourthNode.size).toBe(1);
	expect(fifthNode.allocated).toBe(true);
	expect(fifthNode.startAddress).toBe(20);
	expect(fifthNode.size).toBe(1024);
	expect(sixthNode.allocated).toBe(false);
	expect(sixthNode.startAddress).toBe(1044);
	expect(sixthNode.size).toBe(ConstantsModule.RUNTIME_MEMORY_HEAP_INITIAL_SIZE_IN_BYTES - 15 - 3 - 1 - 1 - 1024);
});

test('Free allocated memory region at invalid start address 1 throw error', () => {
	expect(() => testMemoryHeap.free(1)).toThrow(CSInterpreterErrorModule.RuntimeCILError);
});

test('Free allocated memory region at invalid start address NULL_POINTER throw error', () => {
	expect(() => testMemoryHeap.free(MemoryHeapModule.NULL_POINTER)).toThrow(CSInterpreterErrorModule.RuntimeCILError);
});

test('Totally free all allocated memory region', () => {
	testMemoryHeap.free(0);
	testMemoryHeap.free(15);
	testMemoryHeap.free(18);
	testMemoryHeap.free(20);
});

test('Fully allocate the memory heap with one region', () => {
	expect(testMemoryHeap.malloc(ConstantsModule.RUNTIME_MEMORY_HEAP_INITIAL_SIZE_IN_BYTES)).toBe(0);
});

test('Free the fully allocated memory region', () => {
	testMemoryHeap.free(0);
});

test('Check dynamic partitioning linked list is the same as the initial dynamic partitioning linked list', checkIsInitialDynamiPartitioningLinkedList);

test('Allocate 8 bytes from memory heap', () => {
	expect(testMemoryHeap.malloc(8)).toBe(0);
});

test('Write 8 bytes to memory heap at address 0', () => {
	testMemoryHeap.write(0, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
});

test('Read 8 bytes to memory heap at address 0', () => {
	expect(testMemoryHeap.read(0, 8).toString()).toBe(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).toString());
});

test('Read memory heap at address -1 throw error', () => {
	expect(() => testMemoryHeap.read(-1, 1)).toThrow(CSInterpreterErrorModule.RuntimeCILError);
});

test('Read memory heap at address RUNTIME_MEMORY_HEAP_INITIAL_SIZE_IN_BYTES + 1 throw error', () => {
	expect(() => testMemoryHeap.read(ConstantsModule.RUNTIME_MEMORY_HEAP_INITIAL_SIZE_IN_BYTES, 1)).toThrow(CSInterpreterErrorModule.RuntimeCILError);
});

test('Free allocated memory region at start address 0', () => {
	testMemoryHeap.free(0);
});
