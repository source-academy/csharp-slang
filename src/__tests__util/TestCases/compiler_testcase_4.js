const testcase = 
{
	name: "CS0146 - Circular inheritance",
	codePieces: [
	{
		name: "CodePiece.cs",
		code:
`
using System;

namespace Program {
    class A : B {}
    class B : C {}
    class C : A {}
}
`
	}
	],
	expectedError: "CodePiece.cs: [C# Interpreter Error] error CS0146: Circular base class dependency involving 'A' and 'B'",
}

module.exports = {
    "testcase": testcase
}