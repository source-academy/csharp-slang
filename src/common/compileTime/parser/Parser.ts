import { CharStream, CommonTokenStream, ErrorListener, type CommonToken } from 'antlr4'
import CSharpLexer from './antlr-generated/CSharpLexer'
import CSharpParser, { type CsCodeEntryContext } from './antlr-generated/CSharpParser'

/**
 * Parse the raw C# code into an ANTLR parse tree.
 *
 * @param rawCode The raw C# code string.
 * @returns The root node of the ANTLR parse tree.
 */
export function parse (rawCode: string): CsCodeEntryContext {
  const lexer = new CSharpLexer(new CharStream(rawCode))
  const parser = new CSharpParser(new CommonTokenStream(lexer))
  parser.removeErrorListeners() // To remove the default "ConsoleErrorListener".
  parser.addErrorListener(new ExceptionErrorListener())
  return parser.csCodeEntry()
}

class ExceptionErrorListener extends ErrorListener<any> {
  syntaxError (recognizer: CSharpParser, offendingSymbol: CommonToken, line: number, column: number, msg: string, e: any): void {
    throw new CSharpParseError(line, column, msg)
  }
}

class CSharpParseError extends Error {
  private readonly line: number
  private readonly column: number
  private readonly msg: string
  constructor (line: number, column: number, msg: string) {
    super('C# Syntax Error: ' + msg + ' (at position ' + line + ':' + column + ')')
    this.line = line
    this.column = column
    this.msg = msg
  }
}
