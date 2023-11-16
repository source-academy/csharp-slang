const testcase = 
{
	name: "CS0234 - Type not exist in valid namespace",
	codePieces: [
	{
		name: "CodePiece.cs",
		code:
`
using System;

namespace Test {
    class A {}
}

namespace Namespace1 {
    class A : Test.NotExist {}
}
`
	}
	],
	expectedError: "CodePiece.cs: [C# Interpreter Error] error CS0234: The type or namespace name 'NotExist' does not exist in the namespace 'Test'. Are you missing an assembly reference?",
}

module.exports = {
    "testcase": testcase
}