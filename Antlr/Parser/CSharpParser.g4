/*
    ANTLR Parser for C# Interpreter Project
    Author: Wang Zihan
*/

parser grammar CSharpParser;

options { tokenVocab = CSharpLexer; }

csCodeEntry
    : usingStatement* namespaceDefinition+ EOF;


usingNamespacePath: IDENTIFIER('.'IDENTIFIER)*;
usingStatement
    : USING usingNamespacePath ';';

primitiveType: SBYTE | BYTE | SHORT | USHORT | INT | UINT | LONG | ULONG | FLOAT | DOUBLE | DECIMAL | STRING | OBJECT;

typeName: IDENTIFIER;
namespacePath: IDENTIFIER('.'IDENTIFIER)* '.';

// Supports type with namespace path "E.g. System.Generic.Collections.List"
typeIdentifierLiteral: (namespacePath? typeName) | primitiveType;

// Supports generic
genericTypeParameters: '<' typeIdentifier (',' typeIdentifier)* '>';
typeIdentifier: typeIdentifierLiteral genericTypeParameters?;


namespaceDefinition: NAMESPACE namespacePath? namespaceName namespaceBody;
namespaceName: IDENTIFIER;

// Note: In C# it is allowed to directly define delegates under namespace bodies (outside class body).
// But delegates defined directly under namespace bodies couldn't have any access modifiers (because those delegates are now treated as "namespace elements") (Refer to CS1527)
// This check will not be performed in the parsing process. It would be handled later in the interpreter. (TODO_INTERPRETER_CHECK)
namespaceBody: '{' delegateDefinition* classDefinition* interfaceDefinition* namespaceDefinition*'}';





// Refer to: https://learn.microsoft.com/zh-cn/dotnet/csharp/programming-guide/generics/generic-classes
classDefinition:
    classModifierList? CLASS className genericTypeParameterList? (':' classBaseList)? genericConstraints? classBody;

className: IDENTIFIER;

genericTypeParameterList: '<' IDENTIFIER (','IDENTIFIER)* '>';
classBaseList: typeIdentifier(','typeIdentifier)*;

// Refer to https://learn.microsoft.com/zh-cn/dotnet/csharp/language-reference/keywords/new-constraint
genericConstraints: genericConstraintStatement+;
genericConstraintStatement: WHERE IDENTIFIER ':' (typeIdentifier | genericNewConstraint) (','(typeIdentifier | genericNewConstraint))*;
genericNewConstraint: NEW'('')';

// Refer to: https://learn.microsoft.com/zh-cn/dotnet/csharp/programming-guide/classes-and-structs/access-modifiers
accessModifier: PUBLIC | PRIVATE | PROTECTED | INTERNAL;

// Check for conflicting modifiers (TODO_INTERPRETER_CHECK)
classModifier: PUBLIC | PRIVATE | PROTECTED | INTERNAL | SEALED | ABSTRACT | STATIC;
classModifierList: classModifier*;

classBody: '{' (
    fieldDefinition             |
    propertyDefinition          |
    classBodyMethodDefinition   |
    dataAnnotation              |
    externalMethodDefinition    |
    delegateDefinition          |
    classDefinition             |
    interfaceDefinition
    )* '}';


typeSpecifier: typeIdentifier ('[' (',')* ']')*;

// Check for conflicting modifiers (TODO_INTERPRETER_CHECK)
accessModifierAndStatic: ((accessModifier)* (STATIC)?) | ((STATIC)? (accessModifier)*);

// In C#, a field can not both be 'static' and 'const'
// But I will not check for this in the parsing stage
// Todo: Will do this check in a later stage of interpreter (TODO_INTERPRETER_CHECK)
fieldDefinition:
     accessModifierAndStatic? (CONST)? fieldType fieldName (ASSIGN (expression | arrayInitializer))? ';';
fieldName: IDENTIFIER;
fieldType: typeSpecifier;



propertyDefinition: accessModifierAndStatic? propertyType propertyName propertyBody;
propertyName: IDENTIFIER;
propertyType: typeSpecifier;
// Since the keywords 'get' an 'set' are also valid identifier names in C#, here I just use "IDENTIFIER" to refer to them.
// Whether the content of the IDENTIFIER is really 'get', 'set' or other invalid things will be checked later in the interpreter. (TODO_INTERPRETER_CHECK)
getKeyword: IDENTIFIER;
setKeyword: IDENTIFIER;
// Getters and setters can not be declared as 'static', but the property itself can be 'static'
getterDefinition: accessModifier? getKeyword (codeBlock | ';');
setterDefinition: accessModifier? setKeyword (codeBlock | ';');
// Later stage check that property MUST have at least one accessor (getter or setter) (TODO_INTERPRETER_CHECK)
propertyBody: '{'  getterDefinition? setterDefinition? '}';




// Check for conflicting modifiers (TODO_INTERPRETER_CHECK)
methodModifier: PUBLIC | PRIVATE | PROTECTED | INTERNAL | STATIC | VIRTUAL | OVERRIDE | SEALED | ABSTRACT | EXTERN;
methodModifierList: methodModifier*;
methodReturnType: typeSpecifier | VOID;
methodName: IDENTIFIER;
methodParameterList: methodParameter (',' methodParameter)*;
methodParameter: methodParameterModifier? methodParameterType methodParameterName;
methodParameterType: typeSpecifier;
methodParameterName: IDENTIFIER;
// A method parameter could only have one parameter modifier of the three below.
methodParameterModifier: IN | OUT | REF;
explicitInterfaceDeclaration: typeIdentifier '.';
// A method definition with explicit interface declaration should not have any modifiers (TODO_INTERPRETER_CHECK)
methodDefinition: methodModifierList? methodReturnType? explicitInterfaceDeclaration? methodName genericTypeParameterList? '(' methodParameterList? ')';

classBodyMethodDefinition: methodDefinition baseConstructorCall? methodBody;
methodBody: codeBlock;
baseConstructorCall: ':' BASE parameterList;

// A method definition within the interface body should not have any modifiers (include like 'public', 'virtual', etc) (TODO_INTERPRETER_CHECK)
// A method definition within the interface body should not have explicit interface declaration (TODO_INTERPRETER_CHECK)
interfaceBodyMethodDefinition: methodDefinition ';';
// Check whether the abstract method really have the keyword "abstract" in its modifier list (TODO_INTERPRETER_CHECK)
abstractMethodDefinition: methodDefinition ';';
// Check whether the abstract method really have the keyword "extern" in its modifier list (TODO_INTERPRETER_CHECK)
externalMethodDefinition: dataAnnotation methodDefinition ';';


interfaceDefinition: interfaceModifierList? INTERFACE interfaceName genericTypeParameterList? genericConstraints? interfaceBody;
interfaceModifier: PRIVATE | PROTECTED | INTERNAL | PUBLIC | VIRTUAL | ABSTRACT | SEALED | STATIC | EXTERN | PARTIAL;
interfaceModifierList: interfaceModifier*;
interfaceName: IDENTIFIER;
interfaceBody: '{' ( interfaceBodyMethodDefinition )* '}';


// Currently I only support one kind of data annotation: [DllImport("DllName")] for importing external methods.
dataAnnotation: '[' dllImportStatement ']';
dllImportStatement: DLL_IMPORT '(' importedDllName ')';
importedDllName: string;

// TODO: Local Functions
// https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/local-functions


delegateDefinition: TODO_DUMMY_TOKEN;



number:
    LITERAL_INT_DEC | LITERAL_INT_HEX | LITERAL_INT_BIN | LITERAL_FRAC_DOUBLE | LITERAL_FRAC_FLOAT | LITERAL_FRAC_DECIMAL;
string: STRING_LITERAL;
integer: LITERAL_INT_DEC | LITERAL_INT_HEX | LITERAL_INT_BIN;


// For all types of code block, currently I don't consider parsing one instruction in the block without brackets (although this is accepted in C#, it's a bad way to write the code defined in the coding standards)
// For example,  if(a < 10) a++;  will not be parsed correctly, but  if(a < 10){a++;}  can be parsed correctly
codeBlock: '{' (instructionList | ifElseBlock | ifBlock | forBlock | forEachBlock | whileBlock | doWhileBlock | tryCatchBlock | tryCatchFinallyBlock | switchBlock | codeBlock)* '}';
ifBlock: IF '(' expression ')' codeBlock;
elseBlock: ELSE codeBlock;
ifElseBlock: ifBlock elseBlock;
forFirstPart: statement | localVariableDefinition;
forSecondPart: expression;
forThirdPart: statement;
forBlock: FOR '(' forFirstPart? ';' forSecondPart? ';' forThirdPart? ')' codeBlock;
forEachVariableDefinition: typeSpecifier IDENTIFIER;
forEachBlock: FOREACH '(' forEachVariableDefinition IN expression ')' codeBlock;
whileBlock: WHILE '(' expression ')' codeBlock;
doWhileBlock: DO codeBlock WHILE '(' expression ')' ';';
tryBlock: TRY codeBlock;
exceptionType: typeIdentifier;
exceptionName: IDENTIFIER;
catchBlock: CATCH ('(' exceptionType exceptionName')')? codeBlock;
finallyBlock: FINALLY codeBlock;
tryCatchBlock: tryBlock catchBlock+;
tryCatchFinallyBlock: tryBlock catchBlock+ finallyBlock;
switchBlock: TODO_DUMMY_TOKEN;


instructionList: instruction+;
instruction: (statement | localVariableDefinition | returnStatement | breakStatement | continueStatement | TODO_DUMMY_TOKEN) ';';

returnStatement: RETURN expression;
breakStatement: BREAK;
continueStatement: CONTINUE;

arrayInitializer: '{' (((expression (',' expression)*)?) | (arrayInitializer (',' arrayInitializer)*) ) '}';

expression:
    variableIdentifier      |
    parentheseExpression    |
    number                  |
    additiveExpr            |
    statement               |
    TODO_DUMMY_TOKEN;

// CS0201: Only assignment, call, increment, decrement, await, and new object expressions can be used as a statement
statement:
    assignment      |
    evaluationChain |
    increment       |
    decrement       |
    // For now I don't consider 'await' here.
    newObject       ;



variableIdentifier: IDENTIFIER;
objectReferenceIdentifier: IDENTIFIER | THIS | BASE | NULL;


// Anything that may represent / return an object
// Commented because this may lead to mutually left-recursion error in ANTLR
/*
anObject:
    objectReferenceIdentifier  |  // Object reference
    number                     |  // Numbers in C# are objects, like Int32
    string                     |  // Strings in C# are objects
    methodCall                 |  // Method call that returns an object
    fieldOrPropertyName        |  // Object that is referenced by a field or property
    collectionIndexProperty    |  // An object reference that is stored in a collection and accessing by index, like 'array[0]'
    parentheseExpression       ;  // The object results from an expression within parentheses, like '(1 + 2)' (Resulting in an 'Int32' object).
*/

fieldOrPropertyAccess: fieldOrPropertyName;
methodCall: methodName genericTypeParameters? parameterList;

fieldOrPropertyName: IDENTIFIER;
evaluationChain: 
// 'typeIdentifier' here is for accessing static fields of a generic class
// such as 'A<int>.num' where A is defined as 'class A<T>{ public static T num; }'
(objectReferenceIdentifier | number | string | methodCall | parentheseExpression | typeIdentifier | newObject) collectionIndexing* ('.' (fieldOrPropertyAccess | methodCall) collectionIndexing* )*;

parameterList: '(' (expression (',' expression)*)? ')';

operand: variableIdentifier | evaluationChain;

assignment: operand ASSIGN expression;

// The operand of an increment or decrement operator must be a variable, property or indexer (TODO_INTERPRETER_CHECK)
increment: (operand '++') | ('++' operand);
decrement: (operand '--') | ('--' operand);
// Check whether array creation is valid or not (TODO_INTERPRETER_CHECK)
// Rules:
// Array creation must have array size or array initializer
// If size and initializer both present, the length of initializer must match the size
// For arrays that have multiple indexes, all indexes must be empty (so the size will be determined by the initializer) or all filled by integers. For example,  new int[1,1];  and   new int[,]{{1,2},{3,4}}   are valid, but    new int[1,]   and   new int[,1]   are not valid.
newObject: NEW ((typeIdentifier parameterList) | (typeIdentifier  ('[' (integer (',' integer)*)? ']')+ arrayInitializer?));


castExpression: '(' typeSpecifier ')' operand;
parentheseExpression: '(' expression ')';
localVariableDefinition: (CONST)? localVariableType localVariableName (ASSIGN (expression | arrayInitializer))?;
localVariableType: typeSpecifier;
localVariableName: IDENTIFIER;

// Numbers can not be indexed in C# (TODO_INTERPRETER_CHECK)
// So you can not do things like ' 123[0] '
collectionIndexing: '[' indexNumber ']';
// In C#, you can use dec, hex or bin numbers to represent an index, such as  "abcd"[3] ,  "abcd"[0x3]  and  "abcd"[0b11]  are all correct and can get the 4th character in the string "abcd".
indexNumber: integer;


// Arithmetic expressions
baseValue: number | parentheseExpression | operand | unaryExpression;
unaryExpression:
    increment       |
    decrement       |
    newObject       |
    castExpression  ;

multiplicativeExpr:   (baseValue (('*'|'/'|'%') baseValue)*);
additiveExpr:         (baseValue | multiplicativeExpr) (('+'|'-') (baseValue | multiplicativeExpr))*;


// Todo: bitwise and/or/xor, binary shift
// Todo: string concat expression ("str" + "str")
// Todo: boolean expressions
// Todo: cast expression (done)
// Todo: operator +=, -=, *= etc
// Todo: expression "<condition> ? <value1> : <value2>"
// Todo: throw and return expression
