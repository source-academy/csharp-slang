const testcase = 
{
	name: "CS0118 - Namespace used as type",
	codePieces: [
	{
		name: "CodePiece.cs",
		code:
`
using System;

namespace Namespace1 {
    class A : Test {}
}

namespace Test {}
`
	}
	],
	expectedError: "CodePiece.cs: [C# Interpreter Error] error CS0118: 'Test' is a 'namespace' but a 'type' was expected",
}

module.exports = {
    "testcase": testcase
}