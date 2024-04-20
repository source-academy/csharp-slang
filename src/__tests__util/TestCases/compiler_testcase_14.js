const testcase = 
{
	name: "CS0136 - Defining a local variable's name which is the same as a parameter's name",
	codePieces: [
	{
		name: "CodePiece.cs",
		code:
`
using System;

namespace Namespace1 {
    class Class1 {
        static void Method1(int a){
            float a;
        }
    }
}
`
	}
	],
	expectedError: "CodePiece.cs: [C# Interpreter Error] error CS0136: A local or parameter named 'a' cannot be declared in this scope because that name is used in an enclosing local scope to define a local or parameter",
}

module.exports = {
    "testcase": testcase
}