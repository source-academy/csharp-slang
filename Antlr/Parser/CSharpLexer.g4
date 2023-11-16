/*
    ANTLR Lexer for C# Interpreter Project
    Author: Wang Zihan
*/

lexer grammar CSharpLexer;

// All C# Keywords
// Refer to https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/
ABSTRACT:             'abstract';
AS:                         'as';
BASE:                     'base';
BOOL:                     'bool';
BREAK:                   'break';
BYTE:                     'byte';
CASE:                     'case';
CATCH:                   'catch';
CHAR:                     'char';
CHECKED:               'checked';
CLASS:                   'class';
CONST:                   'const';
CONTINUE:             'continue';
DECIMAL:               'decimal';
DEFAULT:               'default';
DELEGATE:             'delegate';
DO:                         'do';
DOUBLE:                 'double';
ELSE:                     'else';
ENUM:                     'enum';
EVENT:                   'event';
EXPLICIT:             'explicit';
EXTERN:                 'extern';
FALSE:                   'false';
FINALLY:               'finally';
FIXED:                   'fixed';
FLOAT:                   'float';
FOR:                       'for';
FOREACH:               'foreach';
GOTO:                     'goto';
IF:                         'if';
IMPLICIT:             'implicit';
IN:                         'in';
INT:                       'int';
INTERFACE:           'interface';
INTERNAL:             'internal';
IS:                         'is';
LOCK:                     'lock';
LONG:                     'long';
NAMESPACE:           'namespace';
NEW:                       'new';
NULL:                     'null';
OBJECT:                 'object';
OPERATOR:             'operator';
OUT:                       'out';
OVERRIDE:             'override';
PARAMS:                 'params';
PRIVATE:               'private';
PROTECTED:           'protected';
PUBLIC:                 'public';
READONLY:             'readonly';
REF:                       'ref';
RETURN:                 'return';
SBYTE:                   'sbyte';
SEALED:                 'sealed';
SHORT:                   'short';
SIZEOF:                 'sizeof';
STACKALLOC:         'stackalloc';
STATIC:                 'static';
STRING:                 'string';
STRUCT:                 'struct';
SWITCH:                 'switch';
THIS:                     'this';
THROW:                   'throw';
TRUE:                     'true';
TRY:                       'try';
TYPEOF:                 'typeof';
UINT:                     'uint';
ULONG:                   'ulong';
UNCHECKED:           'unchecked';
UNSAFE:                 'unsafe';
USHORT:                 'ushort';
USING:                   'using';
VIRTUAL:               'virtual';
VOID:                     'void';
VOLATILE:             'volatile';
WHILE:                   'while';
WHERE:                   'where';

PARTIAL:               'partial';


// This should be removed when development on the parser has completely finished.
TODO_DUMMY_TOKEN:        'dummy';

// For now I hardcoded this one as a fixed keyword token, because now I only support the DllImport data annotation
DLL_IMPORT:          'DllImport';



// In property defination, getters and setters are treated as IDENTIFIER since in C# 'get' and 'set' could also be used as a valid identifier name. Thus the two lines below is commented.
// GET:                       'get';
// SET:                       'set';

// Symbols
CURLY_BRACKET_L:              '{';
CURLY_BRACKET_R:              '}';
SQUARE_BRACKET_L:             '[';
SQUARE_BRACKET_R:             ']';
PARENTHESE_L:                 '(';
PARENTHESE_R:                 ')';
SEMICOLON:                    ';';
DOT:                          '.';
COLON:                        ':';
COMMA:                        ',';

// Operators
ASSIGN:                       '=';  
LARGER:                       '>';
SMALLER:                      '<';
INCREMENT:                   '++';
DECREMENT:                   '--';
ADD:                          '+';
SUBTRACT:                     '-';
MULTIPLY:                     '*';
DIVISION:                     '/';
REMAINDER:                    '%';

// Literals
// Numbers (In C# there is no octal number literals)
fragment DigitDec:    [0-9];
fragment DigitHex:    [0-9A-Fa-f];
fragment DigitBin:    [0-1];
// Note: only dec integers can end with '_' without errors
LITERAL_INT_DEC:      DigitDec (DigitDec | '_')* (([Uu]?[Ll]?)|([Ll]?[Uu]?));
LITERAL_INT_HEX:      '0'[Xx]DigitHex ((DigitHex | '_')* DigitHex)? (([Uu]?[Ll]?)|([Ll]?[Uu]?));
LITERAL_INT_BIN:      '0'[Bb]DigitBin ((DigitBin | '_')* DigitBin)? (([Uu]?[Ll]?)|([Ll]?[Uu]?));
// In fraction numbers, only the integer part (part before decimal dot) can have character '_' inside
fragment LITERAL_FRAC_DEC:   DigitDec ((DigitDec+ '_' DigitDec+) | DigitDec )* ('.' DigitDec+)?;
LITERAL_FRAC_DOUBLE:  LITERAL_FRAC_DEC [Dd]?;
LITERAL_FRAC_FLOAT:  LITERAL_FRAC_DEC [Ff]?;
LITERAL_FRAC_DECIMAL:  LITERAL_FRAC_DEC [Mm]?;


fragment Alphabet: [A-Za-z];
// Refer to: https://learn.microsoft.com/zh-cn/dotnet/csharp/fundamentals/coding-style/identifier-names
// Keywords "get" and "set" can also be an identifier
IDENTIFIER: (Alphabet|'_')(Alphabet|DigitDec|'_')*; // todo: unicode charset support
STRING_LITERAL: '"'(.*?)'"';



// Tokens not reflect in syntax tree
SPACE: (' '|'	')+ -> channel(HIDDEN);
INVISIBLE_CHARACTERS: (SPACE|[\r\n])+ -> channel(HIDDEN);
COMMENT_AREA: '/*' (.*?) '*/' -> channel(HIDDEN);
COMMENT_LINE: '//' (~[\r\n])* -> channel(HIDDEN);
