import { RUNTIME_MEMORY_HEAP_INITIAL_SIZE_IN_BYTES } from '../../Constants'
import { assertNonNullOrUndefined, assertTrue, assertNotReachHere } from '../../../util/Assertion'
import { RuntimeCILError, OutOfHeapMemoryError } from '../../CSInterpreterError'
import { formatString } from '../../../util/StringUtil'
import { logWarn } from '../../../util/Logger'

/**
 * The special address that represents NULL.
 */
const NULL_POINTER: MemoryHeapAddress = -1

type MemoryHeapAddress = number
type size_t = number

const MESSAGE_MEMORY_ACCESS_OUT_OF_BOUNDS = "Memory access out of bounds. ( Trying to '%val' at invalid address %val )."

/**
 * A class that provides basic memory management functions over an `Uint8Array` heap
 */
class MemoryHeap {
  private readonly heap: Uint8Array
  private readonly dynamicPartitioningLinkedListHead: DynamicPartitioningLinkedListNode

  /**
   * The constructor for the `MemoryHeap` class.
   */
  constructor () {
    const initialSize = RUNTIME_MEMORY_HEAP_INITIAL_SIZE_IN_BYTES
    this.heap = new Uint8Array(initialSize)
    this.dynamicPartitioningLinkedListHead = new DynamicPartitioningLinkedListNode(0, initialSize)
  }

  /**
 * Allocate memory with the given size.
 *
 * @param size The size for allocation.
 * @returns The start address for the allocated memory region, can be used when calling `free(startAddress)`.
 */
  malloc (size: size_t): MemoryHeapAddress {
    // log("[MemoryHeap] Allocating " + size + " bytes");
    assertTrue(size >= 0)
    if (size === 0) {
      logWarn('[MemoryHeap.malloc] Unable to allocate memory: Allocation size is zero.')
      return NULL_POINTER
    }
    const node = this.findBestFitUnallocatedMemorySegment(size)
    if (node === null) {
      // logWarn("[MemoryHeap.malloc] Unable to allocate memory: Can not find an unallocated memory region that is large enough for allocation size " + size);
      // return NULL_POINTER;
      throw new OutOfHeapMemoryError(size)
    }
    if (node.size > size) {
      const newFreeNodeSize = node.size - size
      const newFreeNode = new DynamicPartitioningLinkedListNode(node.startAddress + size, newFreeNodeSize)
      node.size = size
      const originalNextNode = node.nextNode
      node.nextNode = newFreeNode
      newFreeNode.nextNode = originalNextNode
      if (originalNextNode !== null) {
        originalNextNode.previousNode = newFreeNode
      }
      newFreeNode.previousNode = node
    }
    node.allocated = true
    return node.startAddress
  }

  /**
 * Free the allocated memory region with the given start address.
 *
 * @param startAddress The start address of an allocated memory region.
 */
  free (startAddress: MemoryHeapAddress): void {
    // log("[MemoryHeap] Freeing allocated memory region at start address " + startAddress);
    const node = this.findMemorySegmentByStartAddress(startAddress)
    if (node === null) {
      throw new RuntimeCILError('[MemoryHeap.free] Unable to free memory: invalid start address ' + startAddress)
    }
    if (!node.allocated) {
      throw new RuntimeCILError('[MemoryHeap.free] Unable to free memory: the memory region with start address ' + startAddress + ' is not allocated')
    }
    node.allocated = false
    // Merge with neighboring unallocated nodes
    //   Merge the next node to the current node and remove the next node from the linked list
    if (node.nextNode !== null && !node.nextNode.allocated) {
      const nextNode = node.nextNode
      const nextNextNode = nextNode.nextNode
      node.nextNode = nextNextNode
      if (nextNextNode !== null) {
        nextNextNode.previousNode = node
      }
      node.size += nextNode.size
      // 'nextNode' is no longer being used, and should be collected by JavaScript engine's GC
      // But is it really necessary to totally break the references between 'nextNode' and the other nodes in the linked list to let JavaScript engine's GC to collect 'nextNode'?
      nextNode.nextNode = null
      nextNode.previousNode = null
    }
    //   Merge the current node to the previous node and remove the current node from the linked list
    if (node.previousNode !== null && !node.previousNode.allocated) {
      const nextNode = node.nextNode
      const previousNode = node.previousNode
      previousNode.nextNode = nextNode
      if (nextNode !== null) {
        nextNode.previousNode = previousNode
      }
      previousNode.size += node.size
      // 'node' is no longer being used, and should be collected by JavaScript engine's GC
      // But is it really necessary to totally break the references between 'node' and the other nodes in the linked list to let JavaScript engine's GC to collect 'node'?
      node.nextNode = null
      node.previousNode = null
    }
  }

  // [DEVELOPMENT ONLY CODE]
  private debug_dynamicPartitioningLinkedListToString (): string {
    let result = ''
    let currentNode: DynamicPartitioningLinkedListNode | null = this.dynamicPartitioningLinkedListHead
    while (currentNode !== null) {
      result += formatString('[%val] Start Address = %val, size = %val\n', [(currentNode.allocated ? 'Allocated' : '  Free   '), currentNode.startAddress.toString(), currentNode.size.toString()])
      currentNode = currentNode.nextNode
    }
    return result
  }
  // [DEVELOPMENT ONLY CODE] End

  private findBestFitUnallocatedMemorySegment (size: size_t): DynamicPartitioningLinkedListNode | null {
    assertNonNullOrUndefined(this.dynamicPartitioningLinkedListHead)
    let result = null
    let currentNode: DynamicPartitioningLinkedListNode | null = this.dynamicPartitioningLinkedListHead
    while (currentNode !== null) {
      if (currentNode.allocated) {
        currentNode = currentNode.nextNode
        continue
      }
      if (currentNode.size < size) {
        currentNode = currentNode.nextNode
        continue
      }
      if (result === null || currentNode.size < result.size) {
        result = currentNode
        currentNode = currentNode.nextNode
      } else if (currentNode.size >= result.size) {
        currentNode = currentNode.nextNode
      } else {
        assertNotReachHere()
      }
    }
    return result
  }

  private findMemorySegmentByStartAddress (startAddress: MemoryHeapAddress): DynamicPartitioningLinkedListNode | null {
    assertNonNullOrUndefined(this.dynamicPartitioningLinkedListHead)
    let currentNode: DynamicPartitioningLinkedListNode | null = this.dynamicPartitioningLinkedListHead
    while (currentNode !== null) {
      if (currentNode.startAddress === startAddress) {
        return currentNode
      }
      currentNode = currentNode.nextNode
    }
    return null
  }

  /**
 * Read data from heap memory.
 *
 * @param address The start address (absolute address) in heap memory for the data you want to read.
 * @param length The number of bytes to read.
 * @returns The data from heap memory.
 */
  read (address: MemoryHeapAddress, length: size_t): Uint8Array {
    assertTrue(length >= 0)
    const readEndAddressInclusive = address + length - 1
    if (address < 0) {
      throw new RuntimeCILError(formatString(MESSAGE_MEMORY_ACCESS_OUT_OF_BOUNDS, ['read', address.toString()]))
    }
    if (readEndAddressInclusive >= RUNTIME_MEMORY_HEAP_INITIAL_SIZE_IN_BYTES) {
      throw new RuntimeCILError(formatString(MESSAGE_MEMORY_ACCESS_OUT_OF_BOUNDS, ['read', readEndAddressInclusive.toString()]))
    }
    const result = new Uint8Array(length)
    let resultIndex = 0
    for (let i = address; i <= readEndAddressInclusive; i++) {
      result[resultIndex] = this.heap[i]
      resultIndex++
    }
    return result
  }

  /**
 * Write to heap memory.
 *
 * @param address The start address (absolute address) in heap memory for the data you want to write.
 * @param data The data you want to write into heap memory.
 */
  write (address: MemoryHeapAddress, data: Uint8Array): void {
    const dataLength = data.length
    const writeEndAddressInclusive = address + dataLength - 1
    if (address < 0) {
      throw new RuntimeCILError(formatString(MESSAGE_MEMORY_ACCESS_OUT_OF_BOUNDS, ['write', address.toString()]))
    }
    if (writeEndAddressInclusive >= RUNTIME_MEMORY_HEAP_INITIAL_SIZE_IN_BYTES) {
      throw new RuntimeCILError(formatString(MESSAGE_MEMORY_ACCESS_OUT_OF_BOUNDS, ['write', writeEndAddressInclusive.toString()]))
    }
    let dataIndex = 0
    for (let i = address; i <= writeEndAddressInclusive; i++) {
      this.heap[i] = data[dataIndex]
      dataIndex++
    }
  }
}

class DynamicPartitioningLinkedListNode {
  allocated: boolean
  startAddress: MemoryHeapAddress
  size: size_t
  previousNode: DynamicPartitioningLinkedListNode | null
  nextNode: DynamicPartitioningLinkedListNode | null

  constructor (startAddress: MemoryHeapAddress, size: size_t) { // startAddress is inclusive
    this.allocated = false
    this.startAddress = startAddress
    this.size = size
    this.previousNode = null
    this.nextNode = null
  }
}

export { MemoryHeap, type MemoryHeapAddress, type size_t, NULL_POINTER/*, AllocatedMemoryRegion */ }
