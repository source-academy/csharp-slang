const testcase = 
{
	name: "CS0246 - Type not found",
	codePieces: [
	{
		name: "CodePiece.cs",
		code:
`
using System;

namespace Namespace1 {
    class A : NotExist {}
}
`
	}
	],
	expectedError: "CodePiece.cs: [C# Interpreter Error] error CS0246: The type or namespace name 'NotExist' could not be found. Are you missing an assembly reference?",
}

module.exports = {
    "testcase": testcase
}