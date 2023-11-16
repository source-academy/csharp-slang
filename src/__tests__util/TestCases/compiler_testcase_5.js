const testcase = 
{
	name: "CS0146 - Circular inheritance (self)",
	codePieces: [
	{
		name: "CodePiece.cs",
		code:
`
using System;

namespace Program {
    class A : A {}
}
`
	}
	],
	expectedError: "CodePiece.cs: [C# Interpreter Error] error CS0146: Circular base class dependency involving 'A' and 'A'",
}

module.exports = {
    "testcase": testcase
}