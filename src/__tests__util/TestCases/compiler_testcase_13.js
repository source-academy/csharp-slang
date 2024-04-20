const testcase = 
{
	name: "CS0100 - Duplicated parameter names in method",
	codePieces: [
	{
		name: "CodePiece.cs",
		code:
`
using System;

namespace Namespace1 {
    class Class1 {
        static void Method1(int a, float a) {
        }
    }
}
`
	}
	],
	expectedError: "CodePiece.cs: [C# Interpreter Error] error CS0100: The parameter name 'a' is a duplicate",
}

module.exports = {
    "testcase": testcase
}