const testcase = 
{
	name: "CS0128 - Defining duplicated local variable names in the same scope",
	codePieces: [
	{
		name: "CodePiece.cs",
		code:
`
using System;

namespace Namespace1 {
    class Class1 {
        static void Method1(){
            float a;
            int a;
        }
    }
}
`
	}
	],
	expectedError: "CodePiece.cs: [C# Interpreter Error] error CS0128: A local variable or function named 'a' is already defined in this scope",
}

module.exports = {
    "testcase": testcase
}