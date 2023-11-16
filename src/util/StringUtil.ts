import { logWarn } from './Logger'

/**
 * Format a string. It replaces the keyword `%val` in the string `pattern` with each value in the array `values`. The number of `%val` in the string `pattern` should always be the same as the number of values in the array `values`.
 *
 * @param pattern The pattern string, for example: `"This is a %val interpreter written in %val!"`.
 * @param values The value(s) to replace `%val`, for example: `["C#", "TypeScript"]`.
 * @returns The formatted string, in the examples above, it should be `"This is a C# interpreter written in TypeScript!"`.
 */
function formatString (pattern: string, values: string[]): string {
  const valueRepresentation = '%val'
  let result = pattern
  let valueIndex = 0
  const totalValueCount = values.length
  while (result.includes(valueRepresentation)) {
    if (valueIndex === totalValueCount) {
      logWarn('formatString: Values provided are not enough for the format. pattern = ' + pattern + ', result = ' + result)
      break
    }
    result = result.replace(valueRepresentation, values[valueIndex])
    valueIndex++
  }
  if (valueIndex !== totalValueCount) {
    logWarn('formatString: Extra values are discarded. pattern = ' + pattern + ', result = ' + result + ', used value count = ' + valueIndex + ', total value count = ' + totalValueCount)
  }
  return result
}

/**
 * Remove the first character of a string.
 *
 * @param str The original string.
 * @returns A new string with the first character removed.
 */
function removeFirstCharacter (str: string): string {
  return str.slice(1)
}

/**
 * Remove the last character of a string.
 *
 * @param str The original string.
 * @returns A new string with the last character removed.
 */
function removeLastCharacter (str: string): string {
  return str.slice(0, -1)
}

export { formatString, removeFirstCharacter, removeLastCharacter }
