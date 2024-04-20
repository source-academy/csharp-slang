const testcase = 
{
	name: "CS1520 - Defining a non-constructor method without a return type",
	codePieces: [
	{
		name: "CodePiece.cs",
		code:
`
using System;

namespace Namespace1 {
    class Class1 {
        public Class2() {}
    }
}
`
	}
	],
	expectedError: "CodePiece.cs: [C# Interpreter Error] error CS1520: Method must have a return type",
}

module.exports = {
    "testcase": testcase
}