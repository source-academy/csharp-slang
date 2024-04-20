const testcase = 
{
	name: "CS0117 - Calling a static method that is not defined",
	codePieces: [
	{
		name: "CodePiece.cs",
		code:
`
using System;

namespace Namespace1 {
    class Class1 {
        void Method1() {
            Class1.Method2();
        }
    }
}
`
	}
	],
	expectedError: "CodePiece.cs: [C# Interpreter Error] error CS0117: 'Class1' does not contain a definition for 'Method2'",
}

module.exports = {
    "testcase": testcase
}