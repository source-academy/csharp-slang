import { OUTPUT_CONSOLE_LOGS } from '../common/Constants'

/**
 * Log a message to the JavaScript console.
 *
 * @param content The content to log.
 * @param arg An optional argument that will be passed to console.log
 */
export function log (content: any, arg: string = ''): void {
  if (!OUTPUT_CONSOLE_LOGS) return
  if (typeof (content) === 'string') {
    content = content.toString().replaceAll('\n', '\\n')
  }
  console.log(content, arg)
}

/**
 * Log a warn message to the JavaScript console.
 *
 * @param content The content to log.
 */
export function logWarn (content: any): void {
  if (!OUTPUT_CONSOLE_LOGS) return
  if (typeof (content) === 'string') {
    content = content.toString().replaceAll('\n', '\\n')
  }
  console.warn(content)
}

export function logVerbose (content: any, arg: string = ''): void {
  if (!OUTPUT_CONSOLE_LOGS) return
  if (typeof (content) === 'string') {
    content = content.toString().replaceAll('\n', '\\n')
  }
  console.debug(content, arg)
}
