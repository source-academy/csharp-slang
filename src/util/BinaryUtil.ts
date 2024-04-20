import { assertTrue } from './Assertion'
import { INT32_MIN_VALUE, INT32_MAX_VALUE } from '../common/Constants'

/**
 * Convert a byte array of length 4 to an integer, using little endian.
 *
 * @param fourBytesArray The byte array of length 4.
 * @returns The integer.
 */
function bytesToInt32LittleEndian (fourBytesArray: Uint8Array): number {
  assertTrue(fourBytesArray.length === 4)
  let result = 0
  for (let i = 3; i >= 0; i--) {
    result |= (fourBytesArray[i] & 255) << (8 * i)
  }
  return result
}

/**
 * Convert an integer between -2147483648 (inclusive) and 2147483647 (inclusive) to a byte array of length 4, using little endian.
 *
 * @param int32Number The integer.
 * @returns The byte array of length 4.
 */
function int32ToBytesLittleEndian (int32Number: number): Uint8Array {
  assertTrue(Number.isSafeInteger(int32Number))
  assertTrue(int32Number >= INT32_MIN_VALUE && int32Number <= INT32_MAX_VALUE)
  const result = new Uint8Array(4)
  const mask = 0b00000000000000000000000011111111
  for (let i = 0; i <= 3; i++) {
    result[i] = (int32Number >> (8 * i)) & mask
  }
  return result
}

export { bytesToInt32LittleEndian, int32ToBytesLittleEndian }
